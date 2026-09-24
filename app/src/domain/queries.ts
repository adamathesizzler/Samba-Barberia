// Lecturas derivadas. Nunca inventan datos: si no hay suficiente información devuelven null.

import { canViewCustomerInBusiness, hasPhotoPermission, PermissionError } from "./permissions";
import { datePart, daysBetween } from "./time";
import type { Actor, Appointment, DemoState, ID, Photo, Session } from "./types";

const ACTIVE: Appointment["status"][] = ["confirmada", "modificada", "llegada", "en_atencion"];

export function upcomingAppointments(s: DemoState, customerId: ID, now: string): Appointment[] {
  return s.appointments
    .filter((a) => a.customerId === customerId && ACTIVE.includes(a.status) && (a.end > now || a.status !== "confirmada"))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function customerSessions(s: DemoState, customerId: ID, businessId?: ID): Session[] {
  return s.sessions
    .filter((x) => x.customerId === customerId && (!businessId || x.businessId === businessId))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export function sessionPhotos(s: DemoState, session: Session): Photo[] {
  return session.photoIds.map((id) => s.photos.find((p) => p.id === id)!).filter((p) => p && p.status === "subida");
}

export function loyaltyProgress(s: DemoState, customerId: ID, businessId: ID) {
  const program = s.loyaltyPrograms.find((p) => p.businessId === businessId);
  if (!program) return null;
  const total = s.loyaltyMovements.filter((m) => m.customerId === customerId && m.businessId === businessId).reduce((a, m) => a + m.delta, 0);
  const inCycle = total % program.goal;
  return { program, total, inCycle, remaining: program.goal - inCycle };
}

export function achievementsFor(s: DemoState, customerId: ID, businessId: ID) {
  const sessions = customerSessions(s, customerId, businessId).slice().reverse();
  return s.achievements
    .filter((a) => a.businessId === businessId)
    .map((a) => {
      const reached = sessions.length >= a.threshold;
      return {
        achievement: a,
        count: Math.min(sessions.length, a.threshold),
        state: reached ? ("conseguido" as const) : sessions.length > 0 ? ("en_progreso" as const) : ("bloqueado" as const),
        reachedAt: reached ? sessions[a.threshold - 1].completedAt : undefined,
      };
    });
}

/**
 * Ritmo de visitas observado. Solo con 3 o más visitas: con menos datos
 * no se inventa una frecuencia personalizada.
 */
export function visitRhythm(s: DemoState, customerId: ID, now: string) {
  const sessions = customerSessions(s, customerId).slice().reverse();
  if (sessions.length < 3) return null;
  const gaps = sessions.slice(1).map((x, i) => daysBetween(sessions[i].completedAt, x.completedAt));
  const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const since = daysBetween(sessions.at(-1)!.completedAt, now);
  return { avgDays: avg, daysSinceLast: since, basedOn: sessions.length };
}

export function spendingSummary(s: DemoState, customerId: ID, year: number) {
  const sessions = customerSessions(s, customerId).filter((x) => x.completedAt.startsWith(String(year)));
  const services = sessions.reduce((a, x) => a + x.finalCents, 0);
  const products = sessions.reduce((a, x) => a + x.productsSold.reduce((b, p) => b + p.priceCents * p.qty, 0), 0);
  const counts = new Map<string, number>();
  sessions.forEach((x) => x.services.forEach((l) => counts.set(l.name, (counts.get(l.name) ?? 0) + 1)));
  return {
    visits: sessions.length,
    servicesCents: services,
    productsCents: products,
    totalCents: services + products,
    averageCents: sessions.length ? Math.round(services / sessions.length) : 0,
    topServices: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
  };
}

export function staffAgenda(s: DemoState, staffId: ID, date: string) {
  return s.appointments.filter((a) => a.staffId === staffId && datePart(a.start) === date).sort((a, b) => a.start.localeCompare(b.start));
}

/** Portfolio: solo fotos con autorización vigente de portfolio. */
export function portfolioPhotos(s: DemoState, businessId: ID, staffId?: ID) {
  return s.photos.filter((p) => {
    if (p.status !== "subida" || p.businessId !== businessId || !p.sessionId) return false;
    if (!hasPhotoPermission(s, p.id, "portfolio")) return false;
    if (!staffId) return true;
    return s.sessions.find((x) => x.id === p.sessionId)?.staffId === staffId;
  });
}

/** Ficha de sesión para el profesional. Lanza PermissionError si no le corresponde. */
export function sessionCard(s: DemoState, actor: Actor, appointmentId: ID) {
  const appt = s.appointments.find((a) => a.id === appointmentId);
  if (!appt) return null;
  if (actor.kind !== "staff" || !canViewCustomerInBusiness(s, actor, appt.customerId, appt.businessId)) throw new PermissionError();
  if (actor.role === "barbero" && appt.staffId !== actor.staffId) throw new PermissionError();
  const customer = s.customers.find((c) => c.id === appt.customerId)!;
  // Solo historial de ESTE negocio: una referencia de otro establecimiento no abre su historial.
  const history = customerSessions(s, customer.id, appt.businessId).filter((x) => x.appointmentId !== appt.id);
  const last = history[0];
  const prep = s.preparations.find((p) => p.appointmentId === appt.id);
  const prepStyle = prep?.styleEntryId ? s.styleEntries.find((e) => e.id === prep.styleEntryId) : undefined;
  const refPhotoId = prep?.referencePhotoId ?? prepStyle?.coverPhotoId;
  return {
    appt,
    customer,
    last,
    lastPhotos: last ? sessionPhotos(s, last) : [],
    daysSinceLast: last ? daysBetween(last.completedAt, appt.start) : null,
    prep,
    prepStyle,
    referencePhoto: refPhotoId ? s.photos.find((p) => p.id === refPhotoId) : undefined,
    preferences: s.preferences.filter((p) => p.customerId === customer.id),
    feedback: s.feedback.filter((f) => f.customerId === customer.id && history.some((h) => h.id === f.sessionId)).slice(-3),
    history,
  };
}
