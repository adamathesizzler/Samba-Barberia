// Datos de DEMOSTRACIÓN. Personas, barberías, importes y reglas son ficticios y
// coherentes entre sí; no son condiciones comerciales aprobadas.

import { addDays, addMinutes, datePart, toLocal, weekday } from "./time";
import type { Appointment, DemoState, Photo, PhotoView, ServiceLine, Session, WeeklySchedule } from "./types";

const WEEK: WeeklySchedule = {
  1: [{ start: "09:00", end: "14:00" }, { start: "15:00", end: "20:00" }],
  2: [{ start: "09:00", end: "14:00" }, { start: "15:00", end: "20:00" }],
  3: [{ start: "09:00", end: "14:00" }, { start: "15:00", end: "20:00" }],
  4: [{ start: "09:00", end: "14:00" }, { start: "15:00", end: "20:00" }],
  5: [{ start: "09:00", end: "14:00" }, { start: "15:00", end: "20:00" }],
  6: [{ start: "09:00", end: "14:00" }],
};

/** Día de demostración: hoy, o el lunes si hoy es domingo (cerrado). */
export function demoToday(real = new Date()): string {
  const d = new Date(real);
  d.setHours(10, 0, 0, 0);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return toLocal(d);
}

/** Sube cuando cambia la forma de los datos: la demo guardada en el navegador se regenera. */
export const SEED_VERSION = 5;

/** Fotos de muestra (Unsplash) para las subidas que se simulan en la demo. */
export const DEMO_UPLOAD_POOL = ["cut-fade", "cut-top", "cut-barber", "cut-beard"];

const NICO_POOL: Record<string, string[]> = {
  frontal: ["nico", "cut-top", "cut-fade"],
  lateral_izq: ["cut-barber", "cut-beard"],
  lateral_der: ["shave", "cut-beard"],
};
const CUSTOMER_LOOKS: Record<string, string[]> = {
  cli_alex: ["look-crop", "look-quiff"],
  cli_marco: ["look-quiff", "look-smart"],
  cli_samuel: ["look-classic", "look-side"],
  cli_iker: ["look-curly-beard", "look-afro"],
  cli_joel: ["look-buzz-beard", "look-beard"],
};

export const DEMO = {
  business: "biz_norte",
  otherBusiness: "biz_sur",
  location: "loc_norte",
  customer: "cli_nico",
  david: "stf_david",
  sara: "stf_sara",
  owner: "stf_marta",
  leo: "stf_leo",
};

export function createSeed(now: string): DemoState {
  const today = datePart(now);
  let seq = 1000;
  const id = (p: string) => `${p}_${(seq++).toString(36)}`;
  const token = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  let codeN = 24090;
  const code = () => `B${codeN++}`;

  const s: DemoState = {
    version: SEED_VERSION,
    businesses: [
      { id: DEMO.business, name: "Barbería Norte", isDemo: true },
      { id: DEMO.otherBusiness, name: "Estudio Sur", isDemo: true },
    ],
    locations: [
      { id: DEMO.location, businessId: DEMO.business, name: "Norte · Centro", address: "Calle Mayor 12" },
      { id: "loc_sur", businessId: DEMO.otherBusiness, name: "Sur · Mercado", address: "Plaza del Mercado 3" },
    ],
    staff: [
      {
        id: DEMO.david, photo: "staff-david", businessId: DEMO.business, locationIds: [DEMO.location], name: "David", role: "barbero",
        bio: "Degradados limpios y barbas con contorno natural.", specialties: ["Degradados", "Barba"], hue: 24,
        schedule: WEEK, bufferMin: 5, active: true,
      },
      {
        id: DEMO.sara, photo: "staff-sara", businessId: DEMO.business, locationIds: [DEMO.location], name: "Sara", role: "barbero",
        bio: "Color, texturas y trenzas.", specialties: ["Color", "Trenzas", "Tijera"], hue: 200,
        schedule: WEEK, bufferMin: 5, active: true,
      },
      {
        id: DEMO.owner, photo: "staff-marta", businessId: DEMO.business, locationIds: [DEMO.location], name: "Marta", role: "propietario",
        bio: "Propietaria.", specialties: [], hue: 320, schedule: {}, bufferMin: 0, active: true,
      },
      {
        id: DEMO.leo, photo: "staff-leo", businessId: DEMO.otherBusiness, locationIds: ["loc_sur"], name: "Leo", role: "barbero",
        bio: "Barbero en otro establecimiento de demostración.", specialties: ["Corte clásico"], hue: 140,
        schedule: WEEK, bufferMin: 5, active: true,
      },
    ],
    services: [
      { id: "srv_corte", businessId: DEMO.business, name: "Corte", category: "corte", durationMin: 30, priceCents: 2200, priceKind: "fijo", active: true },
      { id: "srv_degradado", businessId: DEMO.business, name: "Degradado", category: "degradado", durationMin: 35, priceCents: 2400, priceKind: "fijo", active: true },
      { id: "srv_barba", businessId: DEMO.business, name: "Barba", category: "barba", durationMin: 15, priceCents: 1000, priceKind: "fijo", active: true },
      { id: "srv_cejas", businessId: DEMO.business, name: "Cejas", category: "cejas", durationMin: 10, priceCents: 500, priceKind: "fijo", active: true },
      { id: "srv_color", businessId: DEMO.business, name: "Color", category: "color", durationMin: 60, priceCents: 3500, priceKind: "desde", active: true },
      { id: "srv_trenzas", businessId: DEMO.business, name: "Trenzas", category: "trenzas", durationMin: 90, priceCents: 4500, priceKind: "desde", active: true },
      { id: "srv_trat", businessId: DEMO.business, name: "Tratamiento capilar", category: "tratamiento", durationMin: 20, priceCents: 1500, priceKind: "fijo", active: true },
      { id: "srv_sur_corte", businessId: DEMO.otherBusiness, name: "Corte clásico", category: "corte", durationMin: 30, priceCents: 1900, priceKind: "fijo", active: true },
    ],
    staffServices: [
      ...["srv_corte", "srv_degradado", "srv_barba", "srv_cejas"].map((serviceId) => ({ staffId: DEMO.david, serviceId })),
      ...["srv_corte", "srv_degradado", "srv_cejas", "srv_color", "srv_trenzas", "srv_trat"].map((serviceId) => ({ staffId: DEMO.sara, serviceId })),
      // Sara tarda algo más en el degradado: la duración puede variar por profesional.
      { staffId: DEMO.sara, serviceId: "srv_barba", durationMin: 20 },
      { staffId: DEMO.leo, serviceId: "srv_sur_corte" },
    ],
    exceptions: [],
    customers: [
      {
        id: DEMO.customer, businessIds: [DEMO.business, DEMO.otherBusiness], name: "Nico Ferrer", phone: "600 000 000", hue: 28, photo: "nico", guest: false,
        preferredStaffId: DEMO.david, sessionStyle: { tranquila: true, explicarCambios: false, consultarAntes: true }, savedPhotoIds: [],
      },
      ...["Alex", "Marco", "Samuel", "Iker", "Joel"].map((name, i) => ({
        id: `cli_${name.toLowerCase()}`, businessIds: [DEMO.business], name, hue: 60 * i + 10, photo: CUSTOMER_LOOKS[`cli_${name.toLowerCase()}`][0], guest: false,
        sessionStyle: { tranquila: false, explicarCambios: false, consultarAntes: false },
        savedPhotoIds: [],
      })),
    ],
    appointments: [],
    preparations: [],
    checkIns: [],
    sessions: [],
    photos: [],
    photoPermissions: [],
    styleEntries: [],
    feedback: [],
    preferences: [
      { id: "pref_1", customerId: DEMO.customer, label: "Degradado", value: "Bajo", origin: "cliente", confirmed: true },
      { id: "pref_2", customerId: DEMO.customer, label: "Laterales", value: "Máquina 1,5", origin: "profesional", confirmed: true },
      { id: "pref_3", customerId: DEMO.customer, label: "Barba", value: "Perfilada, 3 mm", origin: "cliente", confirmed: true },
      { id: "pref_4", customerId: DEMO.customer, label: "Acabado", value: "Cera mate", origin: "profesional", confirmed: false },
    ],
    achievements: [
      { id: "ach_regular", businessId: DEMO.business, name: "Regular", description: "5 visitas atendidas", threshold: 5 },
      { id: "ach_signature", businessId: DEMO.business, name: "Signature", description: "10 visitas atendidas", threshold: 10 },
      { id: "ach_loyal", businessId: DEMO.business, name: "Loyal", description: "25 visitas atendidas", threshold: 25 },
    ],
    loyaltyPrograms: [
      {
        businessId: DEMO.business, unit: "visitas", goal: 10, rewardName: "Corte gratis",
        rewardBenefit: "Un servicio de Corte sin coste",
        rewardConditions: "Solo el servicio Corte; extras aparte. Válido en Norte · Centro.",
        validDays: 90,
      },
    ],
    loyaltyMovements: [],
    rewards: [],
    waitlist: [],
    audit: [],
    seq: 1,
  };

  const svc = (ids: string[], staffId = DEMO.david): ServiceLine[] =>
    ids.map((sid) => {
      const sv = s.services.find((x) => x.id === sid)!;
      const link = s.staffServices.find((l) => l.staffId === staffId && l.serviceId === sid);
      return { serviceId: sid, name: sv.name, durationMin: link?.durationMin ?? sv.durationMin, priceCents: sv.priceCents, priceKind: sv.priceKind };
    });

  const addAppt = (a: Partial<Appointment> & Pick<Appointment, "customerId" | "staffId" | "start" | "services" | "status">) => {
    const dur = a.services.reduce((x, l) => x + l.durationMin, 0);
    const appt: Appointment = {
      id: id("apt"), code: code(), businessId: DEMO.business, locationId: DEMO.location, source: "app", qrToken: token(),
      createdAt: addDays(a.start, -5), history: [{ at: addDays(a.start, -5), status: "confirmada", by: "sistema (datos demo)" }],
      end: addMinutes(a.start, dur), ...a,
    };
    s.appointments.push(appt);
    return appt;
  };

  const photo = (appt: Appointment, sessionId: string, view: PhotoView, hue: number, portfolio: boolean): Photo => {
    const n = s.photos.length;
    const pool = appt.customerId === DEMO.customer
      ? appt.businessId === DEMO.otherBusiness ? ["look-bw"] : NICO_POOL[view] ?? NICO_POOL.frontal
      : CUSTOMER_LOOKS[appt.customerId] ?? ["look-casual"];
    const p: Photo = {
      id: id("pho"), businessId: appt.businessId, customerId: appt.customerId, sessionId, appointmentId: appt.id,
      view, source: "profesional", uploadedBy: appt.staffId, at: appt.end, hue, img: pool[n % pool.length], status: "subida",
    };
    s.photos.push(p);
    s.photoPermissions.push({ photoId: p.id, purpose: "historial_privado", granted: true, at: appt.end, by: "sistema" });
    if (portfolio) s.photoPermissions.push({ photoId: p.id, purpose: "portfolio", granted: true, at: appt.end, by: appt.customerId });
    return p;
  };

  const completed = (
    appt: Appointment,
    opts: { title: string; photos: number; portfolio?: boolean; note?: string; maint?: string; sold?: Session["productsSold"]; extra?: number },
  ) => {
    appt.status = "completada";
    appt.history.push({ at: appt.end, status: "completada", by: "sistema (datos demo)" });
    s.checkIns.push({ id: id("chk"), appointmentId: appt.id, staffId: appt.staffId, at: appt.start, method: "qr" });
    const sessionId = id("ses");
    const views: PhotoView[] = ["frontal", "lateral_izq", "lateral_der"];
    const photos = Array.from({ length: opts.photos }, (_, i) => photo(appt, sessionId, views[i % 3], (appt.start.length * 7 + i * 40 + s.photos.length * 23) % 360, !!opts.portfolio));
    const total = appt.services.reduce((a, l) => a + l.priceCents, 0);
    s.sessions.push({
      id: sessionId, appointmentId: appt.id, businessId: appt.businessId, customerId: appt.customerId, staffId: appt.staffId,
      completedAt: appt.end, services: appt.services, estimatedCents: total, finalCents: total + (opts.extra ?? 0),
      durationMin: appt.services.reduce((a, l) => a + l.durationMin, 0), technicalNote: opts.note ?? "", maintenance: opts.maint ?? "",
      productsUsed: ["Cera mate"], productsSold: opts.sold ?? [], photoIds: photos.map((p) => p.id), payment: "registrado_en_local",
      closedBy: appt.staffId, corrections: [],
    });
    const cat = s.services.find((x) => x.id === appt.services[0].serviceId)?.category ?? "corte";
    s.styleEntries.push({ id: id("sty"), customerId: appt.customerId, sessionId, title: opts.title, category: cat, coverPhotoId: photos[0]?.id, favorite: false, wantAgain: false });
    if (appt.businessId === DEMO.business)
      s.loyaltyMovements.push({ id: id("mov"), customerId: appt.customerId, businessId: appt.businessId, sessionId, delta: 1, reason: "visita atendida", at: appt.end });
    return sessionId;
  };

  const workday = (d: string) => {
    let x = d;
    while (weekday(x) === 0) x = addDays(x, -1);
    return x;
  };

  // --- Historial de Nico: 19 visitas en Norte, aproximadamente cada 24 días ---
  const titles = ["Low taper + barba", "Textured crop", "Corte clásico + barba", "Mid fade", "Fade + barba", "Crop texturizado", "Degradado bajo + barba"];
  let lastNicoSession = "";
  for (let i = 19; i >= 1; i--) {
    const day = workday(addDays(`${today}T18:30`, -i * 24 + (i % 3) - 1));
    const ids = i % 4 === 2 ? ["srv_corte", "srv_barba"] : i % 5 === 0 ? ["srv_degradado"] : ["srv_degradado", "srv_barba"];
    const appt = addAppt({ customerId: DEMO.customer, staffId: DEMO.david, start: `${datePart(day)}T${weekday(day) === 6 ? "12:30" : "18:30"}`, services: svc(ids), status: "confirmada" });
    lastNicoSession = completed(appt, {
      title: titles[i % titles.length],
      photos: i % 6 === 0 ? 0 : i === 1 ? 3 : 2,
      // Solo un par de visitas de Nico autorizadas para el portfolio.
      portfolio: i === 3 || i === 9,
      note: "Laterales a 1,5; transición baja; arriba solo repasar puntas.",
      maint: "Secar hacia atrás con los dedos. Cera mate, poca cantidad. Perfilar barba cada 10 días.",
      sold: i === 4 ? [{ name: "Cera mate 75 ml", qty: 1, priceCents: 1400 }] : [],
    });
  }
  // Recompensa conseguida a las 10 visitas y ya utilizada.
  const tenth = s.sessions.filter((x) => x.customerId === DEMO.customer)[9];
  s.rewards.push({
    id: "rew_used", businessId: DEMO.business, customerId: DEMO.customer, name: "Corte gratis", benefit: "Un servicio de Corte sin coste",
    conditions: s.loyaltyPrograms[0].rewardConditions, origin: "10 visitas completadas", status: "utilizada", createdAt: tenth.completedAt,
    expiresAt: addDays(tenth.completedAt, 90), redeemCode: "R10001", redeemedAt: addDays(tenth.completedAt, 24), redeemedBy: DEMO.david,
  });
  const lastEntry = s.styleEntries.find((e) => e.sessionId === lastNicoSession)!;
  lastEntry.favorite = true;
  s.styleEntries.filter((e) => e.customerId === DEMO.customer).slice(3, 5).forEach((e) => (e.favorite = true));
  s.feedback.push({
    id: "fb_1", customerId: DEMO.customer, sessionId: lastNicoSession, kind: "comentario_visita",
    liked: "La longitud de arriba y la barba.", change: "No subir tanto el degradado; dejar más volumen lateral.",
    author: "cliente", authorId: DEMO.customer, at: addDays(now, -20),
  });

  // Una visita en otro establecimiento: pertenece al historial de Nico, no a Norte.
  const surAppt: Appointment = {
    id: id("apt"), code: code(), businessId: DEMO.otherBusiness, locationId: "loc_sur", customerId: DEMO.customer, staffId: DEMO.leo,
    start: `${datePart(workday(addDays(now, -60)))}T11:00`, end: `${datePart(workday(addDays(now, -60)))}T11:30`, status: "confirmada",
    services: [{ serviceId: "srv_sur_corte", name: "Corte clásico", durationMin: 30, priceCents: 1900, priceKind: "fijo" }],
    source: "web", qrToken: token(), createdAt: addDays(now, -65), history: [],
  };
  s.appointments.push(surAppt);
  completed(surAppt, { title: "Corte clásico", photos: 1 });

  // --- Portfolio de otros clientes (fotos autorizadas para Explorar) ---
  const others = ["cli_alex", "cli_marco", "cli_samuel", "cli_iker", "cli_joel"];
  others.forEach((cid, i) => {
    const staffId = i % 2 ? DEMO.sara : DEMO.david;
    const ids = staffId === DEMO.sara ? [["srv_color"], ["srv_trenzas"], ["srv_corte", "srv_trat"]][i % 3] : [["srv_degradado", "srv_barba"], ["srv_degradado"], ["srv_corte", "srv_barba"]][i % 3];
    const day = workday(addDays(now, -(8 + i * 5)));
    const appt = addAppt({ customerId: cid, staffId, start: `${datePart(day)}T${10 + i}:00`, services: svc(ids, staffId), status: "confirmada" });
    completed(appt, { title: ["Textured crop", "Quiff clásico", "Corte clásico", "Rizos + barba", "Buzz cut + barba"][i], photos: 2, portfolio: true });
  });

  // --- Agenda de hoy (hora de demostración 10:00) ---
  const at = (t: string) => `${today}T${t}`;
  const alex = addAppt({ customerId: "cli_alex", staffId: DEMO.david, start: at("09:00"), services: svc(["srv_degradado"]), status: "confirmada" });
  completed(alex, { title: "Degradado", photos: 0 });
  const marco = addAppt({ customerId: "cli_marco", staffId: DEMO.david, start: at("09:45"), services: svc(["srv_corte"]), status: "en_atencion" });
  s.checkIns.push({ id: id("chk"), appointmentId: marco.id, staffId: DEMO.david, at: at("09:43"), method: "qr" });
  addAppt({ customerId: "cli_samuel", staffId: DEMO.david, start: at("10:30"), services: svc(["srv_corte"]), status: "confirmada", source: "telefono" });
  const nicoToday = addAppt({ customerId: DEMO.customer, staffId: DEMO.david, start: at("11:15"), services: svc(["srv_degradado", "srv_barba"]), status: "confirmada" });
  addAppt({ customerId: "cli_iker", staffId: DEMO.david, start: at("12:30"), services: svc(["srv_corte"]), status: "cancelada" });
  addAppt({ customerId: "cli_joel", staffId: DEMO.sara, start: at("10:00"), services: svc(["srv_color"], DEMO.sara), status: "confirmada" });
  if (weekday(now) !== 6) addAppt({ customerId: "cli_iker", staffId: DEMO.sara, start: at("16:00"), services: svc(["srv_trenzas"], DEMO.sara), status: "confirmada" });
  s.exceptions.push({ id: "exc_break", staffId: DEMO.david, start: at("13:15"), end: at("14:00"), kind: "descanso", note: "Pausa" });

  s.preparations.push({
    appointmentId: nicoToday.id, mode: "repetir_ultimo", styleEntryId: lastEntry.id, keep: "La longitud de arriba y la barba.",
    change: "Dejar más longitud en los laterales; no subir tanto el degradado.", note: "", updatedAt: addDays(now, -1), changedAfterSeen: false,
  });

  s.seq = seq;
  return s;
}
