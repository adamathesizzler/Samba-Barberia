-- Operaciones del producto (app/src/domain/backend.ts llevado al servidor).
-- Todas son SECURITY DEFINER con search_path vacío y comprueban quién llama.
-- Los errores de negocio se lanzan con código P0001: message = código estable, detail = texto para la persona.

-- ---------- utilidades ----------

create or replace function private.fail(p_code text, p_message text)
returns void language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = p_message;
end $$;

create or replace function private.log(p_business uuid, p_action text, p_target text, p_detail text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (business_id, actor, action, target, detail) values (p_business, auth.uid(), p_action, p_target, p_detail)
$$;

create or replace function private.staff_tz(p_staff uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select l.timezone from public.staff s join public.locations l on l.id = s.location_id where s.id = p_staff),
    (select l.timezone from public.staff s join public.locations l on l.business_id = s.business_id where s.id = p_staff order by l.created_at limit 1),
    'Europe/Madrid'
  )
$$;

create or replace function private.new_code(p_prefix text)
returns text language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  loop
    v := p_prefix || (10000 + floor(random() * 90000))::int::text;
    exit when not exists (select 1 from public.appointments where code = v)
          and not exists (select 1 from public.rewards where redeem_code = v);
  end loop;
  return v;
end $$;

create or replace function private.set_status(p_appointment uuid, p_status public.appointment_status, p_note text default null)
returns void language sql security definer set search_path = '' as $$
  update public.appointments set status = p_status where id = p_appointment;
  insert into public.appointment_status_history (appointment_id, status, actor, note) values (p_appointment, p_status, auth.uid(), p_note);
$$;

create or replace function private.require_login()
returns void language plpgsql stable as $$
begin
  if auth.uid() is null then perform private.fail('no_autenticado', 'Inicia sesión para continuar.'); end if;
end $$;

-- ---------- catálogo y huecos ----------

-- Líneas de servicio con duración y precio de ESTE profesional según el catálogo actual.
create or replace function private.price_lines(p_staff uuid, p_ids uuid[])
returns table (pos int, service_id uuid, name text, duration_min int, price_cents int, price_kind public.price_kind)
language plpgsql stable security definer set search_path = '' as $$
declare n int;
begin
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x) then
    perform private.fail('servicios', 'Elige uno o más servicios distintos.');
  end if;
  return query
    select o.ord::int, sv.id, sv.name, coalesce(ss.duration_min, sv.duration_min), coalesce(ss.price_cents, sv.price_cents), sv.price_kind
    from unnest(p_ids) with ordinality as o(id, ord)
    join public.services sv on sv.id = o.id and sv.active
    join public.staff st on st.id = p_staff and st.business_id = sv.business_id
    join public.staff_services ss on ss.service_id = sv.id and ss.staff_id = p_staff
    order by o.ord;
  get diagnostics n = row_count;
  if n <> cardinality(p_ids) then
    perform private.fail('servicio_no_disponible', 'Este profesional no realiza alguno de los servicios elegidos.');
  end if;
end $$;

-- ¿Puede el profesional atender de p_start a p_start + duración? Jornada, excepciones, citas con margen y ofertas retenidas.
create or replace function private.slot_is_free(
  p_staff uuid, p_start timestamptz, p_duration int, p_ignore_appointment uuid default null, p_ignore_waitlist uuid default null
) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  s public.staff;
  tz text := private.staff_tz(p_staff);
  v_end timestamptz := p_start + make_interval(mins => p_duration);
  ls timestamp := p_start at time zone tz;
  le timestamp := v_end at time zone tz;
  busy tstzrange;
begin
  select * into s from public.staff where id = p_staff;
  if not found or not s.active then return false; end if;
  busy := tstzrange(p_start, v_end + make_interval(mins => s.buffer_min));
  if ls::date <> le::date then return false; end if;
  if not exists (
    select 1 from public.availability_rules r
    where r.staff_id = p_staff and r.weekday = extract(dow from ls)::int and r.start_time <= ls::time and r.end_time >= le::time
  ) then return false; end if;
  if exists (
    select 1 from public.availability_exceptions e
    where e.staff_id = p_staff and tstzrange(e.start_at, e.end_at) && tstzrange(p_start, v_end)
  ) then return false; end if;
  if exists (
    select 1 from public.appointments a
    where a.staff_id = p_staff and a.id is distinct from p_ignore_appointment
      and a.status in ('confirmada', 'modificada', 'llegada', 'en_atencion', 'completada')
      and tstzrange(a.start_at, a.busy_until) && busy
  ) then return false; end if;
  return not exists (
    select 1 from public.waitlist_requests w
    where w.status = 'oferta_enviada' and w.offer_expires_at > now() and w.id is distinct from p_ignore_waitlist
      and w.offer_staff_id = p_staff and tstzrange(w.offer_start_at, w.offer_end_at) && busy
  );
end $$;

create or replace function private.free_slots_for(p_staff uuid, p_date date, p_duration int)
returns setof timestamptz language plpgsql stable security definer set search_path = '' as $$
declare r record; t timestamptz; stop timestamptz; tz text := private.staff_tz(p_staff);
begin
  for r in
    select * from public.availability_rules where staff_id = p_staff and weekday = extract(dow from p_date)::int order by start_time
  loop
    t := (p_date + r.start_time) at time zone tz;
    stop := (p_date + r.end_time) at time zone tz;
    while t + make_interval(mins => p_duration) <= stop loop
      if t > now() and private.slot_is_free(p_staff, t, p_duration) then return next t; end if;
      t := t + interval '15 minutes';
    end loop;
  end loop;
end $$;

-- Pública: horas libres sin exponer citas ni notas de nadie.
create or replace function public.free_slots(p_staff uuid, p_date date, p_service_ids uuid[])
returns setof timestamptz language plpgsql stable security definer set search_path = '' as $$
declare dur int;
begin
  select sum(l.duration_min) into dur from private.price_lines(p_staff, p_service_ids) l;
  return query select * from private.free_slots_for(p_staff, p_date, dur);
end $$;

-- ---------- clientes ----------

-- Crea o actualiza el perfil del usuario autenticado. Un usuario anónimo queda como invitado;
-- al vincular correo o teléfono conserva el mismo id y deja de serlo, sin duplicar cliente.
create or replace function public.ensure_customer_profile(p_display_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid; v_guest boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
begin
  perform private.require_login();
  insert into public.customers (user_id, display_name, guest)
  values (auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Cliente'), v_guest)
  on conflict (user_id) do update
    set guest = excluded.guest,
        display_name = coalesce(nullif(trim(p_display_name), ''), public.customers.display_name)
  returning id into v;
  return v;
end $$;

create or replace function public.update_my_profile(p_display_name text, p_phone text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_login();
  update public.customers set display_name = coalesce(nullif(trim(p_display_name), ''), display_name), phone = p_phone
  where user_id = auth.uid();
end $$;

create or replace function public.set_session_style(p_tranquila boolean, p_explicar boolean, p_consultar boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_login();
  update public.customers
  set session_style = jsonb_build_object('tranquila', p_tranquila, 'explicarCambios', p_explicar, 'consultarAntes', p_consultar)
  where user_id = auth.uid();
end $$;

-- ---------- reservas ----------

-- Inserta la cita. Quien llama ya ha bloqueado al profesional y comprobado el hueco.
create or replace function private.create_appointment(
  p_location uuid, p_customer uuid, p_staff uuid, p_service_ids uuid[], p_start timestamptz,
  p_source public.appointment_source, p_finish_by time, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_business uuid; v_dur int; v_buffer int;
begin
  select business_id, buffer_min into v_business, v_buffer from public.staff where id = p_staff;
  select sum(l.duration_min) into v_dur from private.price_lines(p_staff, p_service_ids) l;
  begin
    insert into public.appointments (code, business_id, location_id, customer_id, staff_id, start_at, end_at, busy_until, source, finish_by, created_by)
    values (
      private.new_code('B'), v_business, p_location, p_customer, p_staff, p_start,
      p_start + make_interval(mins => v_dur), p_start + make_interval(mins => v_dur + v_buffer), p_source, p_finish_by, auth.uid()
    ) returning id into v_id;
  exception when exclusion_violation then
    perform private.fail('hueco_no_disponible', 'Ese hueco acaba de ocuparse. No se ha creado ninguna reserva.');
  end;
  insert into public.appointment_services (appointment_id, position, service_id, name, duration_min, price_cents, price_kind)
  select v_id, l.pos, l.service_id, l.name, l.duration_min, l.price_cents, l.price_kind from private.price_lines(p_staff, p_service_ids) l;
  insert into public.appointment_passes (appointment_id) values (v_id);
  insert into public.appointment_status_history (appointment_id, status, actor, note) values (v_id, 'confirmada', auth.uid(), p_note);
  insert into public.customer_business_links (customer_id, business_id) values (p_customer, v_business) on conflict do nothing;
  perform private.log(v_business, 'cita.crear', v_id::text, p_source::text);
  return v_id;
end $$;

-- Valida el hueco al CONFIRMAR (no solo al mostrarlo). El bloqueo del profesional serializa
-- reservas concurrentes y la restricción de exclusión es la última red de seguridad.
create or replace function public.book_appointment(
  p_staff uuid, p_service_ids uuid[], p_start timestamptz,
  p_customer uuid default null, p_source public.appointment_source default 'app',
  p_finish_by time default null, p_location uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_staff public.staff;
  v_me uuid := private.current_customer_id();
  v_customer uuid;
  v_location uuid;
  v_dur int;
  v_alts text;
begin
  perform private.require_login();
  select * into v_staff from public.staff where id = p_staff for update;
  if not found or not v_staff.active then perform private.fail('profesional_no_disponible', 'Este profesional no está disponible.'); end if;

  if p_customer is null or p_customer = v_me then
    if v_me is null then perform private.fail('sin_perfil', 'Completa tu perfil antes de reservar.'); end if;
    v_customer := v_me;
  elsif private.is_staff_of(v_staff.business_id) then
    -- Cita introducida por el local (teléfono, presencial).
    if not exists (select 1 from public.customers where id = p_customer) then perform private.fail('cliente', 'Cliente no encontrado.'); end if;
    v_customer := p_customer;
  else
    perform private.fail('sin_permiso', 'No puedes reservar en nombre de otra persona.');
  end if;

  select id into v_location from public.locations
  where business_id = v_staff.business_id and id = coalesce(p_location, v_staff.location_id, id)
  order by (id = coalesce(p_location, v_staff.location_id)) desc nulls last, created_at limit 1;
  if v_location is null then perform private.fail('sucursal', 'Sucursal no válida.'); end if;

  select sum(l.duration_min) into v_dur from private.price_lines(p_staff, p_service_ids) l;
  if p_start <= now() then perform private.fail('hora_pasada', 'Esa hora ya ha pasado.'); end if;

  if not private.slot_is_free(p_staff, p_start, v_dur) then
    select string_agg(to_char(t at time zone private.staff_tz(p_staff), 'HH24:MI'), ', ') into v_alts
    from (select t from private.free_slots_for(p_staff, (p_start at time zone private.staff_tz(p_staff))::date, v_dur) t limit 4) x;
    perform private.fail('hueco_no_disponible',
      'Ese hueco ya no está disponible. No se ha creado ninguna reserva.' || coalesce(' Horas libres ese día: ' || v_alts || '.', ''));
  end if;

  return private.create_appointment(v_location, v_customer, p_staff, p_service_ids, p_start, p_source, p_finish_by);
end $$;

create or replace function public.reschedule_appointment(p_appointment uuid, p_start timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.appointments; v_dur int; v_buffer int;
begin
  perform private.require_login();
  select * into a from public.appointments where id = p_appointment;
  if not found or not private.can_access_appointment(p_appointment) then perform private.fail('no_encontrada', 'No encontramos la reserva.'); end if;
  select buffer_min into v_buffer from public.staff where id = a.staff_id for update;
  select * into a from public.appointments where id = p_appointment for update;
  if a.status not in ('confirmada', 'modificada') then perform private.fail('estado', 'Esta cita ya no se puede cambiar.'); end if;
  if p_start <= now() then perform private.fail('hora_pasada', 'Esa hora ya ha pasado.'); end if;
  select sum(duration_min) into v_dur from public.appointment_services where appointment_id = a.id;
  if not private.slot_is_free(a.staff_id, p_start, v_dur, a.id) then
    perform private.fail('hueco_no_disponible', 'Ese hueco ya no está disponible. Tu cita sigue como estaba.');
  end if;
  update public.appointments
  set start_at = p_start, end_at = p_start + make_interval(mins => v_dur), busy_until = p_start + make_interval(mins => v_dur + v_buffer)
  where id = a.id;
  perform private.set_status(a.id, 'modificada', 'de ' || a.start_at::text);
  perform private.log(a.business_id, 'cita.cambiar', a.id::text, a.start_at::text || ' → ' || p_start::text);
  perform private.process_waitlist(a.business_id);
end $$;

create or replace function public.cancel_appointment(p_appointment uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.appointments;
begin
  perform private.require_login();
  select * into a from public.appointments where id = p_appointment for update;
  if not found or not private.can_access_appointment(p_appointment) then perform private.fail('no_encontrada', 'No encontramos la reserva.'); end if;
  if a.status not in ('confirmada', 'modificada') then perform private.fail('estado', 'Esta cita ya no se puede cancelar.'); end if;
  perform private.set_status(a.id, 'cancelada', p_note);
  perform private.log(a.business_id, 'cita.cancelar', a.id::text);
  perform private.process_waitlist(a.business_id);
end $$;

create or replace function public.mark_no_show(p_appointment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.appointments;
begin
  perform private.require_login();
  select * into a from public.appointments where id = p_appointment for update;
  if not found or not private.is_staff_of(a.business_id) or not private.can_access_appointment(a.id) then
    perform private.fail('sin_permiso', 'No tienes permiso para esta acción.');
  end if;
  if a.status not in ('confirmada', 'modificada') then perform private.fail('estado', 'Solo una cita pendiente puede marcarse como ausencia.'); end if;
  perform private.set_status(a.id, 'ausencia');
  perform private.log(a.business_id, 'cita.ausencia', a.id::text);
end $$;

-- Cliente sin reserva: ocupa la misma agenda y queda con la llegada registrada.
create or replace function public.walk_in(p_name text, p_staff uuid, p_service_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_staff public.staff; v_actor public.staff; v_start timestamptz; v_dur int; v_customer uuid; v_id uuid; v_loc uuid;
begin
  perform private.require_login();
  select * into v_staff from public.staff where id = p_staff for update;
  if not found then perform private.fail('sin_permiso', 'Profesional no válido.'); end if;
  v_actor := private.staff_row(v_staff.business_id);
  if v_actor.id is null then perform private.fail('sin_permiso', 'Solo el equipo del local puede registrar clientes sin reserva.'); end if;
  v_start := date_trunc('minute', now());
  v_start := v_start + make_interval(mins => (5 - extract(minute from v_start)::int % 5) % 5);
  select sum(l.duration_min) into v_dur from private.price_lines(p_staff, p_service_ids) l;
  if not private.slot_is_free(p_staff, v_start, v_dur) then
    perform private.fail('hueco_no_disponible', 'Este profesional no tiene hueco ahora mismo para esos servicios.');
  end if;
  insert into public.customers (display_name, guest) values (coalesce(nullif(trim(p_name), ''), 'Cliente sin nombre'), true) returning id into v_customer;
  select coalesce(v_staff.location_id, (select id from public.locations where business_id = v_staff.business_id order by created_at limit 1)) into v_loc;
  v_id := private.create_appointment(v_loc, v_customer, p_staff, p_service_ids, v_start, 'sin_reserva', null, 'sin reserva');
  insert into public.check_ins (appointment_id, staff_id, method) values (v_id, v_actor.id, 'manual');
  perform private.set_status(v_id, 'llegada', 'verificación manual');
  return v_id;
end $$;

-- ---------- preparación ----------

create or replace function public.save_preparation(
  p_appointment uuid, p_mode public.preparation_mode, p_style_entry uuid default null, p_reference_photo uuid default null,
  p_keep text default '', p_change text default '', p_note text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare a public.appointments; v_me uuid := private.current_customer_id();
begin
  perform private.require_login();
  select * into a from public.appointments where id = p_appointment;
  if not found or a.customer_id is distinct from v_me then perform private.fail('sin_permiso', 'Esta reserva no es tuya.'); end if;
  if a.status not in ('confirmada', 'modificada', 'llegada') then perform private.fail('estado', 'Esta cita ya no admite cambios en la preparación.'); end if;
  if p_style_entry is not null and not exists (select 1 from public.style_entries where id = p_style_entry and customer_id = v_me) then
    perform private.fail('sin_permiso', 'Ese estilo no es tuyo.');
  end if;
  -- Referencia: una foto propia o un trabajo publicado en el portfolio de ese negocio.
  if p_reference_photo is not null and not exists (
    select 1 from public.photos p where p.id = p_reference_photo and p.status = 'subida'
      and (p.customer_id = v_me or (p.business_id = a.business_id and private.has_photo_permission(p.id, 'portfolio')))
  ) then perform private.fail('sin_permiso', 'No puedes usar esa imagen como referencia.'); end if;

  insert into public.visit_preparations as vp (appointment_id, mode, style_entry_id, reference_photo_id, keep_text, change_text, note)
  values (p_appointment, p_mode, p_style_entry, p_reference_photo, coalesce(p_keep, ''), coalesce(p_change, ''), coalesce(p_note, ''))
  on conflict (appointment_id) do update set
    mode = excluded.mode, style_entry_id = excluded.style_entry_id, reference_photo_id = excluded.reference_photo_id,
    keep_text = excluded.keep_text, change_text = excluded.change_text, note = excluded.note, updated_at = now(),
    changed_after_seen = vp.seen_by_staff_at is not null;
end $$;

create or replace function public.mark_preparation_seen(p_appointment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.appointments;
begin
  perform private.require_login();
  select * into a from public.appointments where id = p_appointment;
  if not found or not private.is_staff_of(a.business_id) or not private.can_access_appointment(a.id) then
    perform private.fail('sin_permiso', 'No tienes acceso a esta ficha.');
  end if;
  update public.visit_preparations set seen_by_staff_at = now(), changed_after_seen = false where appointment_id = p_appointment;
end $$;

-- ---------- llegada ----------

-- QR o manual actualizan el mismo estado. Un segundo intento devuelve «ya_registrado» sin crear otra llegada.
create or replace function public.check_in(p_token text default null, p_appointment uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.appointments; v_id uuid; v_actor public.staff; tz text;
begin
  perform private.require_login();
  if not exists (select 1 from public.staff where user_id = auth.uid() and active) then
    perform private.fail('sin_permiso', 'Solo el personal del local puede registrar llegadas.');
  end if;
  if p_token is not null then
    select appointment_id into v_id from public.appointment_passes where token = trim(replace(p_token, 'SAMBA-CHECKIN:', ''));
  else
    v_id := p_appointment;
  end if;
  select * into a from public.appointments where id = v_id for update;
  if not found then perform private.fail('no_encontrado', 'Este código no corresponde a ninguna reserva.'); end if;
  v_actor := private.staff_row(a.business_id);
  if v_actor.id is null then perform private.fail('otro_negocio', 'Esta reserva pertenece a otro establecimiento.'); end if;
  if a.status = 'cancelada' then perform private.fail('cancelada', 'La reserva está cancelada. No se ha registrado la llegada.'); end if;
  if a.status = 'ausencia' then perform private.fail('ausencia', 'La cita figura como ausencia. Revísala desde la agenda.'); end if;
  if a.status in ('llegada', 'en_atencion', 'completada') then
    return jsonb_build_object('status', 'ya_registrado', 'appointment_id', a.id);
  end if;
  tz := private.staff_tz(a.staff_id);
  if (a.start_at at time zone tz)::date <> (now() at time zone tz)::date then
    perform private.fail('otro_dia', 'Esta reserva no es para hoy.');
  end if;
  insert into public.check_ins (appointment_id, staff_id, method)
  values (a.id, v_actor.id, case when p_token is not null then 'qr' else 'manual' end::public.checkin_method)
  on conflict (appointment_id) do nothing;
  perform private.set_status(a.id, 'llegada', case when p_token is not null then 'QR' else 'verificación manual' end);
  perform private.log(a.business_id, 'checkin', a.id::text);
  return jsonb_build_object('status', 'registrado', 'appointment_id', a.id);
end $$;

create or replace function public.start_service(p_appointment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.appointments;
begin
  perform private.require_login();
  select * into a from public.appointments where id = p_appointment for update;
  if not found or not private.is_staff_of(a.business_id) or not private.can_access_appointment(a.id) then
    perform private.fail('sin_permiso', 'No tienes acceso a esta cita.');
  end if;
  if a.status = 'llegada' then perform private.set_status(a.id, 'en_atencion'); end if;
end $$;

-- ---------- fotos ----------

-- Registra una foto pendiente y devuelve la ruta privada donde subirla (bucket «fotos»).
create or replace function public.register_photo(p_appointment uuid, p_view public.photo_view, p_source public.photo_source default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.appointments; v_id uuid := gen_random_uuid(); v_source public.photo_source; v_path text;
begin
  perform private.require_login();
  select * into a from public.appointments where id = p_appointment;
  if not found or not private.can_access_appointment(p_appointment) then perform private.fail('sin_permiso', 'No tienes acceso a esta cita.'); end if;
  if a.customer_id = private.current_customer_id() then
    v_source := case when p_source = 'referencia_externa' then 'referencia_externa' else 'cliente' end;
  else
    v_source := 'profesional';
  end if;
  v_path := a.business_id || '/' || a.customer_id || '/' || v_id;
  insert into public.photos (id, business_id, customer_id, appointment_id, view, source, storage_path, uploaded_by)
  values (v_id, a.business_id, a.customer_id, a.id, p_view, v_source, v_path, auth.uid());
  return jsonb_build_object('photo_id', v_id, 'storage_path', v_path);
end $$;

-- Marca la subida como hecha o fallida. Solo se da por «subida» si el archivo existe en Storage.
create or replace function public.confirm_photo(p_photo uuid, p_ok boolean)
returns public.photo_status language plpgsql security definer set search_path = '' as $$
declare p public.photos; v_exists boolean := true;
begin
  perform private.require_login();
  select * into p from public.photos where id = p_photo for update;
  if not found or p.uploaded_by <> auth.uid() then perform private.fail('sin_permiso', 'Esta foto no es tuya.'); end if;
  if p.status = 'subida' then return p.status; end if;
  if p_ok and to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where bucket_id = $1 and name = $2)' into v_exists using 'fotos', p.storage_path;
  end if;
  if p_ok and v_exists then
    update public.photos set status = 'subida' where id = p.id;
    insert into public.photo_permissions (photo_id, purpose, granted, by_user) values (p.id, 'historial_privado', true, auth.uid());
    return 'subida';
  end if;
  update public.photos set status = 'fallida' where id = p.id;
  return 'fallida';
end $$;

create or replace function public.remove_pending_photo(p_photo uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_login();
  delete from public.photos where id = p_photo and uploaded_by = auth.uid() and session_id is null;
end $$;

-- Solo el cliente decide los usos de sus fotos. Se añade una fila; vale la última.
create or replace function public.set_photo_permission(p_photo uuid, p_purpose public.photo_purpose, p_granted boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.photos;
begin
  perform private.require_login();
  select * into p from public.photos where id = p_photo;
  if not found or p.customer_id is distinct from private.current_customer_id() then
    perform private.fail('sin_permiso', 'Solo el cliente puede decidir sobre sus fotos.');
  end if;
  insert into public.photo_permissions (photo_id, purpose, granted, by_user) values (p_photo, p_purpose, p_granted, auth.uid());
  perform private.log(p.business_id, 'foto.permiso.' || case when p_granted then 'conceder' else 'retirar' end, p_photo::text, p_purpose::text);
end $$;

-- Portfolio público (Explorar): solo fotos con permiso de portfolio vigente.
create or replace function public.portfolio(p_business uuid, p_staff uuid default null)
returns table (photo_id uuid, storage_path text, view public.photo_view, staff_id uuid, service_ids uuid[], created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.storage_path, p.view, s.staff_id, array(select ss.service_id from public.session_services ss where ss.session_id = s.id order by ss.position), p.created_at
  from public.photos p join public.sessions s on s.id = p.session_id
  where p.business_id = p_business and p.status = 'subida' and private.has_photo_permission(p.id, 'portfolio')
    and (p_staff is null or s.staff_id = p_staff)
  order by p.created_at desc
$$;

-- ---------- cierre de sesión y fidelización ----------

create or replace function private.apply_loyalty(p_session uuid)
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare s public.sessions; prog public.loyalty_programs; v_mov uuid; v_total int; v_reward uuid;
begin
  select * into s from public.sessions where id = p_session;
  select * into prog from public.loyalty_programs where business_id = s.business_id;
  if not found then return '{}'; end if;
  insert into public.loyalty_movements (customer_id, business_id, session_id, delta, reason)
  values (s.customer_id, s.business_id, s.id, 1, 'visita atendida')
  on conflict (session_id) do nothing returning id into v_mov;
  if v_mov is null then return '{}'; end if;
  select sum(delta) into v_total from public.loyalty_movements where customer_id = s.customer_id and business_id = s.business_id;
  if v_total % prog.goal <> 0 then return '{}'; end if;
  insert into public.rewards (business_id, customer_id, name, benefit, conditions, origin, expires_at, redeem_code)
  values (s.business_id, s.customer_id, prog.reward_name, prog.reward_benefit, prog.reward_conditions,
          v_total || ' visitas completadas', now() + make_interval(days => prog.valid_days), private.new_code('R'))
  returning id into v_reward;
  perform private.log(s.business_id, 'recompensa.desbloquear', v_reward::text, v_total || ' visitas');
  return array[v_reward];
end $$;

-- Idempotente por cita: repetir el cierre devuelve la sesión existente sin duplicar nada.
create or replace function public.close_session(
  p_appointment uuid,
  p_service_ids uuid[],
  p_adjustment_cents int default 0,
  p_technical_note text default '',
  p_maintenance text default '',
  p_products_used text[] default '{}',
  p_products_sold jsonb default '[]',
  p_photo_ids uuid[] default '{}',
  p_cover_photo uuid default null,
  p_style_title text default '',
  p_payment public.payment_status default 'pendiente'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.appointments;
  v_actor public.staff;
  v_session uuid;
  v_est int;
  v_final int;
  v_dur int;
  v_cover uuid;
  v_title text;
  v_cat public.service_category;
  v_rewards uuid[];
begin
  perform private.require_login();
  select * into a from public.appointments where id = p_appointment for update;
  if not found then perform private.fail('no_encontrada', 'No encontramos la reserva.'); end if;
  v_actor := private.staff_row(a.business_id);
  if v_actor.id is null or not private.can_access_appointment(a.id) then perform private.fail('sin_permiso', 'No tienes acceso a esta sesión.'); end if;

  select id into v_session from public.sessions where appointment_id = a.id;
  if v_session is not null then
    return jsonb_build_object('session_id', v_session, 'duplicated', true, 'new_rewards', '[]'::jsonb);
  end if;
  if a.status not in ('llegada', 'en_atencion') then
    perform private.fail('sin_llegada', 'Registra primero la llegada del cliente (QR o verificación manual).');
  end if;

  -- Lo reservado conserva su precio histórico; lo añadido en la sesión usa el catálogo actual.
  create temp table if not exists _lines (pos int, service_id uuid, name text, duration_min int, price_cents int, price_kind public.price_kind) on commit drop;
  truncate _lines;
  insert into _lines
  select l.pos, l.service_id, coalesce(b.name, l.name), coalesce(b.duration_min, l.duration_min), coalesce(b.price_cents, l.price_cents), coalesce(b.price_kind, l.price_kind)
  from private.price_lines(a.staff_id, p_service_ids) l
  left join public.appointment_services b on b.appointment_id = a.id and b.service_id = l.service_id;

  select sum(price_cents) into v_est from public.appointment_services where appointment_id = a.id;
  select sum(price_cents) + coalesce(p_adjustment_cents, 0), sum(duration_min) into v_final, v_dur from _lines;
  if v_final < 0 then perform private.fail('importe', 'El importe final no puede ser negativo.'); end if;

  insert into public.sessions (appointment_id, business_id, customer_id, staff_id, estimated_cents, final_cents, duration_min,
                               technical_note, maintenance, payment, closed_by)
  values (a.id, a.business_id, a.customer_id, a.staff_id, v_est, v_final, v_dur,
          coalesce(trim(p_technical_note), ''), coalesce(trim(p_maintenance), ''), p_payment, v_actor.id)
  returning id into v_session;

  insert into public.session_services (session_id, position, service_id, name, duration_min, price_cents, price_kind)
  select v_session, pos, service_id, name, duration_min, price_cents, price_kind from _lines;

  insert into public.session_products (session_id, kind, name)
  select v_session, 'usado', x from unnest(coalesce(p_products_used, '{}')) x where trim(x) <> '';
  insert into public.session_products (session_id, kind, name, qty, price_cents)
  select v_session, 'vendido', e ->> 'name', coalesce((e ->> 'qty')::int, 1), (e ->> 'price_cents')::int
  from jsonb_array_elements(coalesce(p_products_sold, '[]')) e;

  -- Solo fotos realmente subidas de esta cita.
  update public.photos set session_id = v_session
  where id = any(coalesce(p_photo_ids, '{}')) and appointment_id = a.id and status = 'subida' and session_id is null;
  select coalesce(
    (select id from public.photos where id = p_cover_photo and session_id = v_session),
    (select id from public.photos where session_id = v_session order by created_at limit 1)
  ) into v_cover;

  select sv.category into v_cat from _lines l join public.services sv on sv.id = l.service_id order by l.pos limit 1;
  select coalesce(nullif(trim(p_style_title), ''), string_agg(name, ' + ' order by pos)) into v_title from _lines;
  insert into public.style_entries (customer_id, session_id, title, category, cover_photo_id)
  values (a.customer_id, v_session, v_title, v_cat, v_cover);

  perform private.set_status(a.id, 'completada');
  v_rewards := private.apply_loyalty(v_session);
  perform private.log(a.business_id, 'sesion.cerrar', v_session::text, v_final || ' cts');
  return jsonb_build_object('session_id', v_session, 'duplicated', false, 'new_rewards', to_jsonb(v_rewards));
end $$;

-- Corrección posterior con autor; no crea otra visita ni vuelve a sumar fidelización.
create or replace function public.correct_session_amount(p_session uuid, p_final_cents int, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.sessions; v_actor public.staff;
begin
  perform private.require_login();
  select * into s from public.sessions where id = p_session for update;
  if not found then perform private.fail('no_encontrada', 'No encontramos la sesión.'); end if;
  v_actor := private.staff_row(s.business_id);
  if v_actor.id is null or not private.can_access_appointment(s.appointment_id) then perform private.fail('sin_permiso', 'No tienes acceso a esta sesión.'); end if;
  if p_final_cents < 0 or coalesce(trim(p_reason), '') = '' then perform private.fail('datos', 'Indica un importe válido y el motivo.'); end if;
  insert into public.session_corrections (session_id, field, from_value, to_value, reason, by_staff)
  values (s.id, 'importe', s.final_cents::text, p_final_cents::text, p_reason, v_actor.id);
  update public.sessions set final_cents = p_final_cents where id = s.id;
  perform private.log(s.business_id, 'sesion.corregir', s.id::text, p_reason);
end $$;

-- Canje verificado: pertenece al cliente, está vigente y no se ha usado.
create or replace function public.redeem_reward(p_code text, p_customer uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.rewards; v_actor public.staff;
begin
  perform private.require_login();
  select * into r from public.rewards where redeem_code = upper(trim(p_code)) for update;
  if not found then perform private.fail('no_encontrada', 'Código de recompensa no válido.'); end if;
  v_actor := private.staff_row(r.business_id);
  if v_actor.id is null then perform private.fail('otro_negocio', 'Esta recompensa es de otro establecimiento.'); end if;
  if r.customer_id <> p_customer then perform private.fail('otro_cliente', 'Esta recompensa no pertenece a este cliente.'); end if;
  if r.status = 'utilizada' then perform private.fail('ya_utilizada', 'Esta recompensa ya se ha canjeado.'); end if;
  if r.status = 'caducada' or r.expires_at <= now() then perform private.fail('caducada', 'Esta recompensa ha caducado.'); end if;
  insert into public.reward_redemptions (reward_id, staff_id) values (r.id, v_actor.id);
  update public.rewards set status = 'utilizada' where id = r.id;
  perform private.log(r.business_id, 'recompensa.canjear', r.id::text);
  return r.id;
end $$;

-- ---------- estilo, preferencias y opiniones ----------

create or replace function public.toggle_favorite(p_entry uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v boolean;
begin
  perform private.require_login();
  update public.style_entries set favorite = not favorite
  where id = p_entry and customer_id = private.current_customer_id() returning favorite into v;
  if v is null then perform private.fail('sin_permiso', 'Ese estilo no es tuyo.'); end if;
  return v;
end $$;

create or replace function public.toggle_want_again(p_entry uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v boolean;
begin
  perform private.require_login();
  update public.style_entries set want_again = not want_again
  where id = p_entry and customer_id = private.current_customer_id() returning want_again into v;
  if v is null then perform private.fail('sin_permiso', 'Ese estilo no es tuyo.'); end if;
  return v;
end $$;

create or replace function public.add_feedback(p_session uuid, p_liked text, p_change text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.sessions; v_actor public.staff; v_id uuid; v_me uuid := private.current_customer_id();
begin
  perform private.require_login();
  select * into s from public.sessions where id = p_session;
  if not found then perform private.fail('no_encontrada', 'No encontramos la visita.'); end if;
  if s.customer_id = v_me then
    insert into public.feedback (customer_id, session_id, kind, liked, change, author, author_id)
    values (s.customer_id, s.id, 'comentario_visita', coalesce(p_liked, ''), coalesce(p_change, ''), 'cliente', auth.uid()) returning id into v_id;
  else
    v_actor := private.staff_row(s.business_id);
    if v_actor.id is null then perform private.fail('sin_permiso', 'No tienes acceso a esta visita.'); end if;
    insert into public.feedback (customer_id, session_id, kind, liked, change, author, author_id)
    values (s.customer_id, s.id, 'comentario_visita', coalesce(p_liked, ''), coalesce(p_change, ''), 'profesional', auth.uid()) returning id into v_id;
  end if;
  return v_id;
end $$;

-- El profesional propone; no cuenta como preferencia hasta que el cliente la confirma.
create or replace function public.propose_preference(p_customer uuid, p_business uuid, p_label text, p_value text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  perform private.require_login();
  if not private.is_staff_of(p_business) or not private.can_view_customer(p_customer, p_business) then
    perform private.fail('sin_permiso', 'No tienes acceso a este cliente.');
  end if;
  insert into public.preferences (customer_id, label, value, origin, confirmed, proposed_by_business)
  values (p_customer, trim(p_label), trim(p_value), 'profesional', false, p_business) returning id into v;
  return v;
end $$;

create or replace function public.add_my_preference(p_label text, p_value text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid; v_me uuid := private.current_customer_id();
begin
  perform private.require_login();
  if v_me is null then perform private.fail('sin_perfil', 'Completa tu perfil.'); end if;
  insert into public.preferences (customer_id, label, value, origin, confirmed) values (v_me, trim(p_label), trim(p_value), 'cliente', true) returning id into v;
  return v;
end $$;

create or replace function public.confirm_preference(p_preference uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_login();
  if not exists (select 1 from public.preferences where id = p_preference and customer_id = private.current_customer_id()) then
    perform private.fail('sin_permiso', 'Esa preferencia no es tuya.');
  end if;
  if p_accept then update public.preferences set confirmed = true where id = p_preference;
  else delete from public.preferences where id = p_preference; end if;
end $$;

-- ---------- lista de espera ----------

-- Ofrece huecos compatibles por orden de llegada. Un hueco ofrecido queda retenido y no se ofrece dos veces.
create or replace function private.process_waitlist(p_business uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare w public.waitlist_requests; v_staff uuid[]; sid uuid; v_dur int; v_slot timestamptz; v_orig timestamptz; tz text;
begin
  update public.waitlist_requests set status = 'caducada'
  where business_id = p_business and status = 'oferta_enviada' and offer_expires_at <= now();

  for w in
    select * from public.waitlist_requests where business_id = p_business and status = 'activa' order by created_at for update skip locked
  loop
    v_staff := case when cardinality(w.staff_ids) > 0 then w.staff_ids else (
      select array_agg(s.id order by s.created_at) from public.staff s
      where s.business_id = p_business and s.active and s.role <> 'propietario'
        and (select count(*) from public.staff_services ss where ss.staff_id = s.id and ss.service_id = any(w.service_ids)) = cardinality(w.service_ids)
    ) end;
    select start_at into v_orig from public.appointments where id = w.original_appointment_id and status in ('confirmada', 'modificada');
    foreach sid in array coalesce(v_staff, '{}') loop
      begin
        select sum(l.duration_min) into v_dur from private.price_lines(sid, w.service_ids) l;
      exception when others then
        continue;
      end;
      tz := private.staff_tz(sid);
      select t into v_slot from private.free_slots_for(sid, w.date, v_dur) t
      where (t at time zone tz)::time >= w.time_from
        and ((t + make_interval(mins => v_dur)) at time zone tz)::time <= w.time_to
        and (v_orig is null or t < v_orig)
      order by t limit 1;
      if v_slot is not null then
        update public.waitlist_requests
        set status = 'oferta_enviada', offer_staff_id = sid, offer_start_at = v_slot,
            offer_end_at = v_slot + make_interval(mins => v_dur), offer_expires_at = now() + interval '30 minutes'
        where id = w.id;
        perform private.log(p_business, 'lista_espera.oferta', w.id::text, v_slot::text);
        exit;
      end if;
    end loop;
  end loop;
end $$;

create or replace function public.join_waitlist(
  p_business uuid, p_service_ids uuid[], p_staff_ids uuid[], p_date date, p_from time, p_to time, p_original uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid; v_me uuid := private.current_customer_id();
begin
  perform private.require_login();
  if v_me is null then perform private.fail('sin_perfil', 'Completa tu perfil.'); end if;
  if p_original is not null and not exists (select 1 from public.appointments where id = p_original and customer_id = v_me) then
    perform private.fail('sin_permiso', 'Esa cita no es tuya.');
  end if;
  insert into public.waitlist_requests (customer_id, business_id, service_ids, staff_ids, date, time_from, time_to, original_appointment_id)
  values (v_me, p_business, p_service_ids, coalesce(p_staff_ids, '{}'), p_date, p_from, p_to, p_original) returning id into v;
  perform private.process_waitlist(p_business);
  return v;
end $$;

-- Aceptar crea la nueva cita y solo entonces cancela la original. Si la oferta caducó, nada cambia.
create or replace function public.accept_offer(p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare w public.waitlist_requests; v_dur int; v_id uuid; v_loc uuid; o public.appointments;
begin
  perform private.require_login();
  select * into w from public.waitlist_requests where id = p_request for update;
  if not found or w.customer_id is distinct from private.current_customer_id() then perform private.fail('sin_permiso', 'Esta solicitud no es tuya.'); end if;
  if w.status <> 'oferta_enviada' then
    return jsonb_build_object('ok', false, 'error', 'sin_oferta', 'message', 'La oferta ya no está vigente. Tu cita original no ha cambiado.');
  end if;
  if w.offer_expires_at <= now() then
    update public.waitlist_requests set status = 'caducada' where id = w.id;
    perform private.process_waitlist(w.business_id);
    return jsonb_build_object('ok', false, 'error', 'sin_oferta', 'message', 'La oferta ha caducado. Tu cita original no ha cambiado.');
  end if;
  perform 1 from public.staff where id = w.offer_staff_id for update;
  select sum(l.duration_min) into v_dur from private.price_lines(w.offer_staff_id, w.service_ids) l;
  if not private.slot_is_free(w.offer_staff_id, w.offer_start_at, v_dur, null, w.id) then
    return jsonb_build_object('ok', false, 'error', 'hueco_no_disponible', 'message', 'El hueco ya no está libre. Tu cita original no ha cambiado.');
  end if;

  select * into o from public.appointments where id = w.original_appointment_id for update;
  select coalesce(o.location_id, (select location_id from public.staff where id = w.offer_staff_id),
                  (select id from public.locations where business_id = w.business_id order by created_at limit 1)) into v_loc;
  v_id := private.create_appointment(v_loc, w.customer_id, w.offer_staff_id, w.service_ids, w.offer_start_at, 'lista_espera', null, 'desde lista de espera');
  update public.waitlist_requests set status = 'aceptada', result_appointment_id = v_id where id = w.id;

  if o.id is not null and o.status in ('confirmada', 'modificada') then
    perform private.set_status(o.id, 'cancelada', 'sustituida por la cita ' || v_id);
    -- La preparación de la cita original acompaña a la nueva.
    insert into public.visit_preparations (appointment_id, mode, style_entry_id, reference_photo_id, keep_text, change_text, note)
    select v_id, mode, style_entry_id, reference_photo_id, keep_text, change_text, note from public.visit_preparations where appointment_id = o.id
    on conflict do nothing;
  end if;
  perform private.log(w.business_id, 'lista_espera.aceptar', w.id::text, v_id::text);
  perform private.process_waitlist(w.business_id);
  return jsonb_build_object('ok', true, 'appointment_id', v_id);
end $$;

create or replace function public.decline_offer(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare w public.waitlist_requests;
begin
  perform private.require_login();
  select * into w from public.waitlist_requests where id = p_request for update;
  if not found or w.customer_id is distinct from private.current_customer_id() then perform private.fail('sin_permiso', 'Esta solicitud no es tuya.'); end if;
  if w.status in ('activa', 'oferta_enviada') then
    update public.waitlist_requests set status = 'cancelada' where id = w.id;
    perform private.process_waitlist(w.business_id);
  end if;
end $$;

-- ---------- gestión ----------

create or replace function public.update_service_price(p_service uuid, p_price_cents int)
returns void language plpgsql security definer set search_path = '' as $$
declare sv public.services;
begin
  perform private.require_login();
  select * into sv from public.services where id = p_service;
  if not found or not private.is_manager_of(sv.business_id) then perform private.fail('sin_permiso', 'Solo la gestión del local puede cambiar precios.'); end if;
  if p_price_cents < 0 then perform private.fail('datos', 'Precio no válido.'); end if;
  update public.services set price_cents = p_price_cents where id = p_service;
  perform private.log(sv.business_id, 'catalogo.precio', sv.id::text, sv.price_cents || ' → ' || p_price_cents);
end $$;

-- Bloquea un tramo. No cancela citas en silencio: devuelve cuántas quedan dentro para gestionarlas.
create or replace function public.add_exception(p_staff uuid, p_start timestamptz, p_end timestamptz, p_kind public.exception_kind, p_note text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare s public.staff; v_conflicts int;
begin
  perform private.require_login();
  select * into s from public.staff where id = p_staff;
  if not found or not private.is_manager_of(s.business_id) then perform private.fail('sin_permiso', 'Solo la gestión del local puede bloquear agenda.'); end if;
  insert into public.availability_exceptions (staff_id, start_at, end_at, kind, note, created_by) values (p_staff, p_start, p_end, p_kind, p_note, auth.uid());
  select count(*) into v_conflicts from public.appointments
  where staff_id = p_staff and status in ('confirmada', 'modificada') and tstzrange(start_at, end_at) && tstzrange(p_start, p_end);
  perform private.log(s.business_id, 'agenda.bloqueo', p_staff::text, p_start::text || ' – ' || p_end::text);
  return v_conflicts;
end $$;

-- Tareas periódicas (programar con pg_cron o una función programada): caducidades y lista de espera.
create or replace function public.run_housekeeping()
returns void language plpgsql security definer set search_path = '' as $$
declare b uuid;
begin
  update public.rewards set status = 'caducada' where status = 'disponible' and expires_at <= now();
  for b in select distinct business_id from public.waitlist_requests where status in ('activa', 'oferta_enviada') loop
    perform private.process_waitlist(b);
  end loop;
end $$;

-- Alta de un negocio con su propietario. Solo con la clave de servicio (panel o script de alta).
create or replace function public.create_business(p_name text, p_owner_user uuid, p_owner_name text, p_location_name text, p_address text default '', p_timezone text default 'Europe/Madrid')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_location uuid;
begin
  insert into public.businesses (name) values (p_name) returning id into v_business;
  insert into public.locations (business_id, name, address, timezone) values (v_business, p_location_name, p_address, p_timezone) returning id into v_location;
  insert into public.staff (business_id, location_id, user_id, display_name, role) values (v_business, v_location, p_owner_user, p_owner_name, 'propietario');
  return v_business;
end $$;

-- El propietario da de alta a alguien que ya tiene cuenta (por correo).
create or replace function public.add_staff_member(p_business uuid, p_email text, p_display_name text, p_role public.staff_role default 'barbero')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v uuid;
begin
  perform private.require_login();
  if not exists (select 1 from public.staff where user_id = auth.uid() and business_id = p_business and role = 'propietario' and active) then
    perform private.fail('sin_permiso', 'Solo el propietario puede añadir personal.');
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then perform private.fail('sin_cuenta', 'Esa persona debe crear su cuenta primero.'); end if;
  insert into public.staff (business_id, location_id, user_id, display_name, role)
  values (p_business, (select id from public.locations where business_id = p_business order by created_at limit 1), v_user, p_display_name, p_role)
  on conflict (business_id, user_id) do update set active = true, role = excluded.role, display_name = excluded.display_name
  returning id into v;
  perform private.log(p_business, 'equipo.alta', v::text, p_role::text);
  return v;
end $$;

-- Retirar a alguien del equipo revoca sus accesos de inmediato (todas las comprobaciones exigen active).
create or replace function public.deactivate_staff_member(p_staff uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.staff;
begin
  perform private.require_login();
  select * into s from public.staff where id = p_staff;
  if not found or not exists (select 1 from public.staff where user_id = auth.uid() and business_id = s.business_id and role = 'propietario' and active) then
    perform private.fail('sin_permiso', 'Solo el propietario puede retirar personal.');
  end if;
  update public.staff set active = false where id = p_staff;
  perform private.log(s.business_id, 'equipo.baja', p_staff::text);
end $$;

-- ---------- privilegios de ejecución ----------

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on function public.free_slots(uuid, date, uuid[]) to anon;
grant execute on function public.portfolio(uuid, uuid) to anon;
revoke execute on function public.create_business(text, uuid, text, text, text, text) from authenticated;
revoke execute on function public.run_housekeeping() from authenticated;

-- Las políticas RLS se evalúan con el rol de quien consulta: necesita poder ejecutar estas.
grant execute on function private.current_customer_id() to anon, authenticated;
grant execute on function private.is_staff_of(uuid) to anon, authenticated;
grant execute on function private.is_manager_of(uuid) to anon, authenticated;
grant execute on function private.can_access_appointment(uuid) to anon, authenticated;
grant execute on function private.can_view_customer(uuid, uuid) to anon, authenticated;
grant execute on function private.has_photo_permission(uuid, public.photo_purpose) to anon, authenticated;
