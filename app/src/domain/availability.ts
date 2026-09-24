import type { Appointment, DemoState, ID, ServiceLine } from "./types";
import { addMinutes, datePart, overlaps, weekday } from "./time";

const SLOT_STEP_MIN = 15;

/** Estados que ocupan hueco en la agenda. */
export const BLOCKING_STATUSES: Appointment["status"][] = ["confirmada", "modificada", "llegada", "en_atencion", "completada"];

/** Líneas de servicio con la duración y el precio de este profesional, según el catálogo actual. */
export function priceServicesFor(state: DemoState, staffId: ID, serviceIds: ID[]): ServiceLine[] | null {
  const lines: ServiceLine[] = [];
  for (const serviceId of serviceIds) {
    const service = state.services.find((s) => s.id === serviceId && s.active);
    const link = state.staffServices.find((l) => l.staffId === staffId && l.serviceId === serviceId);
    if (!service || !link) return null;
    lines.push({
      serviceId,
      name: service.name,
      durationMin: link.durationMin ?? service.durationMin,
      priceCents: link.priceCents ?? service.priceCents,
      priceKind: service.priceKind,
    });
  }
  return lines;
}

export const totalDuration = (lines: ServiceLine[]) => lines.reduce((a, l) => a + l.durationMin, 0);
export const totalPrice = (lines: ServiceLine[]) => lines.reduce((a, l) => a + l.priceCents, 0);

/** Profesionales activos que pueden hacer todos los servicios pedidos. */
export function staffForServices(state: DemoState, businessId: ID, serviceIds: ID[]) {
  return state.staff.filter(
    (s) =>
      s.active &&
      s.businessId === businessId &&
      s.role !== "propietario" &&
      serviceIds.every((id) => state.staffServices.some((l) => l.staffId === s.id && l.serviceId === id)),
  );
}

/**
 * ¿Puede el profesional atender de start a start+duración?
 * Comprueba jornada, excepciones (descansos, bloqueos, vacaciones) y citas existentes con su margen.
 */
export function isSlotFree(
  state: DemoState,
  staffId: ID,
  start: string,
  durationMin: number,
  opts: { ignoreAppointmentId?: ID; ignoreHoldForWaitlistId?: ID } = {},
): boolean {
  const staff = state.staff.find((s) => s.id === staffId);
  if (!staff || !staff.active) return false;
  const end = addMinutes(start, durationMin);
  if (datePart(end) !== datePart(start)) return false;

  const shifts = staff.schedule[weekday(start)] ?? [];
  const inShift = shifts.some((sh) => {
    const shStart = `${datePart(start)}T${sh.start}`;
    const shEnd = `${datePart(start)}T${sh.end}`;
    return start >= shStart && end <= shEnd;
  });
  if (!inShift) return false;

  if (state.exceptions.some((e) => e.staffId === staffId && overlaps(start, end, e.start, e.end))) return false;

  const busy = state.appointments.some(
    (a) =>
      a.staffId === staffId &&
      a.id !== opts.ignoreAppointmentId &&
      BLOCKING_STATUSES.includes(a.status) &&
      overlaps(start, addMinutes(end, staff.bufferMin), a.start, addMinutes(a.end, staff.bufferMin)),
  );
  if (busy) return false;

  // Un hueco ofrecido a la lista de espera queda retenido mientras la oferta está vigente.
  const held = state.waitlist.some(
    (w) =>
      w.status === "oferta_enviada" &&
      w.offer &&
      w.id !== opts.ignoreHoldForWaitlistId &&
      w.offer.staffId === staffId &&
      overlaps(start, end, w.offer.start, w.offer.end),
  );
  return !held;
}

/** Horas de inicio reservables para un día concreto. `now` evita ofrecer horas pasadas. */
export function freeSlots(state: DemoState, staffId: ID, date: string, durationMin: number, now: string): string[] {
  const staff = state.staff.find((s) => s.id === staffId);
  if (!staff) return [];
  const result: string[] = [];
  for (const sh of staff.schedule[weekday(`${date}T00:00`)] ?? []) {
    let t = `${date}T${sh.start}`;
    const shEnd = `${date}T${sh.end}`;
    while (addMinutes(t, durationMin) <= shEnd) {
      if (t > now && isSlotFree(state, staffId, t, durationMin)) result.push(t);
      t = addMinutes(t, SLOT_STEP_MIN);
    }
  }
  return result;
}
