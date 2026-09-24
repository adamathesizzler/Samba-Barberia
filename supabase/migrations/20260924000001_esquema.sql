-- Esquema del MVP (docs/D-modelo-de-datos.md).
-- Reglas clave en la propia base de datos:
--   * una cita activa no puede solaparse con otra del mismo profesional (restricción de exclusión);
--   * una llegada, una sesión, un movimiento de fidelización y un canje por elemento (UNIQUE);
--   * cada cita y sesión guarda su copia de servicios y precios.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- tipos ----------

create type public.staff_role as enum ('barbero', 'encargado', 'propietario');
create type public.service_category as enum ('corte', 'degradado', 'barba', 'cejas', 'color', 'trenzas', 'tratamiento');
create type public.price_kind as enum ('fijo', 'desde');
create type public.exception_kind as enum ('descanso', 'bloqueo', 'vacaciones', 'ausencia');
create type public.appointment_status as enum ('confirmada', 'modificada', 'cancelada', 'llegada', 'en_atencion', 'completada', 'ausencia');
create type public.appointment_source as enum ('app', 'web', 'telefono', 'presencial', 'sin_reserva', 'lista_espera');
create type public.preparation_mode as enum ('repetir_ultimo', 'elegir_anterior', 'subir_referencia', 'quiero_cambiar', 'consultar_barbero');
create type public.checkin_method as enum ('qr', 'manual');
create type public.payment_status as enum ('pendiente', 'registrado_en_local');
create type public.photo_view as enum ('frontal', 'lateral_izq', 'lateral_der', 'posterior', 'detalle');
create type public.photo_source as enum ('profesional', 'cliente', 'referencia_externa', 'simulacion_ia');
create type public.photo_status as enum ('pendiente', 'subida', 'fallida');
create type public.photo_purpose as enum ('historial_privado', 'compartir_cliente', 'portfolio', 'promocion');
create type public.preference_origin as enum ('cliente', 'profesional', 'sugerida');
create type public.feedback_kind as enum ('comentario_visita', 'instruccion_proxima', 'seguimiento');
create type public.reward_status as enum ('disponible', 'utilizada', 'caducada');
create type public.waitlist_status as enum ('activa', 'oferta_enviada', 'aceptada', 'caducada', 'cancelada');
create type public.consent_purpose as enum ('avisos', 'seguimiento', 'promociones', 'ia');

-- ---------- organización ----------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  accent_color text,
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  name text not null,
  address text not null default '',
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now()
);
create index on public.locations (business_id);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  location_id uuid references public.locations on delete set null,
  user_id uuid references auth.users on delete set null,
  display_name text not null,
  role public.staff_role not null default 'barbero',
  bio text not null default '',
  specialties text[] not null default '{}',
  buffer_min int not null default 5 check (buffer_min between 0 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index on public.staff (user_id);

-- ---------- catálogo y agenda ----------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  name text not null,
  category public.service_category not null,
  duration_min int not null check (duration_min between 5 and 480),
  price_cents int not null check (price_cents >= 0),
  price_kind public.price_kind not null default 'fijo',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.services (business_id);

create table public.staff_services (
  staff_id uuid not null references public.staff on delete cascade,
  service_id uuid not null references public.services on delete cascade,
  duration_min int check (duration_min between 5 and 480),
  price_cents int check (price_cents >= 0),
  primary key (staff_id, service_id)
);

-- Jornada semanal en hora local del establecimiento (0 = domingo).
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index on public.availability_rules (staff_id, weekday);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  kind public.exception_kind not null,
  note text,
  created_by uuid,
  check (end_at > start_at)
);
create index on public.availability_exceptions using gist (staff_id, tstzrange(start_at, end_at));

-- ---------- clientes ----------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  -- Nulo para clientes registrados en el local sin cuenta.
  user_id uuid unique references auth.users on delete set null,
  display_name text not null,
  phone text,
  -- Invitado: reserva sin identidad verificada; no accede a historial privado.
  guest boolean not null default false,
  session_style jsonb not null default '{"tranquila": false, "explicarCambios": false, "consultarAntes": false}',
  created_at timestamptz not null default now()
);

create table public.customer_business_links (
  customer_id uuid not null references public.customers on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  preferred_staff_id uuid references public.staff on delete set null,
  created_at timestamptz not null default now(),
  primary key (customer_id, business_id)
);
create index on public.customer_business_links (business_id);

-- ---------- reservas ----------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  business_id uuid not null references public.businesses,
  location_id uuid not null references public.locations,
  customer_id uuid not null references public.customers,
  staff_id uuid not null references public.staff,
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- Fin + margen del profesional en el momento de reservar.
  busy_until timestamptz not null,
  status public.appointment_status not null default 'confirmada',
  source public.appointment_source not null default 'app',
  finish_by time,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (end_at > start_at and busy_until >= end_at),
  -- Red de seguridad: aunque la lógica fallase, dos citas activas no pueden solaparse.
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(start_at, busy_until) with &&
  ) where (status in ('confirmada', 'modificada', 'llegada', 'en_atencion', 'completada'))
);
create index on public.appointments (business_id, start_at);
create index on public.appointments (customer_id);
create index on public.appointments (staff_id, start_at);

-- Token del QR: solo lo lee el cliente de la cita (ver RLS). No contiene datos personales.
create table public.appointment_passes (
  appointment_id uuid primary key references public.appointments on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex')
);

create table public.appointment_services (
  appointment_id uuid not null references public.appointments on delete cascade,
  position int not null,
  service_id uuid not null references public.services,
  name text not null,
  duration_min int not null,
  price_cents int not null,
  price_kind public.price_kind not null,
  primary key (appointment_id, position)
);

create table public.appointment_status_history (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments on delete cascade,
  status public.appointment_status not null,
  at timestamptz not null default now(),
  actor uuid,
  note text
);
create index on public.appointment_status_history (appointment_id);

create table public.visit_preparations (
  appointment_id uuid primary key references public.appointments on delete cascade,
  mode public.preparation_mode not null,
  style_entry_id uuid,
  reference_photo_id uuid,
  keep_text text not null default '',
  change_text text not null default '',
  note text not null default '',
  updated_at timestamptz not null default now(),
  seen_by_staff_at timestamptz,
  changed_after_seen boolean not null default false
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments on delete cascade,
  staff_id uuid not null references public.staff,
  method public.checkin_method not null,
  at timestamptz not null default now()
);

-- ---------- atención ----------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments,
  business_id uuid not null references public.businesses,
  customer_id uuid not null references public.customers,
  staff_id uuid not null references public.staff,
  completed_at timestamptz not null default now(),
  estimated_cents int not null,
  final_cents int not null check (final_cents >= 0),
  duration_min int not null,
  technical_note text not null default '',
  maintenance text not null default '',
  payment public.payment_status not null default 'pendiente',
  closed_by uuid not null references public.staff
);
create index on public.sessions (customer_id, completed_at desc);
create index on public.sessions (business_id, completed_at desc);

create table public.session_services (
  session_id uuid not null references public.sessions on delete cascade,
  position int not null,
  service_id uuid not null references public.services,
  name text not null,
  duration_min int not null,
  price_cents int not null,
  price_kind public.price_kind not null,
  primary key (session_id, position)
);

create table public.session_corrections (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions on delete cascade,
  field text not null,
  from_value text not null,
  to_value text not null,
  reason text not null,
  by_staff uuid not null references public.staff,
  at timestamptz not null default now()
);

-- Producto usado (referencia técnica) o vendido (cuenta como gasto). Una recomendación no se guarda aquí.
create table public.session_products (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions on delete cascade,
  kind text not null check (kind in ('usado', 'vendido')),
  name text not null,
  qty int not null default 1 check (qty > 0),
  price_cents int check (price_cents >= 0),
  check (kind = 'usado' or price_cents is not null)
);

-- ---------- medios ----------

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses,
  customer_id uuid not null references public.customers,
  appointment_id uuid references public.appointments,
  session_id uuid references public.sessions,
  view public.photo_view not null default 'frontal',
  source public.photo_source not null,
  -- Ruta dentro del bucket privado «fotos»: {business_id}/{customer_id}/{photo_id}.
  storage_path text,
  status public.photo_status not null default 'pendiente',
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);
create index on public.photos (customer_id);
create index on public.photos (session_id);
create index on public.photos (appointment_id);

-- Solo se añaden filas; vale la última por (foto, finalidad).
create table public.photo_permissions (
  id bigint generated always as identity primary key,
  photo_id uuid not null references public.photos on delete cascade,
  purpose public.photo_purpose not null,
  granted boolean not null,
  at timestamptz not null default now(),
  by_user uuid
);
create index on public.photo_permissions (photo_id, purpose, id desc);

alter table public.visit_preparations
  add constraint visit_preparations_reference_photo_fk foreign key (reference_photo_id) references public.photos on delete set null;

-- ---------- estilo ----------

create table public.style_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers on delete cascade,
  session_id uuid not null unique references public.sessions on delete cascade,
  title text not null,
  category public.service_category not null,
  cover_photo_id uuid references public.photos on delete set null,
  favorite boolean not null default false,
  want_again boolean not null default false
);
create index on public.style_entries (customer_id);

alter table public.visit_preparations
  add constraint visit_preparations_style_entry_fk foreign key (style_entry_id) references public.style_entries on delete set null;

create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers on delete cascade,
  label text not null,
  value text not null,
  origin public.preference_origin not null,
  confirmed boolean not null default false,
  proposed_by_business uuid references public.businesses on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.preferences (customer_id);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers on delete cascade,
  session_id uuid references public.sessions on delete cascade,
  photo_id uuid references public.photos on delete set null,
  kind public.feedback_kind not null,
  liked text not null default '',
  change text not null default '',
  author text not null check (author in ('cliente', 'profesional')),
  author_id uuid not null,
  at timestamptz not null default now()
);
create index on public.feedback (customer_id);

-- ---------- fidelización ----------

create table public.loyalty_programs (
  business_id uuid primary key references public.businesses on delete cascade,
  unit text not null default 'visitas' check (unit = 'visitas'),
  goal int not null check (goal > 0),
  reward_name text not null,
  reward_benefit text not null,
  reward_conditions text not null,
  valid_days int not null check (valid_days > 0)
);

create table public.loyalty_movements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  -- Un movimiento por sesión: la regla se aplica una sola vez.
  session_id uuid unique references public.sessions on delete cascade,
  delta int not null,
  reason text not null,
  at timestamptz not null default now()
);
create index on public.loyalty_movements (customer_id, business_id);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  name text not null,
  description text not null,
  threshold int not null check (threshold > 0)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  customer_id uuid not null references public.customers on delete cascade,
  name text not null,
  benefit text not null,
  conditions text not null,
  origin text not null,
  status public.reward_status not null default 'disponible',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeem_code text not null unique
);
create index on public.rewards (customer_id);

create table public.reward_redemptions (
  reward_id uuid primary key references public.rewards on delete cascade,
  staff_id uuid not null references public.staff,
  session_id uuid references public.sessions,
  at timestamptz not null default now()
);

-- ---------- lista de espera ----------

create table public.waitlist_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  service_ids uuid[] not null check (cardinality(service_ids) > 0),
  staff_ids uuid[] not null default '{}',
  date date not null,
  time_from time not null,
  time_to time not null,
  original_appointment_id uuid references public.appointments,
  status public.waitlist_status not null default 'activa',
  created_at timestamptz not null default now(),
  -- Oferta vigente: retiene el hueco hasta que caduca.
  offer_staff_id uuid references public.staff,
  offer_start_at timestamptz,
  offer_end_at timestamptz,
  offer_expires_at timestamptz,
  result_appointment_id uuid references public.appointments,
  check (time_to > time_from),
  -- Una oferta enviada siempre tiene hueco y caducidad; se conservan después como historial.
  check (status <> 'oferta_enviada' or (offer_start_at is not null and offer_expires_at is not null))
);
create index on public.waitlist_requests (business_id, status, created_at);

-- ---------- consentimientos, avisos y auditoría ----------

create table public.consents (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.customers on delete cascade,
  purpose public.consent_purpose not null,
  granted boolean not null,
  at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers on delete cascade,
  channel text not null,
  kind text not null,
  payload jsonb not null default '{}',
  -- No se da por enviado hasta que el proveedor lo confirma.
  status text not null default 'preparada' check (status in ('preparada', 'enviada', 'fallida')),
  error text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  business_id uuid references public.businesses on delete cascade,
  actor uuid,
  action text not null,
  target text not null,
  detail text
);
create index on public.audit_logs (business_id, at desc);
