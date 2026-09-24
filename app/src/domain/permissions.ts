// Matriz de acceso aplicada en la capa de datos (docs/E-roles-y-permisos.md).
// La interfaz también oculta acciones, pero la comprobación real está aquí.

import type { Actor, Appointment, DemoState, ID, Photo, PhotoPurpose } from "./types";

export class PermissionError extends Error {
  constructor(message = "No tienes permiso para esta acción.") {
    super(message);
    this.name = "PermissionError";
  }
}

export const isStaff = (a: Actor): a is Extract<Actor, { kind: "staff" }> => a.kind === "staff";

export function actorLabel(state: DemoState, a: Actor): string {
  if (a.kind === "cliente") return `cliente:${state.customers.find((c) => c.id === a.customerId)?.name ?? a.customerId}`;
  return `${a.role}:${state.staff.find((s) => s.id === a.staffId)?.name ?? a.staffId}`;
}

/** Gestión del negocio (catálogo, agenda completa, recompensas): encargado o propietario del mismo negocio. */
export function canManageBusiness(a: Actor, businessId: ID): boolean {
  return isStaff(a) && a.businessId === businessId && (a.role === "encargado" || a.role === "propietario");
}

/** Ver o actuar sobre una cita concreta. */
export function canAccessAppointment(a: Actor, appt: Appointment): boolean {
  if (a.kind === "cliente") return appt.customerId === a.customerId;
  if (a.businessId !== appt.businessId) return false;
  return a.role !== "barbero" || appt.staffId === a.staffId;
}

/** Registrar llegada: cualquier miembro del equipo del mismo negocio (la agenda es compartida en recepción). */
export function canCheckIn(a: Actor, appt: Appointment): boolean {
  return isStaff(a) && a.businessId === appt.businessId;
}

/**
 * Datos del cliente (historial, fotos, gastos) desde el lado del negocio:
 * solo el propio negocio y, si es barbero, solo clientes con cita suya.
 */
export function canViewCustomerInBusiness(state: DemoState, a: Actor, customerId: ID, businessId: ID): boolean {
  if (a.kind === "cliente") return a.customerId === customerId;
  if (a.businessId !== businessId) return false;
  if (a.role !== "barbero") return true;
  return state.appointments.some((ap) => ap.customerId === customerId && ap.staffId === a.staffId && ap.businessId === businessId);
}

export function hasPhotoPermission(state: DemoState, photoId: ID, purpose: PhotoPurpose): boolean {
  const last = state.photoPermissions.filter((p) => p.photoId === photoId && p.purpose === purpose).at(-1);
  return last?.granted ?? false;
}

export function canViewPhoto(state: DemoState, a: Actor, photo: Photo): boolean {
  if (photo.status !== "subida") return false;
  if (a.kind === "cliente") return photo.customerId === a.customerId;
  return canViewCustomerInBusiness(state, a, photo.customerId, photo.businessId);
}
