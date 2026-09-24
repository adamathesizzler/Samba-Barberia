-- Permisos (docs/E-roles-y-permisos.md).
-- Las tablas son de solo lectura para la app: toda escritura pasa por funciones
-- (migración 3) que comprueban rol, negocio y estado. RLS limita qué filas ve cada uno.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

-- ---------- quién es quién ----------

create or replace function private.current_customer_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.customers where user_id = auth.uid()
$$;

-- Ficha de personal activa del usuario en un negocio (nulo si no pertenece).
create or replace function private.staff_row(p_business uuid)
returns public.staff language sql stable security definer set search_path = '' as $$
  select s.* from public.staff s
  where s.user_id = auth.uid() and s.business_id = p_business and s.active
  limit 1
$$;

create or replace function private.is_staff_of(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid() and s.business_id = p_business and s.active)
$$;

create or replace function private.is_manager_of(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.business_id = p_business and s.active and s.role in ('encargado', 'propietario')
  )
$$;

-- Cita: el cliente la suya; gestión todo su negocio; barbero solo las asignadas.
create or replace function private.can_access_appointment(p_appointment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.appointments a
    where a.id = p_appointment
      and (
        a.customer_id = private.current_customer_id()
        or private.is_manager_of(a.business_id)
        or exists (select 1 from public.staff s where s.id = a.staff_id and s.user_id = auth.uid() and s.active)
      )
  )
$$;

-- Datos de un cliente desde un negocio: solo ese negocio; el barbero, solo si tiene o tuvo cita con él.
create or replace function private.can_view_customer(p_customer uuid, p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_customer = private.current_customer_id()
    or private.is_manager_of(p_business)
    or exists (
      select 1 from public.appointments a join public.staff s on s.id = a.staff_id
      where a.customer_id = p_customer and a.business_id = p_business and s.user_id = auth.uid() and s.active
    )
$$;

create or replace function private.has_photo_permission(p_photo uuid, p_purpose public.photo_purpose)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select pp.granted from public.photo_permissions pp
    where pp.photo_id = p_photo and pp.purpose = p_purpose
    order by pp.id desc limit 1
  ), false)
$$;

-- ---------- RLS ----------

do $$
declare t text;
begin
  foreach t in array array[
    'businesses','locations','staff','services','staff_services','availability_rules','availability_exceptions',
    'customers','customer_business_links','appointments','appointment_passes','appointment_services',
    'appointment_status_history','visit_preparations','check_ins','sessions','session_services',
    'session_corrections','session_products','photos','photo_permissions','style_entries','preferences',
    'feedback','loyalty_programs','loyalty_movements','achievements','rewards','reward_redemptions',
    'waitlist_requests','consents','notifications','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Sin escritura directa desde la app: solo mediante funciones.
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Catálogo público (reservar sin cuenta, §39).
create policy "catálogo público" on public.businesses for select using (true);
create policy "catálogo público" on public.locations for select using (true);
create policy "catálogo público" on public.services for select using (active or private.is_staff_of(business_id));
create policy "catálogo público" on public.staff_services for select using (true);
create policy "catálogo público" on public.loyalty_programs for select using (true);
create policy "catálogo público" on public.achievements for select using (true);
create policy "catálogo público" on public.availability_rules for select using (true);

-- Personal: visible (nombre, bio, especialidades) si está activo; el equipo ve a todo su equipo.
create policy "perfil profesional" on public.staff for select
  using (active or private.is_staff_of(business_id));

-- Excepciones: las notas son internas; el público consulta huecos con free_slots().
create policy "equipo" on public.availability_exceptions for select
  using (exists (select 1 from public.staff s where s.id = staff_id and private.is_staff_of(s.business_id)));

create policy "propio o negocio" on public.customers for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.customer_business_links l where l.customer_id = id and private.can_view_customer(id, l.business_id))
  );

create policy "propio o negocio" on public.customer_business_links for select
  using (customer_id = private.current_customer_id() or private.can_view_customer(customer_id, business_id));

create policy "acceso a la cita" on public.appointments for select using (private.can_access_appointment(id));
create policy "acceso a la cita" on public.appointment_services for select using (private.can_access_appointment(appointment_id));
create policy "acceso a la cita" on public.appointment_status_history for select using (private.can_access_appointment(appointment_id));
create policy "acceso a la cita" on public.visit_preparations for select using (private.can_access_appointment(appointment_id));
create policy "acceso a la cita" on public.check_ins for select using (private.can_access_appointment(appointment_id));

-- El token del QR solo lo ve el cliente de la cita.
create policy "solo el cliente" on public.appointment_passes for select
  using (exists (select 1 from public.appointments a where a.id = appointment_id and a.customer_id = private.current_customer_id()));

create policy "historial" on public.sessions for select using (private.can_view_customer(customer_id, business_id));
create policy "historial" on public.session_services for select
  using (exists (select 1 from public.sessions s where s.id = session_id and private.can_view_customer(s.customer_id, s.business_id)));
create policy "historial" on public.session_products for select
  using (exists (select 1 from public.sessions s where s.id = session_id and private.can_view_customer(s.customer_id, s.business_id)));
create policy "historial" on public.session_corrections for select
  using (exists (select 1 from public.sessions s where s.id = session_id and private.can_view_customer(s.customer_id, s.business_id)));

-- Fotos: el cliente las suyas; el negocio las de su negocio y clientes autorizados; nunca fallidas o pendientes de otros.
create policy "fotos" on public.photos for select
  using (
    customer_id = private.current_customer_id()
    or (business_id is not null and private.can_view_customer(customer_id, business_id) and (status = 'subida' or uploaded_by = auth.uid()))
  );
create policy "fotos" on public.photo_permissions for select
  using (exists (select 1 from public.photos p where p.id = photo_id and (p.customer_id = private.current_customer_id() or private.is_staff_of(p.business_id))));

create policy "propio" on public.style_entries for select using (customer_id = private.current_customer_id());

create policy "propio o negocio" on public.preferences for select
  using (
    customer_id = private.current_customer_id()
    or exists (select 1 from public.customer_business_links l where l.customer_id = preferences.customer_id and private.can_view_customer(l.customer_id, l.business_id))
  );

create policy "propio o negocio" on public.feedback for select
  using (
    customer_id = private.current_customer_id()
    or exists (select 1 from public.sessions s where s.id = session_id and private.can_view_customer(s.customer_id, s.business_id))
  );

create policy "propio o gestión" on public.loyalty_movements for select
  using (customer_id = private.current_customer_id() or private.is_manager_of(business_id));
create policy "propio o equipo" on public.rewards for select
  using (customer_id = private.current_customer_id() or private.is_staff_of(business_id));
create policy "propio o equipo" on public.reward_redemptions for select
  using (exists (select 1 from public.rewards r where r.id = reward_id and (r.customer_id = private.current_customer_id() or private.is_staff_of(r.business_id))));
create policy "propio o equipo" on public.waitlist_requests for select
  using (customer_id = private.current_customer_id() or private.is_staff_of(business_id));

create policy "propio" on public.consents for select using (customer_id = private.current_customer_id());
create policy "propio" on public.notifications for select using (customer_id = private.current_customer_id());
create policy "gestión" on public.audit_logs for select using (private.is_manager_of(business_id));
