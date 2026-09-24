// «Backend» en memoria del prototipo. Aplica las reglas del documento maestro
// (validación al confirmar, check-in y cierre sin duplicados, canje único, permisos)
// para que el recorrido se pueda probar sin servidor. En el MVP estas reglas
// pasan a la base de datos y a funciones de servidor (docs/F-arquitectura-tecnica.md).

import { BLOCKING_STATUSES, freeSlots, isSlotFree, priceServicesFor, staffForServices, totalDuration, totalPrice } from "./availability";
import { PermissionError, actorLabel, canAccessAppointment, canCheckIn, canManageBusiness, hasPhotoPermission, isStaff } from "./permissions";
import { addDays, addMinutes, datePart } from "./time";
import type {
  Actor,
  Appointment,
  AppointmentSource,
  DemoState,
  Feedback,
  ID,
  Photo,
  PhotoPurpose,
  PhotoView,
  PreparationMode,
  Reward,
  ServiceCategory,
  Session,
  SessionStylePrefs,
  WaitlistRequest,
} from "./types";

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string; message: string };

const fail = (error: string, message: string) => ({ ok: false as const, error, message });

export const OFFER_TTL_MIN = 30;

export interface BookInput {
  businessId: ID;
  locationId: ID;
  customerId: ID;
  staffId: ID;
  serviceIds: ID[];
  start: string;
  source: AppointmentSource;
  finishBy?: string;
}

export interface PreparationInput {
  mode: PreparationMode;
  styleEntryId?: ID;
  referencePhotoId?: ID;
  keep: string;
  change: string;
  note: string;
}

export interface CloseInput {
  serviceIds: ID[];
  /** Ajuste respecto al precio de catálogo, confirmado con el cliente (p. ej. extra acordado). */
  adjustmentCents: number;
  technicalNote: string;
  maintenance: string;
  productsUsed: string[];
  productsSold: { name: string; qty: number; priceCents: number }[];
  photoIds: ID[];
  coverPhotoId?: ID;
  styleTitle: string;
  payment: Session["payment"];
}

export class DemoBackend {
  private listeners = new Set<() => void>();

  constructor(
    private state: DemoState,
    private clock: () => string,
    private persist: (s: DemoState) => void = () => {},
  ) {}

  // ---------- infraestructura ----------

  getState = (): DemoState => this.state;
  now = (): string => this.clock();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  replaceState(state: DemoState) {
    this.state = state;
    this.commit();
  }

  private commit() {
    // Estado inmutable a nivel superior para que React detecte el cambio.
    this.state = { ...this.state };
    this.persist(this.state);
    this.listeners.forEach((l) => l());
  }

  private id(prefix: string): string {
    this.state.seq += 1;
    return `${prefix}_${this.state.seq.toString(36)}`;
  }

  private token(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  private code(prefix: string): string {
    let c: string;
    do c = `${prefix}${Math.floor(10000 + Math.random() * 89999)}`;
    while (this.state.appointments.some((a) => a.code === c) || this.state.rewards.some((r) => r.redeemCode === c));
    return c;
  }

  private audit(actor: Actor | "sistema", action: string, target: string, detail?: string) {
    this.state.audit.push({
      id: this.id("log"),
      at: this.now(),
      actor: actor === "sistema" ? "sistema" : actorLabel(this.state, actor),
      action,
      target,
      detail,
    });
  }

  private appt(id: ID) {
    return this.state.appointments.find((a) => a.id === id);
  }

  private setStatus(a: Appointment, status: Appointment["status"], by: Actor | "sistema", note?: string) {
    a.status = status;
    a.history.push({ at: this.now(), status, by: by === "sistema" ? "sistema" : actorLabel(this.state, by), note });
  }

  /** Caduca ofertas de lista de espera y recompensas vencidas. Se ejecuta antes de cada operación. */
  tick() {
    const now = this.now();
    let changed = false;
    for (const w of this.state.waitlist) {
      if (w.status === "oferta_enviada" && w.offer && w.offer.expiresAt <= now) {
        w.status = "caducada";
        this.audit("sistema", "lista_espera.oferta_caducada", w.id);
        changed = true;
      }
    }
    for (const r of this.state.rewards) {
      if (r.status === "disponible" && r.expiresAt <= now) {
        r.status = "caducada";
        changed = true;
      }
    }
    if (changed) {
      this.processWaitlist();
      this.commit();
    }
  }

  // ---------- reservas ----------

  /** Reserva validando el hueco en el momento de confirmar, no solo al mostrarlo. */
  book(actor: Actor, input: BookInput): Result<{ appointment: Appointment }> {
    this.tick();
    if (actor.kind === "cliente" && actor.customerId !== input.customerId) throw new PermissionError();
    if (isStaff(actor) && actor.businessId !== input.businessId) throw new PermissionError();

    const lines = priceServicesFor(this.state, input.staffId, input.serviceIds);
    if (!lines || lines.length === 0) return fail("servicio_no_disponible", "Este profesional no realiza alguno de los servicios elegidos.");
    const duration = totalDuration(lines);
    if (input.start <= this.now()) return fail("hora_pasada", "Esa hora ya ha pasado.");

    if (!isSlotFree(this.state, input.staffId, input.start, duration)) {
      const alternatives = freeSlots(this.state, input.staffId, datePart(input.start), duration, this.now()).slice(0, 4);
      return {
        ok: false,
        error: "hueco_no_disponible",
        message:
          "Ese hueco ya no está disponible: alguien lo ha reservado mientras elegías o ha cambiado la agenda. No se ha creado ninguna reserva." +
          (alternatives.length ? ` Horas libres ese día: ${alternatives.map((t) => t.slice(11)).join(", ")}.` : ""),
      };
    }

    const appointment: Appointment = {
      id: this.id("apt"),
      code: this.code("B"),
      businessId: input.businessId,
      locationId: input.locationId,
      customerId: input.customerId,
      staffId: input.staffId,
      start: input.start,
      end: addMinutes(input.start, duration),
      status: "confirmada",
      services: lines,
      source: input.source,
      qrToken: this.token(),
      finishBy: input.finishBy,
      createdAt: this.now(),
      history: [],
    };
    this.setStatus(appointment, "confirmada", actor);
    this.state.appointments.push(appointment);
    const customer = this.state.customers.find((c) => c.id === input.customerId);
    if (customer && !customer.businessIds.includes(input.businessId)) customer.businessIds.push(input.businessId);
    this.audit(actor, "cita.crear", appointment.id, `${appointment.start} ${lines.map((l) => l.name).join(" + ")}`);
    this.commit();
    return { ok: true, appointment };
  }

  reschedule(actor: Actor, appointmentId: ID, start: string): Result<{ appointment: Appointment }> {
    this.tick();
    const a = this.appt(appointmentId);
    if (!a) return fail("no_encontrada", "No encontramos la reserva.");
    if (!canAccessAppointment(actor, a)) throw new PermissionError();
    if (!["confirmada", "modificada"].includes(a.status)) return fail("estado", "Esta cita ya no se puede cambiar.");
    const duration = totalDuration(a.services);
    if (start <= this.now()) return fail("hora_pasada", "Esa hora ya ha pasado.");
    if (!isSlotFree(this.state, a.staffId, start, duration, { ignoreAppointmentId: a.id }))
      return fail("hueco_no_disponible", "Ese hueco ya no está disponible. Tu cita sigue como estaba.");
    const before = a.start;
    a.start = start;
    a.end = addMinutes(start, duration);
    this.setStatus(a, "modificada", actor, `de ${before} a ${start}`);
    this.audit(actor, "cita.cambiar", a.id, `${before} → ${start}`);
    this.processWaitlist();
    this.commit();
    return { ok: true, appointment: a };
  }

  cancel(actor: Actor, appointmentId: ID, note?: string): Result<{ appointment: Appointment }> {
    this.tick();
    const a = this.appt(appointmentId);
    if (!a) return fail("no_encontrada", "No encontramos la reserva.");
    if (!canAccessAppointment(actor, a)) throw new PermissionError();
    if (!["confirmada", "modificada"].includes(a.status)) return fail("estado", "Esta cita ya no se puede cancelar.");
    this.setStatus(a, "cancelada", actor, note);
    this.audit(actor, "cita.cancelar", a.id);
    this.processWaitlist();
    this.commit();
    return { ok: true, appointment: a };
  }

  markNoShow(actor: Actor, appointmentId: ID): Result<{ appointment: Appointment }> {
    const a = this.appt(appointmentId);
    if (!a) return fail("no_encontrada", "No encontramos la reserva.");
    if (!isStaff(actor) || !canAccessAppointment(actor, a)) throw new PermissionError();
    if (!["confirmada", "modificada"].includes(a.status)) return fail("estado", "Solo una cita pendiente puede marcarse como ausencia.");
    this.setStatus(a, "ausencia", actor);
    this.audit(actor, "cita.ausencia", a.id);
    this.commit();
    return { ok: true, appointment: a };
  }

  /** Cliente que llega sin reserva: ocupa la misma agenda y queda con llegada registrada. */
  walkIn(actor: Actor, input: { name: string; staffId: ID; serviceIds: ID[] }): Result<{ appointment: Appointment }> {
    this.tick();
    if (!isStaff(actor)) throw new PermissionError();
    const staff = this.state.staff.find((s) => s.id === input.staffId && s.businessId === actor.businessId);
    if (!staff) throw new PermissionError();
    const lines = priceServicesFor(this.state, staff.id, input.serviceIds);
    if (!lines?.length) return fail("servicio_no_disponible", "Elige un servicio que realice este profesional.");
    const now = this.now();
    const minutes = Number(now.slice(14, 16));
    const start = addMinutes(now, (5 - (minutes % 5)) % 5);
    if (!isSlotFree(this.state, staff.id, start, totalDuration(lines)))
      return fail("hueco_no_disponible", "Este profesional no tiene hueco ahora mismo para esos servicios.");

    const customer = {
      id: this.id("cli"),
      businessIds: [actor.businessId],
      name: input.name.trim() || "Cliente sin nombre",
      hue: Math.floor(Math.random() * 360),
      guest: true,
      sessionStyle: { tranquila: false, explicarCambios: false, consultarAntes: false },
      savedPhotoIds: [],
    };
    this.state.customers.push(customer);
    const appointment: Appointment = {
      id: this.id("apt"),
      code: this.code("B"),
      businessId: actor.businessId,
      locationId: staff.locationIds[0],
      customerId: customer.id,
      staffId: staff.id,
      start,
      end: addMinutes(start, totalDuration(lines)),
      status: "confirmada",
      services: lines,
      source: "sin_reserva",
      qrToken: this.token(),
      createdAt: now,
      history: [],
    };
    this.setStatus(appointment, "confirmada", actor, "sin reserva");
    this.state.appointments.push(appointment);
    this.registerArrival(actor, appointment, "manual");
    this.audit(actor, "cita.sin_reserva", appointment.id);
    this.commit();
    return { ok: true, appointment };
  }

  // ---------- preparación ----------

  savePreparation(actor: Actor, appointmentId: ID, input: PreparationInput): Result<object> {
    const a = this.appt(appointmentId);
    if (!a) return fail("no_encontrada", "No encontramos la reserva.");
    if (actor.kind !== "cliente" || a.customerId !== actor.customerId) throw new PermissionError();
    if (!["confirmada", "modificada", "llegada"].includes(a.status)) return fail("estado", "Esta cita ya no admite cambios en la preparación.");
    if (input.styleEntryId) {
      const entry = this.state.styleEntries.find((e) => e.id === input.styleEntryId);
      if (!entry || entry.customerId !== actor.customerId) throw new PermissionError();
    }
    const existing = this.state.preparations.find((p) => p.appointmentId === appointmentId);
    const prep = {
      appointmentId,
      ...input,
      updatedAt: this.now(),
      seenByStaffAt: existing?.seenByStaffAt,
      changedAfterSeen: Boolean(existing?.seenByStaffAt),
    };
    this.state.preparations = [...this.state.preparations.filter((p) => p.appointmentId !== appointmentId), prep];
    this.audit(actor, "preparacion.guardar", appointmentId);
    this.commit();
    return { ok: true };
  }

  markPreparationSeen(actor: Actor, appointmentId: ID) {
    const a = this.appt(appointmentId);
    if (!a || !isStaff(actor) || !canAccessAppointment(actor, a)) return;
    const prep = this.state.preparations.find((p) => p.appointmentId === appointmentId);
    if (!prep) return;
    prep.seenByStaffAt = this.now();
    prep.changedAfterSeen = false;
    this.commit();
  }

  // ---------- llegada ----------

  private registerArrival(actor: Extract<Actor, { kind: "staff" }>, a: Appointment, method: "qr" | "manual") {
    this.state.checkIns.push({ id: this.id("chk"), appointmentId: a.id, staffId: actor.staffId, at: this.now(), method });
    this.setStatus(a, "llegada", actor, method === "qr" ? "QR" : "verificación manual");
    this.audit(actor, `checkin.${method}`, a.id);
  }

  /**
   * Check-in por QR o manual. Ambos caminos actualizan el mismo estado:
   * un segundo escaneo devuelve «ya registrado» sin crear otra llegada.
   */
  checkIn(
    actor: Actor,
    ref: { token: string } | { appointmentId: ID },
  ): Result<{ status: "registrado" | "ya_registrado"; appointment: Appointment }> {
    this.tick();
    if (!isStaff(actor)) throw new PermissionError();
    const a = "token" in ref ? this.state.appointments.find((x) => x.qrToken === ref.token.trim()) : this.appt(ref.appointmentId);
    if (!a) return fail("no_encontrado", "Este código no corresponde a ninguna reserva.");
    if (!canCheckIn(actor, a)) return fail("otro_negocio", "Esta reserva pertenece a otro establecimiento.");
    if (a.status === "cancelada") return fail("cancelada", "La reserva está cancelada. No se ha registrado la llegada.");
    if (a.status === "ausencia") return fail("ausencia", "La cita figura como ausencia. Revísala desde la agenda.");
    if (["llegada", "en_atencion", "completada"].includes(a.status)) return { ok: true, status: "ya_registrado", appointment: a };
    if (datePart(a.start) !== datePart(this.now())) return fail("otro_dia", `Esta reserva es para el ${datePart(a.start)}, no para hoy.`);
    this.registerArrival(actor, a, "token" in ref ? "qr" : "manual");
    this.commit();
    return { ok: true, status: "registrado", appointment: a };
  }

  startService(actor: Actor, appointmentId: ID) {
    const a = this.appt(appointmentId);
    if (!a || !isStaff(actor) || !canAccessAppointment(actor, a)) throw new PermissionError();
    if (a.status !== "llegada") return;
    this.setStatus(a, "en_atencion", actor);
    this.commit();
  }

  // ---------- fotos ----------

  /** Simula la subida. Una subida fallida queda marcada como tal y nunca se muestra como guardada. */
  uploadPhoto(
    actor: Actor,
    input: { appointmentId: ID; view: PhotoView; source?: Photo["source"]; simulateFailure?: boolean },
  ): Result<{ photo: Photo }> {
    const a = this.appt(input.appointmentId);
    if (!a || !canAccessAppointment(actor, a)) throw new PermissionError();
    const photo: Photo = {
      id: this.id("pho"),
      businessId: a.businessId,
      customerId: a.customerId,
      appointmentId: a.id,
      view: input.view,
      source: input.source ?? (actor.kind === "cliente" ? "cliente" : "profesional"),
      uploadedBy: actor.kind === "cliente" ? actor.customerId : actor.staffId,
      at: this.now(),
      hue: Math.floor(Math.random() * 360),
      status: input.simulateFailure ? "fallida" : "subida",
    };
    this.state.photos.push(photo);
    if (photo.status === "subida") this.grantDefaultPermission(photo);
    this.commit();
    if (photo.status === "fallida") return fail("subida_fallida", "La foto no se ha podido subir. No está guardada; puedes reintentar.");
    return { ok: true, photo };
  }

  retryPhoto(actor: Actor, photoId: ID): Result<{ photo: Photo }> {
    const photo = this.state.photos.find((p) => p.id === photoId);
    if (!photo || photo.status !== "fallida") return fail("no_encontrada", "No hay nada que reintentar.");
    const a = photo.appointmentId ? this.appt(photo.appointmentId) : undefined;
    if (!a || !canAccessAppointment(actor, a)) throw new PermissionError();
    photo.status = "subida";
    this.grantDefaultPermission(photo);
    this.commit();
    return { ok: true, photo };
  }

  removePendingPhoto(actor: Actor, photoId: ID) {
    const photo = this.state.photos.find((p) => p.id === photoId);
    if (!photo || photo.sessionId) return;
    const a = photo.appointmentId ? this.appt(photo.appointmentId) : undefined;
    if (!a || !canAccessAppointment(actor, a)) throw new PermissionError();
    this.state.photos = this.state.photos.filter((p) => p.id !== photoId);
    this.state.photoPermissions = this.state.photoPermissions.filter((p) => p.photoId !== photoId);
    this.commit();
  }

  /** Solo historial privado. Portfolio y promoción requieren autorización expresa del cliente. */
  private grantDefaultPermission(photo: Photo) {
    this.state.photoPermissions.push({ photoId: photo.id, purpose: "historial_privado", granted: true, at: this.now(), by: "sistema" });
  }

  setPhotoPermission(actor: Actor, photoId: ID, purpose: PhotoPurpose, granted: boolean) {
    const photo = this.state.photos.find((p) => p.id === photoId);
    if (!photo || actor.kind !== "cliente" || photo.customerId !== actor.customerId) throw new PermissionError();
    this.state.photoPermissions.push({ photoId, purpose, granted, at: this.now(), by: actor.customerId });
    this.audit(actor, `foto.permiso.${granted ? "conceder" : "retirar"}`, photoId, purpose);
    this.commit();
  }

  // ---------- cierre de sesión ----------

  /**
   * Cierra la atención. Idempotente por cita: repetir el cierre devuelve la sesión existente
   * sin duplicar visita, importe ni progreso de fidelización.
   */
  closeSession(actor: Actor, appointmentId: ID, input: CloseInput): Result<{ session: Session; duplicated: boolean; newRewards: Reward[] }> {
    this.tick();
    const a = this.appt(appointmentId);
    if (!a) return fail("no_encontrada", "No encontramos la reserva.");
    if (!isStaff(actor) || !canAccessAppointment(actor, a)) throw new PermissionError();

    const existing = this.state.sessions.find((s) => s.appointmentId === appointmentId);
    if (existing) return { ok: true, session: existing, duplicated: true, newRewards: [] };
    if (!["llegada", "en_atencion"].includes(a.status))
      return fail("sin_llegada", "Registra primero la llegada del cliente (QR o verificación manual).");

    const lines = priceServicesFor(this.state, a.staffId, input.serviceIds);
    if (!lines?.length) return fail("servicios", "Confirma al menos un servicio realizado.");
    // Lo reservado conserva su precio histórico; lo añadido en la sesión usa el catálogo actual.
    const final = lines.map((l) => a.services.find((s) => s.serviceId === l.serviceId) ?? l);
    const photos = this.state.photos.filter((p) => input.photoIds.includes(p.id) && p.status === "subida" && p.appointmentId === a.id);

    const session: Session = {
      id: this.id("ses"),
      appointmentId: a.id,
      businessId: a.businessId,
      customerId: a.customerId,
      staffId: a.staffId,
      completedAt: this.now(),
      services: final,
      estimatedCents: totalPrice(a.services),
      finalCents: totalPrice(final) + input.adjustmentCents,
      durationMin: totalDuration(final),
      technicalNote: input.technicalNote.trim(),
      maintenance: input.maintenance.trim(),
      productsUsed: input.productsUsed,
      productsSold: input.productsSold,
      photoIds: photos.map((p) => p.id),
      payment: input.payment,
      closedBy: actor.staffId,
      corrections: [],
    };
    this.state.sessions.push(session);
    photos.forEach((p) => (p.sessionId = session.id));
    this.setStatus(a, "completada", actor);

    const main = final[0];
    const category: ServiceCategory = this.state.services.find((s) => s.id === main.serviceId)?.category ?? "corte";
    this.state.styleEntries.push({
      id: this.id("sty"),
      customerId: a.customerId,
      sessionId: session.id,
      title: input.styleTitle.trim() || final.map((l) => l.name).join(" + "),
      category,
      coverPhotoId: photos.find((p) => p.id === input.coverPhotoId)?.id ?? photos[0]?.id,
      favorite: false,
      wantAgain: false,
    });

    const newRewards = this.applyLoyalty(session);
    this.audit(actor, "sesion.cerrar", session.id, `${session.finalCents} cts`);
    this.commit();
    return { ok: true, session, duplicated: false, newRewards };
  }

  /** Un movimiento por sesión como máximo: la regla se aplica una sola vez. */
  private applyLoyalty(session: Session): Reward[] {
    if (this.state.loyaltyMovements.some((m) => m.sessionId === session.id)) return [];
    const program = this.state.loyaltyPrograms.find((p) => p.businessId === session.businessId);
    if (!program) return [];
    this.state.loyaltyMovements.push({
      id: this.id("mov"),
      customerId: session.customerId,
      businessId: session.businessId,
      sessionId: session.id,
      delta: 1,
      reason: "visita atendida",
      at: this.now(),
    });
    const total = this.state.loyaltyMovements
      .filter((m) => m.customerId === session.customerId && m.businessId === session.businessId)
      .reduce((acc, m) => acc + m.delta, 0);
    if (total % program.goal !== 0) return [];
    const reward: Reward = {
      id: this.id("rew"),
      businessId: session.businessId,
      customerId: session.customerId,
      name: program.rewardName,
      benefit: program.rewardBenefit,
      conditions: program.rewardConditions,
      origin: `${total} visitas completadas`,
      status: "disponible",
      createdAt: this.now(),
      expiresAt: addDays(this.now(), program.validDays),
      redeemCode: this.code("R"),
    };
    this.state.rewards.push(reward);
    this.audit("sistema", "recompensa.desbloquear", reward.id, reward.origin);
    return [reward];
  }

  /** Corrección posterior: queda registrada con autor; no crea otra visita ni vuelve a sumar fidelización. */
  correctSessionAmount(actor: Actor, sessionId: ID, finalCents: number, reason: string): Result<{ session: Session }> {
    const s = this.state.sessions.find((x) => x.id === sessionId);
    if (!s) return fail("no_encontrada", "No encontramos la sesión.");
    const a = this.appt(s.appointmentId)!;
    if (!isStaff(actor) || !canAccessAppointment(actor, a)) throw new PermissionError();
    s.corrections.push({ at: this.now(), by: actorLabel(this.state, actor), field: "importe", from: String(s.finalCents), to: `${finalCents} (${reason})` });
    s.finalCents = finalCents;
    this.audit(actor, "sesion.corregir", s.id, reason);
    this.commit();
    return { ok: true, session: s };
  }

  // ---------- recompensas ----------

  /** Canje verificado por el profesional: pertenece al cliente, está vigente y no se ha usado. */
  redeemReward(actor: Actor, code: string, customerId: ID): Result<{ reward: Reward }> {
    this.tick();
    if (!isStaff(actor)) throw new PermissionError();
    const r = this.state.rewards.find((x) => x.redeemCode === code.trim().toUpperCase());
    if (!r) return fail("no_encontrada", "Código de recompensa no válido.");
    if (r.businessId !== actor.businessId) return fail("otro_negocio", "Esta recompensa es de otro establecimiento.");
    if (r.customerId !== customerId) return fail("otro_cliente", "Esta recompensa no pertenece a este cliente.");
    if (r.status === "utilizada") return fail("ya_utilizada", `Esta recompensa ya se canjeó el ${r.redeemedAt?.replace("T", " ")}.`);
    if (r.status === "caducada") return fail("caducada", "Esta recompensa ha caducado.");
    r.status = "utilizada";
    r.redeemedAt = this.now();
    r.redeemedBy = actor.staffId;
    this.audit(actor, "recompensa.canjear", r.id);
    this.commit();
    return { ok: true, reward: r };
  }

  // ---------- estilo, preferencias y opiniones ----------

  toggleFavorite(actor: Actor, styleEntryId: ID) {
    const e = this.state.styleEntries.find((x) => x.id === styleEntryId);
    if (!e || actor.kind !== "cliente" || e.customerId !== actor.customerId) throw new PermissionError();
    e.favorite = !e.favorite;
    this.commit();
  }

  /** Guardar un trabajo del portfolio. Solo si sigue autorizado para publicarse. */
  toggleSavedLook(actor: Actor, photoId: ID) {
    if (actor.kind !== "cliente") throw new PermissionError();
    const c = this.state.customers.find((x) => x.id === actor.customerId)!;
    if (c.savedPhotoIds.includes(photoId)) c.savedPhotoIds = c.savedPhotoIds.filter((x) => x !== photoId);
    else {
      if (!hasPhotoPermission(this.state, photoId, "portfolio")) throw new PermissionError("Este trabajo ya no está publicado.");
      c.savedPhotoIds = [...c.savedPhotoIds, photoId];
    }
    this.commit();
  }

  toggleWantAgain(actor: Actor, styleEntryId: ID) {
    const e = this.state.styleEntries.find((x) => x.id === styleEntryId);
    if (!e || actor.kind !== "cliente" || e.customerId !== actor.customerId) throw new PermissionError();
    e.wantAgain = !e.wantAgain;
    this.commit();
  }

  addFeedback(actor: Actor, input: Pick<Feedback, "sessionId" | "photoId" | "kind" | "liked" | "change"> & { customerId: ID }) {
    if (actor.kind === "cliente" && actor.customerId !== input.customerId) throw new PermissionError();
    if (isStaff(actor)) {
      const session = this.state.sessions.find((s) => s.id === input.sessionId);
      if (!session || session.businessId !== actor.businessId) throw new PermissionError();
    }
    this.state.feedback.push({
      id: this.id("fb"),
      ...input,
      author: actor.kind === "cliente" ? "cliente" : "profesional",
      authorId: actor.kind === "cliente" ? actor.customerId : actor.staffId,
      at: this.now(),
    });
    this.commit();
  }

  /** El profesional propone; la preferencia no se muestra como confirmada hasta que el cliente la acepta. */
  proposePreference(actor: Actor, customerId: ID, label: string, value: string) {
    if (!isStaff(actor)) throw new PermissionError();
    this.state.preferences.push({ id: this.id("pref"), customerId, label, value, origin: "profesional", confirmed: false });
    this.commit();
  }

  confirmPreference(actor: Actor, preferenceId: ID, accept: boolean) {
    const p = this.state.preferences.find((x) => x.id === preferenceId);
    if (!p || actor.kind !== "cliente" || p.customerId !== actor.customerId) throw new PermissionError();
    if (accept) p.confirmed = true;
    else this.state.preferences = this.state.preferences.filter((x) => x.id !== preferenceId);
    this.commit();
  }

  setSessionStyle(actor: Actor, prefs: SessionStylePrefs) {
    if (actor.kind !== "cliente") throw new PermissionError();
    const c = this.state.customers.find((x) => x.id === actor.customerId)!;
    c.sessionStyle = prefs;
    this.commit();
  }

  // ---------- lista de espera ----------

  joinWaitlist(
    actor: Actor,
    input: Omit<WaitlistRequest, "id" | "status" | "createdAt" | "offer" | "resultAppointmentId">,
  ): Result<{ request: WaitlistRequest }> {
    if (actor.kind !== "cliente" || actor.customerId !== input.customerId) throw new PermissionError();
    if (input.originalAppointmentId) {
      const orig = this.appt(input.originalAppointmentId);
      if (!orig || orig.customerId !== actor.customerId) throw new PermissionError();
    }
    const request: WaitlistRequest = { ...input, id: this.id("wl"), status: "activa", createdAt: this.now() };
    this.state.waitlist.push(request);
    this.audit(actor, "lista_espera.alta", request.id);
    this.processWaitlist();
    this.commit();
    return { ok: true, request };
  }

  cancelWaitlist(actor: Actor, requestId: ID) {
    const w = this.state.waitlist.find((x) => x.id === requestId);
    if (!w || actor.kind !== "cliente" || w.customerId !== actor.customerId) throw new PermissionError();
    if (!["activa", "oferta_enviada"].includes(w.status)) return;
    w.status = "cancelada";
    this.processWaitlist();
    this.commit();
  }

  /** Ofrece huecos compatibles por orden de llegada. Un hueco ofrecido queda retenido y no se ofrece dos veces. */
  private processWaitlist() {
    const now = this.now();
    const active = this.state.waitlist.filter((w) => w.status === "activa").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const w of active) {
      const staffIds = w.staffIds.length ? w.staffIds : staffForServices(this.state, w.businessId, w.serviceIds).map((s) => s.id);
      for (const staffId of staffIds) {
        const lines = priceServicesFor(this.state, staffId, w.serviceIds);
        if (!lines) continue;
        const duration = totalDuration(lines);
        const slot = freeSlots(this.state, staffId, w.date, duration, now).find((t) => {
          const hhmm = t.slice(11, 16);
          if (hhmm < w.timeFrom || addMinutes(t, duration).slice(11, 16) > w.timeTo) return false;
          if (!w.originalAppointmentId) return true;
          // Solo interesa si mejora la cita original (es antes).
          const orig = this.appt(w.originalAppointmentId);
          return !orig || t < orig.start;
        });
        if (slot) {
          w.status = "oferta_enviada";
          w.offer = { staffId, start: slot, end: addMinutes(slot, duration), expiresAt: addMinutes(now, OFFER_TTL_MIN) };
          this.audit("sistema", "lista_espera.oferta", w.id, slot);
          break;
        }
      }
    }
  }

  /** Aceptar crea la nueva cita; solo entonces se cancela la original. */
  acceptOffer(actor: Actor, requestId: ID): Result<{ appointment: Appointment }> {
    this.tick();
    const w = this.state.waitlist.find((x) => x.id === requestId);
    if (!w || actor.kind !== "cliente" || w.customerId !== actor.customerId) throw new PermissionError();
    if (w.status !== "oferta_enviada" || !w.offer) return fail("sin_oferta", "La oferta ya no está vigente. Tu cita original no ha cambiado.");
    const lines = priceServicesFor(this.state, w.offer.staffId, w.serviceIds);
    if (!lines || !isSlotFree(this.state, w.offer.staffId, w.offer.start, totalDuration(lines), { ignoreHoldForWaitlistId: w.id }))
      return fail("hueco_no_disponible", "El hueco ya no está libre. Tu cita original no ha cambiado.");

    const original = w.originalAppointmentId ? this.appt(w.originalAppointmentId) : undefined;
    const location = this.state.locations.find((l) => l.businessId === w.businessId)!;
    const appointment: Appointment = {
      id: this.id("apt"),
      code: this.code("B"),
      businessId: w.businessId,
      locationId: original?.locationId ?? location.id,
      customerId: w.customerId,
      staffId: w.offer.staffId,
      start: w.offer.start,
      end: addMinutes(w.offer.start, totalDuration(lines)),
      status: "confirmada",
      services: lines,
      source: "lista_espera",
      qrToken: this.token(),
      createdAt: this.now(),
      history: [],
    };
    this.setStatus(appointment, "confirmada", actor, "desde lista de espera");
    this.state.appointments.push(appointment);
    w.status = "aceptada";
    w.resultAppointmentId = appointment.id;
    if (original && BLOCKING_STATUSES.includes(original.status) && ["confirmada", "modificada"].includes(original.status)) {
      this.setStatus(original, "cancelada", actor, `sustituida por ${appointment.code}`);
      // La preparación de la cita original acompaña a la nueva.
      const prep = this.state.preparations.find((p) => p.appointmentId === original.id);
      if (prep) this.state.preparations.push({ ...prep, appointmentId: appointment.id });
    }
    this.audit(actor, "lista_espera.aceptar", w.id, appointment.id);
    this.processWaitlist();
    this.commit();
    return { ok: true, appointment };
  }

  declineOffer(actor: Actor, requestId: ID) {
    const w = this.state.waitlist.find((x) => x.id === requestId);
    if (!w || actor.kind !== "cliente" || w.customerId !== actor.customerId) throw new PermissionError();
    if (w.status !== "oferta_enviada") return;
    w.status = "cancelada";
    this.audit(actor, "lista_espera.rechazar", w.id);
    this.processWaitlist();
    this.commit();
  }

  // ---------- gestión ----------

  addException(actor: Actor, input: { staffId: ID; start: string; end: string; kind: "bloqueo" | "ausencia" | "vacaciones" | "descanso"; note?: string }) {
    const staff = this.state.staff.find((s) => s.id === input.staffId);
    if (!staff || !canManageBusiness(actor, staff.businessId)) throw new PermissionError();
    this.state.exceptions.push({ id: this.id("exc"), ...input });
    this.audit(actor, "agenda.bloqueo", staff.id, `${input.start} – ${input.end}`);
    this.commit();
  }

  /** Cambiar un precio no altera citas ya reservadas ni el historial (guardan su copia). */
  updateServicePrice(actor: Actor, serviceId: ID, priceCents: number) {
    const s = this.state.services.find((x) => x.id === serviceId);
    if (!s || !canManageBusiness(actor, s.businessId)) throw new PermissionError();
    this.audit(actor, "catalogo.precio", s.id, `${s.priceCents} → ${priceCents}`);
    s.priceCents = priceCents;
    this.commit();
  }
}
