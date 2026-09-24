// Entidades del prototipo. Siguen el modelo conceptual de docs/D-modelo-de-datos.md.
// Las fechas son cadenas "YYYY-MM-DDTHH:mm" en hora local del establecimiento.

export type ID = string;
/** Importes en céntimos para evitar errores de redondeo. */
export type Cents = number;

export type ServiceCategory = "corte" | "degradado" | "barba" | "cejas" | "color" | "trenzas" | "tratamiento";

export interface Business {
  id: ID;
  name: string;
  isDemo: true;
}

export interface Location {
  id: ID;
  businessId: ID;
  name: string;
  address: string;
}

/** Tramos de trabajo por día de la semana (0 = domingo). */
export type WeeklySchedule = Record<number, { start: string; end: string }[]>;

export type StaffRole = "barbero" | "encargado" | "propietario";

export interface Staff {
  id: ID;
  businessId: ID;
  locationIds: ID[];
  name: string;
  role: StaffRole;
  bio: string;
  specialties: string[];
  hue: number;
  schedule: WeeklySchedule;
  /** Minutos de preparación entre citas. */
  bufferMin: number;
  active: boolean;
}

export interface Service {
  id: ID;
  businessId: ID;
  name: string;
  category: ServiceCategory;
  durationMin: number;
  priceCents: Cents;
  priceKind: "fijo" | "desde";
  active: boolean;
}

/** Qué profesional puede hacer qué servicio, con duración/precio propios si difieren. */
export interface StaffService {
  staffId: ID;
  serviceId: ID;
  durationMin?: number;
  priceCents?: Cents;
}

export type ExceptionKind = "descanso" | "bloqueo" | "vacaciones" | "ausencia";

export interface AvailabilityException {
  id: ID;
  staffId: ID;
  start: string;
  end: string;
  kind: ExceptionKind;
  note?: string;
}

export interface Customer {
  id: ID;
  businessIds: ID[];
  name: string;
  phone?: string;
  hue: number;
  /** Cliente registrado en el local sin cuenta verificada. */
  guest: boolean;
  preferredStaffId?: ID;
  sessionStyle: SessionStylePrefs;
  /** Trabajos del portfolio guardados desde Explorar («Quiero probar»). */
  savedPhotoIds: ID[];
}

export interface SessionStylePrefs {
  tranquila: boolean;
  explicarCambios: boolean;
  consultarAntes: boolean;
}

export type AppointmentStatus =
  | "confirmada"
  | "modificada"
  | "cancelada"
  | "llegada"
  | "en_atencion"
  | "completada"
  | "ausencia";

export type AppointmentSource = "app" | "web" | "telefono" | "presencial" | "sin_reserva" | "lista_espera";

/** Copia de servicio en el momento de reservar: no depende del catálogo vigente. */
export interface ServiceLine {
  serviceId: ID;
  name: string;
  durationMin: number;
  priceCents: Cents;
  priceKind: "fijo" | "desde";
}

export interface StatusChange {
  at: string;
  status: AppointmentStatus;
  by: string;
  note?: string;
}

export interface Appointment {
  id: ID;
  code: string;
  businessId: ID;
  locationId: ID;
  customerId: ID;
  staffId: ID;
  start: string;
  end: string;
  status: AppointmentStatus;
  services: ServiceLine[];
  source: AppointmentSource;
  /** Token opaco que codifica el QR. No contiene datos personales. */
  qrToken: string;
  /** Petición puntual para esta visita («terminar antes de…»); requiere confirmación del local. */
  finishBy?: string;
  createdAt: string;
  history: StatusChange[];
}

export type PreparationMode = "repetir_ultimo" | "elegir_anterior" | "subir_referencia" | "quiero_cambiar" | "consultar_barbero";

export interface VisitPreparation {
  appointmentId: ID;
  mode: PreparationMode;
  styleEntryId?: ID;
  referencePhotoId?: ID;
  keep: string;
  change: string;
  note: string;
  updatedAt: string;
  /** Si el profesional ya la había visto cuando se modificó. */
  changedAfterSeen: boolean;
  seenByStaffAt?: string;
}

export interface CheckIn {
  id: ID;
  appointmentId: ID;
  staffId: ID;
  at: string;
  method: "qr" | "manual";
}

export interface Correction {
  at: string;
  by: string;
  field: string;
  from: string;
  to: string;
}

export interface Session {
  id: ID;
  appointmentId: ID;
  businessId: ID;
  customerId: ID;
  staffId: ID;
  completedAt: string;
  services: ServiceLine[];
  estimatedCents: Cents;
  finalCents: Cents;
  durationMin: number;
  technicalNote: string;
  maintenance: string;
  productsUsed: string[];
  productsSold: { name: string; qty: number; priceCents: Cents }[];
  photoIds: ID[];
  /** Estado del pago: el cierre del servicio no implica cobro. */
  payment: "pendiente" | "registrado_en_local";
  closedBy: ID;
  corrections: Correction[];
}

export type PhotoView = "frontal" | "lateral_izq" | "lateral_der" | "posterior" | "detalle";
export type PhotoSource = "profesional" | "cliente" | "referencia_externa" | "simulacion_ia";

export interface Photo {
  id: ID;
  businessId: ID;
  customerId: ID;
  sessionId?: ID;
  appointmentId?: ID;
  view: PhotoView;
  source: PhotoSource;
  uploadedBy: ID;
  at: string;
  /** Solo para dibujar el marcador de demostración. */
  hue: number;
  status: "subida" | "fallida";
}

export type PhotoPurpose = "historial_privado" | "compartir_cliente" | "portfolio" | "promocion";

export interface PhotoPermission {
  photoId: ID;
  purpose: PhotoPurpose;
  granted: boolean;
  at: string;
  by: ID;
}

export interface StyleEntry {
  id: ID;
  customerId: ID;
  sessionId: ID;
  title: string;
  category: ServiceCategory;
  coverPhotoId?: ID;
  favorite: boolean;
  wantAgain: boolean;
}

export interface Feedback {
  id: ID;
  customerId: ID;
  sessionId?: ID;
  photoId?: ID;
  kind: "comentario_visita" | "instruccion_proxima" | "seguimiento";
  liked: string;
  change: string;
  author: "cliente" | "profesional";
  authorId: ID;
  at: string;
}

export interface Preference {
  id: ID;
  customerId: ID;
  label: string;
  value: string;
  origin: "cliente" | "profesional" | "sugerida";
  confirmed: boolean;
}

export interface Achievement {
  id: ID;
  businessId: ID;
  name: string;
  description: string;
  threshold: number;
}

export interface LoyaltyProgram {
  businessId: ID;
  unit: "visitas";
  goal: number;
  rewardName: string;
  rewardBenefit: string;
  rewardConditions: string;
  validDays: number;
}

export interface LoyaltyMovement {
  id: ID;
  customerId: ID;
  businessId: ID;
  sessionId: ID;
  delta: number;
  reason: string;
  at: string;
}

export type RewardStatus = "disponible" | "utilizada" | "caducada";

export interface Reward {
  id: ID;
  businessId: ID;
  customerId: ID;
  name: string;
  benefit: string;
  conditions: string;
  origin: string;
  status: RewardStatus;
  createdAt: string;
  expiresAt: string;
  redeemCode: string;
  redeemedAt?: string;
  redeemedBy?: ID;
}

export type WaitlistStatus = "activa" | "oferta_enviada" | "aceptada" | "caducada" | "cancelada";

export interface WaitlistRequest {
  id: ID;
  customerId: ID;
  businessId: ID;
  serviceIds: ID[];
  staffIds: ID[];
  date: string;
  timeFrom: string;
  timeTo: string;
  originalAppointmentId?: ID;
  status: WaitlistStatus;
  createdAt: string;
  offer?: { staffId: ID; start: string; end: string; expiresAt: string };
  resultAppointmentId?: ID;
}

export interface AuditEntry {
  id: ID;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
}

export interface DemoState {
  version: number;
  businesses: Business[];
  locations: Location[];
  staff: Staff[];
  services: Service[];
  staffServices: StaffService[];
  exceptions: AvailabilityException[];
  customers: Customer[];
  appointments: Appointment[];
  preparations: VisitPreparation[];
  checkIns: CheckIn[];
  sessions: Session[];
  photos: Photo[];
  photoPermissions: PhotoPermission[];
  styleEntries: StyleEntry[];
  feedback: Feedback[];
  preferences: Preference[];
  achievements: Achievement[];
  loyaltyPrograms: LoyaltyProgram[];
  loyaltyMovements: LoyaltyMovement[];
  rewards: Reward[];
  waitlist: WaitlistRequest[];
  audit: AuditEntry[];
  seq: number;
}

export type Actor =
  | { kind: "cliente"; customerId: ID }
  | { kind: "staff"; staffId: ID; businessId: ID; role: StaffRole };
