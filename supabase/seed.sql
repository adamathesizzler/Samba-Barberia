-- Datos de DEMOSTRACIÓN para desarrollo local (`supabase db reset`). Nunca en producción.
-- El personal se crea sin cuenta; para entrar como barbero, crea el usuario y enlázalo con:
--   update public.staff set user_id = '<id de auth.users>' where display_name = 'David';
do $$
declare norte uuid; loc uuid; david uuid; sara uuid; d int;
begin
  norte := public.create_business('Barbería Norte (demo)', null, 'Marta', 'Norte · Centro', 'Calle Ejemplo 12 (ficticia)');
  select id into loc from public.locations where business_id = norte;
  insert into public.staff (business_id, location_id, display_name, bio, specialties)
  values (norte, loc, 'David', 'Degradados limpios y barbas con contorno natural.', '{Degradados,Barba}') returning id into david;
  insert into public.staff (business_id, location_id, display_name, bio, specialties)
  values (norte, loc, 'Sara', 'Color, texturas y trenzas.', '{Color,Trenzas,Tijera}') returning id into sara;

  insert into public.services (business_id, name, category, duration_min, price_cents, price_kind) values
    (norte, 'Corte', 'corte', 30, 2200, 'fijo'), (norte, 'Degradado', 'degradado', 35, 2400, 'fijo'),
    (norte, 'Barba', 'barba', 15, 1000, 'fijo'), (norte, 'Cejas', 'cejas', 10, 500, 'fijo'),
    (norte, 'Color', 'color', 60, 3500, 'desde'), (norte, 'Trenzas', 'trenzas', 90, 4500, 'desde');
  insert into public.staff_services (staff_id, service_id)
  select david, id from public.services where business_id = norte and name in ('Corte', 'Degradado', 'Barba', 'Cejas')
  union all
  select sara, id from public.services where business_id = norte and name in ('Corte', 'Degradado', 'Cejas', 'Color', 'Trenzas');

  for d in 1..5 loop
    insert into public.availability_rules (staff_id, weekday, start_time, end_time) values
      (david, d, '09:00', '14:00'), (david, d, '15:00', '20:00'), (sara, d, '09:00', '14:00'), (sara, d, '15:00', '20:00');
  end loop;
  insert into public.availability_rules (staff_id, weekday, start_time, end_time) values (david, 6, '09:00', '14:00'), (sara, 6, '09:00', '14:00');

  -- Programa elegido por el promotor (24/09/2026): 10 visitas → 1 corte, 90 días.
  insert into public.loyalty_programs (business_id, goal, reward_name, reward_benefit, reward_conditions, valid_days)
  values (norte, 10, 'Corte incluido', 'Un servicio de Corte sin coste', 'Solo el servicio Corte; extras aparte. Exclusiones pendientes de definir.', 90);
  insert into public.achievements (business_id, name, description, threshold) values
    (norte, 'Regular', '5 visitas atendidas', 5), (norte, 'Signature', '10 visitas atendidas', 10), (norte, 'Loyal', '25 visitas atendidas', 25);
end $$;
