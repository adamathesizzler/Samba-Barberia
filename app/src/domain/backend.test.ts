// Criterios de aceptación del apartado 66 del documento maestro, probados sobre el backend de demostración.

import { beforeEach, describe, expect, it } from "vitest";
import { DemoBackend } from "./backend";
import { freeSlots, isSlotFree } from "./availability";
import { PermissionError } from "./permissions";
import { achievementsFor, customerSessions, loyaltyProgress, portfolioPhotos, sessionCard, visitRhythm } from "./queries";
import { createSeed, DEMO } from "./seed";
import { addMinutes } from "./time";
import type { Actor } from "./types";

// Un martes fijo para que los tests no dependan del día real.
const NOW = "2026-09-22T10:00";

const nico: Actor = { kind: "cliente", customerId: DEMO.customer };
const alex: Actor = { kind: "cliente", customerId: "cli_alex" };
const david: Actor = { kind: "staff", staffId: DEMO.david, businessId: DEMO.business, role: "barbero" };
const sara: Actor = { kind: "staff", staffId: DEMO.sara, businessId: DEMO.business, role: "barbero" };
const owner: Actor = { kind: "staff", staffId: DEMO.owner, businessId: DEMO.business, role: "propietario" };
const leo: Actor = { kind: "staff", staffId: DEMO.leo, businessId: DEMO.otherBusiness, role: "barbero" };

let now = NOW;
let be: DemoBackend;
const st = () => be.getState();
const nicoToday = () => st().appointments.find((a) => a.customerId === DEMO.customer && a.start === "2026-09-22T11:15")!;
const closeInput = (photoIds: string[] = []) => ({
  serviceIds: ["srv_degradado", "srv_barba"],
  adjustmentCents: 0,
  technicalNote: "Más volumen lateral.",
  maintenance: "",
  productsUsed: [],
  productsSold: [],
  photoIds,
  styleTitle: "Degradado bajo + barba",
  payment: "registrado_en_local" as const,
});

beforeEach(() => {
  now = NOW;
  be = new DemoBackend(createSeed(NOW), () => now);
});

const book = (actor: Actor, customerId: string, start: string, serviceIds = ["srv_corte"], staffId = DEMO.sara) =>
  be.book(actor, { businessId: DEMO.business, locationId: DEMO.location, customerId, staffId, serviceIds, start, source: "app" });

describe("reservas y agenda", () => {
  it("dos personas no obtienen el mismo hueco aunque lo vieran libre a la vez", () => {
    const slot = "2026-09-22T18:00";
    expect(freeSlots(st(), DEMO.sara, "2026-09-22", 30, now)).toContain(slot);
    const first = book(nico, DEMO.customer, slot);
    const second = book(alex, "cli_alex", slot);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("hueco_no_disponible");
    expect(st().appointments.filter((a) => a.start === slot && a.staffId === DEMO.sara)).toHaveLength(1);
  });

  it("no ofrece huecos fuera de jornada, en descansos ni que no permitan completar el servicio", () => {
    expect(isSlotFree(st(), DEMO.david, "2026-09-22T13:30", 30)).toBe(false); // descanso
    expect(isSlotFree(st(), DEMO.sara, "2026-09-22T13:45", 30)).toBe(false); // termina fuera de jornada
    expect(isSlotFree(st(), DEMO.sara, "2026-09-22T07:00", 30)).toBe(false);
  });

  it("cambiar el precio del catálogo no altera citas reservadas ni el historial", () => {
    const r = book(nico, DEMO.customer, "2026-09-22T18:00");
    const histBefore = customerSessions(st(), DEMO.customer).map((x) => x.finalCents);
    be.updateServicePrice(owner, "srv_corte", 9900);
    expect(r.ok && st().appointments.find((a) => a.id === r.appointment.id)!.services[0].priceCents).toBe(2200);
    expect(customerSessions(st(), DEMO.customer).map((x) => x.finalCents)).toEqual(histBefore);
  });

  it("un barbero no puede cambiar precios del catálogo", () => {
    expect(() => be.updateServicePrice(david, "srv_corte", 1)).toThrow(PermissionError);
  });

  it("un cliente no puede reservar en nombre de otro", () => {
    expect(() => book(nico, "cli_alex", "2026-09-22T18:00")).toThrow(PermissionError);
  });
});

describe("preparación de visita", () => {
  it("se guarda en la cita correcta y no afecta a otras", () => {
    const r = book(nico, DEMO.customer, "2026-09-25T17:00");
    if (!r.ok) throw new Error(r.message);
    be.savePreparation(nico, r.appointment.id, { mode: "quiero_cambiar", keep: "", change: "Probar texturizado", note: "", });
    expect(st().preparations.find((p) => p.appointmentId === r.appointment.id)?.change).toBe("Probar texturizado");
    expect(st().preparations.find((p) => p.appointmentId === nicoToday().id)?.change).toMatch(/laterales/);
  });

  it("marca el cambio si el profesional ya había visto la ficha", () => {
    be.markPreparationSeen(david, nicoToday().id);
    be.savePreparation(nico, nicoToday().id, { mode: "repetir_ultimo", keep: "Todo", change: "", note: "" });
    expect(st().preparations.find((p) => p.appointmentId === nicoToday().id)?.changedAfterSeen).toBe(true);
  });
});

describe("QR y check-in", () => {
  it("un QR válido registra la llegada una sola vez", () => {
    const token = nicoToday().qrToken;
    const a = be.checkIn(david, { token });
    const b = be.checkIn(david, { token });
    expect(a.ok && a.status).toBe("registrado");
    expect(b.ok && b.status).toBe("ya_registrado");
    expect(st().checkIns.filter((c) => c.appointmentId === nicoToday().id)).toHaveLength(1);
  });

  it("el check-in manual y el QR actualizan el mismo estado", () => {
    be.checkIn(david, { appointmentId: nicoToday().id });
    const again = be.checkIn(david, { token: nicoToday().qrToken });
    expect(again.ok && again.status).toBe("ya_registrado");
    expect(st().checkIns.filter((c) => c.appointmentId === nicoToday().id)).toHaveLength(1);
  });

  it("un QR cancelado o de otro negocio no da acceso", () => {
    const cancelled = st().appointments.find((a) => a.status === "cancelada")!;
    const r1 = be.checkIn(david, { token: cancelled.qrToken });
    expect(!r1.ok && r1.error).toBe("cancelada");
    const r2 = be.checkIn(leo, { token: nicoToday().qrToken });
    expect(!r2.ok && r2.error).toBe("otro_negocio");
    const r3 = be.checkIn(david, { token: "inventado" });
    expect(!r3.ok && r3.error).toBe("no_encontrado");
  });

  it("un cliente no puede registrar llegadas", () => {
    expect(() => be.checkIn(nico, { token: nicoToday().qrToken })).toThrow(PermissionError);
  });
});

describe("ficha y permisos", () => {
  it("un profesional no asignado no abre la ficha ni por identificador directo", () => {
    expect(() => sessionCard(st(), leo, nicoToday().id)).toThrow(PermissionError);
    expect(() => sessionCard(st(), sara, nicoToday().id)).toThrow(PermissionError);
    expect(sessionCard(st(), david, nicoToday().id)?.customer.name).toBe("Nico Ferrer");
  });

  it("la ficha solo muestra historial del propio negocio", () => {
    const card = sessionCard(st(), david, nicoToday().id)!;
    expect(card.history.every((h) => h.businessId === DEMO.business)).toBe(true);
    expect(customerSessions(st(), DEMO.customer).some((h) => h.businessId === DEMO.otherBusiness)).toBe(true);
  });

  it("las fotos privadas no aparecen en el portfolio", () => {
    const portfolio = portfolioPhotos(st(), DEMO.business);
    const withoutPermission = st().photos.filter((p) => !portfolio.includes(p) && p.businessId === DEMO.business && p.sessionId);
    expect(withoutPermission.length).toBeGreaterThan(0);
    const photo = withoutPermission[0];
    be.setPhotoPermission({ kind: "cliente", customerId: photo.customerId }, photo.id, "portfolio", true);
    expect(portfolioPhotos(st(), DEMO.business).map((p) => p.id)).toContain(photo.id);
    be.setPhotoPermission({ kind: "cliente", customerId: photo.customerId }, photo.id, "portfolio", false);
    expect(portfolioPhotos(st(), DEMO.business).map((p) => p.id)).not.toContain(photo.id);
  });
});

describe("cierre de sesión", () => {
  it("no se puede cerrar sin llegada registrada", () => {
    const r = be.closeSession(david, nicoToday().id, closeInput());
    expect(!r.ok && r.error).toBe("sin_llegada");
  });

  it("se puede cerrar sin fotos y repetir el cierre no duplica sesión, gasto ni progreso", () => {
    be.checkIn(david, { token: nicoToday().qrToken });
    const before = loyaltyProgress(st(), DEMO.customer, DEMO.business)!.total;
    const a = be.closeSession(david, nicoToday().id, closeInput());
    const b = be.closeSession(david, nicoToday().id, closeInput());
    expect(a.ok && a.duplicated).toBe(false);
    expect(b.ok && b.duplicated).toBe(true);
    expect(st().sessions.filter((s) => s.appointmentId === nicoToday().id)).toHaveLength(1);
    expect(loyaltyProgress(st(), DEMO.customer, DEMO.business)!.total).toBe(before + 1);
  });

  it("la décima visita del ciclo desbloquea una recompensa, y solo una", () => {
    be.checkIn(david, { token: nicoToday().qrToken });
    const r = be.closeSession(david, nicoToday().id, closeInput());
    expect(r.ok && r.newRewards).toHaveLength(1);
    be.closeSession(david, nicoToday().id, closeInput());
    expect(st().rewards.filter((x) => x.customerId === DEMO.customer && x.status === "disponible")).toHaveLength(1);
  });

  it("una subida fallida no se guarda en la sesión", () => {
    be.checkIn(david, { token: nicoToday().qrToken });
    const ok = be.uploadPhoto(david, { appointmentId: nicoToday().id, view: "frontal" });
    const bad = be.uploadPhoto(david, { appointmentId: nicoToday().id, view: "lateral_izq", simulateFailure: true });
    expect(bad.ok).toBe(false);
    const failed = st().photos.find((p) => p.status === "fallida")!;
    const r = be.closeSession(david, nicoToday().id, closeInput([ok.ok ? ok.photo.id : "", failed.id]));
    expect(r.ok && r.session.photoIds).toEqual([ok.ok && ok.photo.id]);
  });

  it("una corrección queda registrada sin crear otra visita", () => {
    be.checkIn(david, { token: nicoToday().qrToken });
    const r = be.closeSession(david, nicoToday().id, closeInput());
    if (!r.ok) throw new Error();
    const count = st().sessions.length;
    be.correctSessionAmount(david, r.session.id, 3000, "extra de cejas acordado");
    expect(st().sessions).toHaveLength(count);
    expect(st().sessions.find((s) => s.id === r.session.id)!.corrections).toHaveLength(1);
  });

  it("una cita cancelada no suma visita", () => {
    const before = loyaltyProgress(st(), DEMO.customer, DEMO.business)!.total;
    be.cancel(nico, nicoToday().id);
    expect(be.closeSession(david, nicoToday().id, closeInput()).ok).toBe(false);
    expect(loyaltyProgress(st(), DEMO.customer, DEMO.business)!.total).toBe(before);
  });

  it("repetir un estilo usa el precio actual, no el histórico", () => {
    be.updateServicePrice(owner, "srv_degradado", 2600);
    const r = be.book(nico, { businessId: DEMO.business, locationId: DEMO.location, customerId: DEMO.customer, staffId: DEMO.david, serviceIds: ["srv_degradado"], start: "2026-09-24T17:00", source: "app" });
    expect(r.ok && r.appointment.services[0].priceCents).toBe(2600);
  });
});

describe("recompensas", () => {
  it("un premio no se canjea dos veces ni por otro cliente", () => {
    be.checkIn(david, { token: nicoToday().qrToken });
    const r = be.closeSession(david, nicoToday().id, closeInput());
    const reward = r.ok ? r.newRewards[0] : undefined;
    expect(reward).toBeDefined();
    const wrong = be.redeemReward(david, reward!.redeemCode, "cli_alex");
    expect(!wrong.ok && wrong.error).toBe("otro_cliente");
    expect(be.redeemReward(david, reward!.redeemCode, DEMO.customer).ok).toBe(true);
    const twice = be.redeemReward(david, reward!.redeemCode, DEMO.customer);
    expect(!twice.ok && twice.error).toBe("ya_utilizada");
  });

  it("las recompensas vencidas caducan", () => {
    be.checkIn(david, { token: nicoToday().qrToken });
    const r = be.closeSession(david, nicoToday().id, closeInput());
    now = addMinutes(NOW, 60 * 24 * 91);
    be.tick();
    const reward = st().rewards.find((x) => r.ok && x.id === r.newRewards[0].id)!;
    expect(reward.status).toBe("caducada");
  });

  it("los logros se basan en visitas reales", () => {
    const ach = achievementsFor(st(), DEMO.customer, DEMO.business);
    expect(ach.find((a) => a.achievement.id === "ach_signature")?.state).toBe("conseguido");
    expect(ach.find((a) => a.achievement.id === "ach_loyal")?.state).toBe("en_progreso");
  });
});

describe("lista de espera", () => {
  const fillSara = () => {
    // Ocupa toda la tarde de Sara con reservas de Alex.
    let t = "2026-09-23T15:00";
    while (t < "2026-09-23T20:00") {
      book(alex, "cli_alex", t);
      t = addMinutes(t, 45);
    }
  };

  it("mantiene la cita original hasta aceptar, y no ofrece el mismo hueco dos veces", () => {
    fillSara();
    const orig = book(nico, DEMO.customer, "2026-09-25T17:00");
    if (!orig.ok) throw new Error(orig.message);
    const w1 = be.joinWaitlist(nico, { customerId: DEMO.customer, businessId: DEMO.business, serviceIds: ["srv_corte"], staffIds: [DEMO.sara], date: "2026-09-23", timeFrom: "15:00", timeTo: "20:00", originalAppointmentId: orig.appointment.id });
    const w2 = be.joinWaitlist({ kind: "cliente", customerId: "cli_marco" }, { customerId: "cli_marco", businessId: DEMO.business, serviceIds: ["srv_corte"], staffIds: [DEMO.sara], date: "2026-09-23", timeFrom: "15:00", timeTo: "20:00" });
    expect(w1.ok && st().waitlist.find((w) => w.id === w1.request.id)!.status).toBe("activa");

    const toFree = st().appointments.find((a) => a.customerId === "cli_alex" && a.start === "2026-09-23T15:45")!;
    be.cancel(alex, toFree.id);
    const req1 = st().waitlist.find((w) => w1.ok && w.id === w1.request.id)!;
    const req2 = st().waitlist.find((w) => w2.ok && w.id === w2.request.id)!;
    expect(req1.status).toBe("oferta_enviada");
    expect(req2.status).toBe("activa");
    expect(st().appointments.find((a) => a.id === orig.appointment.id)!.status).toBe("confirmada");

    be.declineOffer(nico, req1.id);
    expect(st().appointments.find((a) => a.id === orig.appointment.id)!.status).toBe("confirmada");
    expect(st().waitlist.find((w) => w.id === req2.id)!.status).toBe("oferta_enviada");
  });

  it("al aceptar crea la nueva cita y solo entonces cancela la original", () => {
    fillSara();
    const orig = book(nico, DEMO.customer, "2026-09-25T17:00");
    if (!orig.ok) throw new Error(orig.message);
    const w = be.joinWaitlist(nico, { customerId: DEMO.customer, businessId: DEMO.business, serviceIds: ["srv_corte"], staffIds: [DEMO.sara], date: "2026-09-23", timeFrom: "15:00", timeTo: "20:00", originalAppointmentId: orig.appointment.id });
    be.cancel(alex, st().appointments.find((a) => a.customerId === "cli_alex" && a.start === "2026-09-23T15:45")!.id);
    const r = be.acceptOffer(nico, w.ok ? w.request.id : "");
    expect(r.ok).toBe(true);
    expect(st().appointments.find((a) => a.id === orig.appointment.id)!.status).toBe("cancelada");
  });

  it("una oferta caducada no cancela nada", () => {
    fillSara();
    const orig = book(nico, DEMO.customer, "2026-09-25T17:00");
    if (!orig.ok) throw new Error(orig.message);
    const w = be.joinWaitlist(nico, { customerId: DEMO.customer, businessId: DEMO.business, serviceIds: ["srv_corte"], staffIds: [DEMO.sara], date: "2026-09-23", timeFrom: "15:00", timeTo: "20:00", originalAppointmentId: orig.appointment.id });
    be.cancel(alex, st().appointments.find((a) => a.customerId === "cli_alex" && a.start === "2026-09-23T15:45")!.id);
    now = addMinutes(NOW, 45);
    const r = be.acceptOffer(nico, w.ok ? w.request.id : "");
    expect(r.ok).toBe(false);
    expect(st().appointments.find((a) => a.id === orig.appointment.id)!.status).toBe("confirmada");
  });
});

describe("datos derivados", () => {
  it("no inventa ritmo de visitas sin historial suficiente", () => {
    expect(visitRhythm(st(), "cli_samuel", now)).toBeNull();
    expect(visitRhythm(st(), DEMO.customer, now)?.avgDays).toBeGreaterThan(20);
  });

  it("un cliente sin reserva queda registrado con la llegada hecha", () => {
    now = "2026-09-22T11:30";
    const r = be.walkIn(sara, { name: "Paso por aquí", staffId: DEMO.sara, serviceIds: ["srv_corte"] });
    expect(r.ok && r.appointment.status).toBe("llegada");
    expect(r.ok && st().customers.find((c) => c.id === r.appointment.customerId)?.guest).toBe(true);
  });

  it("no registra un cliente sin reserva si el profesional está ocupado", () => {
    const r = be.walkIn(sara, { name: "Paso por aquí", staffId: DEMO.sara, serviceIds: ["srv_corte"] });
    expect(!r.ok && r.error).toBe("hueco_no_disponible");
  });
});
