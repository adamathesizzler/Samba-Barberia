-- Reservas y agenda (§9, §10, §66).
begin;

-- Nico reserva un Corte con Sara dentro de 3 días a las 10:00.
select tests.login('00000000-0000-0000-0000-00000000c001');
create temp table r as select public.book_appointment(tests.fx('sara'), array[tests.fx('corte')], tests.at_local(3, '10:00')) as id;
select tests.eq((select status::text from public.appointments where id = (select id from r)), 'confirmada', 'la reserva queda confirmada');
select tests.eq((select price_cents from public.appointment_services where appointment_id = (select id from r)), 2200, 'la cita guarda el precio del momento');
select tests.eq((select count(*)::int from public.appointment_passes where appointment_id = (select id from r)), 1, 'el cliente ve el token de su QR');

-- Alex intenta el mismo hueco: rechazado, sin crear nada.
select tests.logout();
select tests.login('00000000-0000-0000-0000-00000000c002');
select tests.fails(format('select public.book_appointment(%L, array[%L]::uuid[], %L)', tests.fx('sara'), tests.fx('corte'), tests.at_local(3, '10:00')),
  'hueco_no_disponible', 'dos personas no obtienen el mismo hueco');
select tests.fails(format('select public.book_appointment(%L, array[%L]::uuid[], %L)', tests.fx('sara'), tests.fx('corte'), tests.at_local(3, '10:20')),
  'hueco_no_disponible', 'tampoco un hueco solapado dentro del margen del profesional');
select tests.fails(format('select public.book_appointment(%L, array[%L]::uuid[], %L, %L)', tests.fx('sara'), tests.fx('corte'), tests.at_local(3, '12:00'), tests.fx('nico')),
  'sin_permiso', 'un cliente no puede reservar en nombre de otro');
select tests.fails(format('select public.book_appointment(%L, array[%L]::uuid[], %L)', tests.fx('sara'), tests.fx('barba'), tests.at_local(3, '12:00')),
  'servicio_no_disponible', 'no se reserva un servicio que el profesional no hace');
select tests.fails(format('select public.book_appointment(%L, array[%L]::uuid[], %L)', tests.fx('sara'), tests.fx('corte'), tests.at_local(3, '19:45')),
  'hueco_no_disponible', 'un hueco que no permite terminar el servicio no es reservable');
select tests.fails(format('select public.book_appointment(%L, array[%L]::uuid[], %L)', tests.fx('sara'), tests.fx('corte'), now() - interval '1 hour'),
  'hora_pasada', 'no se reserva en el pasado');

-- Escritura directa: prohibida (solo mediante funciones).
select tests.fails(format($$insert into public.appointments (code, business_id, location_id, customer_id, staff_id, start_at, end_at, busy_until)
  values ('X1', %L, %L, %L, %L, now() + interval '5 days', now() + interval '5 days 30 min', now() + interval '5 days 35 min')$$,
  tests.fx('norte'), tests.fx('loc'), tests.fx('alex'), tests.fx('sara')), '42501', 'la app no puede insertar citas saltándose las reglas');
select tests.fails(format('update public.services set price_cents = 1 where id = %L', tests.fx('corte')), '42501', 'la app no puede cambiar precios directamente');
select tests.logout();

-- Invitado anónimo sin perfil: debe crear su perfil (queda como invitado) antes de reservar.
select tests.login('00000000-0000-0000-0000-00000000c004', true);
select tests.fails(format('select public.book_appointment(%L, array[%L]::uuid[], %L)', tests.fx('sara'), tests.fx('corte'), tests.at_local(3, '15:00')),
  'sin_perfil', 'sin perfil no se reserva');
select public.ensure_customer_profile('Invitado');
select tests.eq((select guest from public.customers where user_id = auth.uid()), true, 'un usuario anónimo queda como invitado');
select public.book_appointment(tests.fx('sara'), array[tests.fx('corte')], tests.at_local(3, '15:00'));
select tests.eq((select count(*)::int from public.appointments), 1, 'el invitado solo ve su propia cita');
select tests.logout();

-- Descanso: el hueco deja de ofrecerse.
insert into public.availability_exceptions (staff_id, start_at, end_at, kind) values (tests.fx('sara'), tests.at_local(3, '13:00'), tests.at_local(3, '14:00'), 'descanso');
select tests.eq(private.slot_is_free(tests.fx('sara'), tests.at_local(3, '13:15'), 30), false, 'no se ofrecen huecos en un descanso');
select tests.eq(private.slot_is_free(tests.fx('sara'), tests.at_local(3, '14:00'), 30), true, 'el hueco tras el descanso sí está libre');

-- Público (anon): ve huecos y catálogo, no citas.
select tests.as_anon();
select tests.eq((select count(*) > 0 from public.free_slots(tests.fx('sara'), (now() at time zone 'Europe/Madrid')::date + 3, array[tests.fx('corte')])), true, 'cualquiera consulta huecos libres');
select tests.eq((select bool_and(t <> tests.at_local(3, '10:00')) from public.free_slots(tests.fx('sara'), (now() at time zone 'Europe/Madrid')::date + 3, array[tests.fx('corte')]) t), true, 'un hueco reservado no aparece como libre');
select tests.eq((select count(*)::int from public.appointments), 0, 'anónimo no ve ninguna cita');
select tests.eq((select count(*) > 0 from public.services), true, 'anónimo ve el catálogo');
select tests.fails(format('select public.book_appointment(%L, array[%L]::uuid[], %L)', tests.fx('sara'), tests.fx('corte'), tests.at_local(3, '16:00')), '42501', 'anónimo no puede reservar sin sesión');
select tests.logout();

-- Cambio de precio: la cita existente conserva su importe.
select tests.login('00000000-0000-0000-0000-00000000a002');
select tests.fails(format('select public.update_service_price(%L, 9900)', tests.fx('corte')), 'sin_permiso', 'un barbero no cambia precios');
select tests.logout();
select tests.login('00000000-0000-0000-0000-00000000a001');
select public.update_service_price(tests.fx('corte'), 2500);
select tests.logout();
select tests.eq((select price_cents from public.appointment_services where appointment_id = (select id from r)), 2200, 'cambiar el catálogo no altera la cita reservada');

-- Reprogramar y cancelar.
select tests.login('00000000-0000-0000-0000-00000000c001');
select public.reschedule_appointment((select id from r), tests.at_local(3, '11:00'));
select tests.eq((select status::text from public.appointments where id = (select id from r)), 'modificada', 'reprogramar deja la cita como modificada');
select public.cancel_appointment((select id from r));
select tests.eq((select status::text from public.appointments where id = (select id from r)), 'cancelada', 'el cliente cancela su cita');
select tests.fails(format('select public.cancel_appointment(%L)', (select id from r)), 'estado', 'no se cancela dos veces');
select tests.logout();
select tests.login('00000000-0000-0000-0000-00000000c002');
select public.book_appointment(tests.fx('sara'), array[tests.fx('corte')], tests.at_local(3, '11:00'));
select tests.eq((select price_cents from public.appointment_services limit 1), 2500, 'una reserva nueva usa el precio actual');
select tests.logout();

rollback;
