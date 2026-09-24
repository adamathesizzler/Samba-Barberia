-- Datos ficticios para las pruebas. Horarios relativos a now() para que las pruebas no dependan del día.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'marta@demo.test'),   -- propietaria de Norte
  ('00000000-0000-0000-0000-00000000a002', 'david@demo.test'),   -- barbero de Norte
  ('00000000-0000-0000-0000-00000000a003', 'sara@demo.test'),    -- barbera de Norte
  ('00000000-0000-0000-0000-00000000a004', 'leo@demo.test'),     -- barbero de Sur (otro negocio)
  ('00000000-0000-0000-0000-00000000c001', 'nico@demo.test'),    -- cliente
  ('00000000-0000-0000-0000-00000000c002', 'alex@demo.test'),    -- cliente
  ('00000000-0000-0000-0000-00000000c003', 'marco@demo.test'),   -- cliente
  ('00000000-0000-0000-0000-00000000c004', null);                -- invitado anónimo sin perfil

create table tests.fixtures (k text primary key, id uuid);
grant select on tests.fixtures to anon, authenticated;

do $$
declare norte uuid; sur uuid; loc uuid; loc_sur uuid; david uuid; sara uuid; leo uuid;
  corte uuid; degradado uuid; barba uuid; corte_sur uuid; nico uuid; alex uuid; marco uuid; d int;
begin
  norte := public.create_business('Barbería Norte (prueba)', '00000000-0000-0000-0000-00000000a001', 'Marta', 'Norte · Centro');
  sur := public.create_business('Estudio Sur (prueba)', null, 'Sin dueño', 'Sur');
  select id into loc from public.locations where business_id = norte;
  select id into loc_sur from public.locations where business_id = sur;

  insert into public.staff (business_id, location_id, user_id, display_name, role) values
    (norte, loc, '00000000-0000-0000-0000-00000000a002', 'David', 'barbero') returning id into david;
  insert into public.staff (business_id, location_id, user_id, display_name, role) values
    (norte, loc, '00000000-0000-0000-0000-00000000a003', 'Sara', 'barbero') returning id into sara;
  insert into public.staff (business_id, location_id, user_id, display_name, role) values
    (sur, loc_sur, '00000000-0000-0000-0000-00000000a004', 'Leo', 'barbero') returning id into leo;

  insert into public.services (business_id, name, category, duration_min, price_cents) values (norte, 'Corte', 'corte', 30, 2200) returning id into corte;
  insert into public.services (business_id, name, category, duration_min, price_cents) values (norte, 'Degradado', 'degradado', 35, 2400) returning id into degradado;
  insert into public.services (business_id, name, category, duration_min, price_cents) values (norte, 'Barba', 'barba', 15, 1000) returning id into barba;
  insert into public.services (business_id, name, category, duration_min, price_cents) values (sur, 'Corte clásico', 'corte', 30, 1900) returning id into corte_sur;

  insert into public.staff_services (staff_id, service_id) values
    (david, corte), (david, degradado), (david, barba), (sara, corte), (sara, degradado), (leo, corte_sur);

  for d in 0..6 loop
    insert into public.availability_rules (staff_id, weekday, start_time, end_time) values
      (david, d, '09:00', '20:00'), (sara, d, '09:00', '20:00'), (leo, d, '09:00', '20:00');
  end loop;

  insert into public.loyalty_programs (business_id, goal, reward_name, reward_benefit, reward_conditions, valid_days)
  values (norte, 10, 'Corte incluido', 'Un Corte sin coste', 'Solo el servicio Corte.', 90);

  insert into public.customers (user_id, display_name) values ('00000000-0000-0000-0000-00000000c001', 'Nico') returning id into nico;
  insert into public.customers (user_id, display_name) values ('00000000-0000-0000-0000-00000000c002', 'Alex') returning id into alex;
  insert into public.customers (user_id, display_name) values ('00000000-0000-0000-0000-00000000c003', 'Marco') returning id into marco;

  -- Nico lleva 9 visitas: la próxima completa el programa.
  insert into public.loyalty_movements (customer_id, business_id, delta, reason)
  select nico, norte, 1, 'visitas anteriores (prueba)' from generate_series(1, 9);

  insert into tests.fixtures values ('norte', norte), ('sur', sur), ('loc', loc), ('david', david), ('sara', sara), ('leo', leo),
    ('corte', corte), ('degradado', degradado), ('barba', barba), ('corte_sur', corte_sur),
    ('nico', nico), ('alex', alex), ('marco', marco);
end $$;

-- Cita de Nico con David HOY (insertada directamente para que exista a cualquier hora del día de la prueba).
do $$
declare v uuid; t timestamptz := now() + interval '1 minute';
begin
  -- Si queda menos de una hora para medianoche, se usa un inicio en el pasado inmediato del mismo día.
  if ((t + interval '50 minutes') at time zone 'Europe/Madrid')::date <> (t at time zone 'Europe/Madrid')::date then
    t := now() - interval '55 minutes';
  end if;
  insert into public.appointments (code, business_id, location_id, customer_id, staff_id, start_at, end_at, busy_until)
  values ('B00001', (select id from tests.fixtures where k = 'norte'), (select id from tests.fixtures where k = 'loc'), (select id from tests.fixtures where k = 'nico'),
          (select id from tests.fixtures where k = 'david'), t, t + interval '50 minutes', t + interval '55 minutes')
  returning id into v;
  insert into public.appointment_services (appointment_id, position, service_id, name, duration_min, price_cents, price_kind) values
    (v, 1, (select id from tests.fixtures where k = 'degradado'), 'Degradado', 35, 2400, 'fijo'),
    (v, 2, (select id from tests.fixtures where k = 'barba'), 'Barba', 15, 1000, 'fijo');
  insert into public.appointment_passes (appointment_id, token) values (v, 'token-nico-hoy');
  insert into public.customer_business_links (customer_id, business_id) values ((select id from tests.fixtures where k = 'nico'), (select id from tests.fixtures where k = 'norte'));
  insert into tests.fixtures values ('cita_hoy', v);
end $$;

-- Fecha y hora local de Madrid a N días vista.
create function tests.at_local(p_days int, p_time time) returns timestamptz language sql stable as $$
  select (((now() at time zone 'Europe/Madrid')::date + p_days) + p_time) at time zone 'Europe/Madrid'
$$;
create function tests.fx(p_key text) returns uuid language sql stable as $$ select id from tests.fixtures where k = p_key $$;
grant execute on function tests.at_local(int, time), tests.fx(text) to anon, authenticated;
