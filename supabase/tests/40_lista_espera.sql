-- Lista de espera (§28, §66): no cancela la original sin aceptar y no ofrece dos veces el mismo hueco.
begin;

-- Alex ocupa toda la tarde de Sara dentro de 4 días (15:00-20:00, citas de 30 min cada 45).
select tests.login('00000000-0000-0000-0000-00000000c002');
do $$
declare t time := '15:00';
begin
  while t <= '19:30' loop
    perform public.book_appointment(tests.fx('sara'), array[tests.fx('corte')], tests.at_local(4, t));
    t := t + interval '45 minutes';
  end loop;
end $$;
select tests.logout();

-- Nico tiene cita dentro de 6 días y pide algo antes, la tarde del día 4.
select tests.login('00000000-0000-0000-0000-00000000c001');
create temp table orig as select public.book_appointment(tests.fx('sara'), array[tests.fx('corte')], tests.at_local(6, '17:00')) as id;
create temp table w1 as select public.join_waitlist(tests.fx('norte'), array[tests.fx('corte')], array[tests.fx('sara')],
  (now() at time zone 'Europe/Madrid')::date + 4, '15:00', '20:00', (select id from orig)) as id;
select tests.eq((select status::text from public.waitlist_requests where id = (select id from w1)), 'activa', 'sin hueco, la solicitud queda activa');
select tests.logout();

select tests.login('00000000-0000-0000-0000-00000000c003');
create temp table w2 as select public.join_waitlist(tests.fx('norte'), array[tests.fx('corte')], array[tests.fx('sara')],
  (now() at time zone 'Europe/Madrid')::date + 4, '15:00', '20:00') as id;
select tests.logout();

-- Alex cancela su cita de las 15:45: se ofrece a Nico (primero en llegar), no a Marco.
select tests.login('00000000-0000-0000-0000-00000000c002');
select public.cancel_appointment((select id from public.appointments where start_at = tests.at_local(4, '15:45')));
select tests.logout();
select tests.eq((select status::text from public.waitlist_requests where id = (select id from w1)), 'oferta_enviada', 'el hueco liberado se ofrece al primero');
select tests.eq((select status::text from public.waitlist_requests where id = (select id from w2)), 'activa', 'el mismo hueco no se ofrece a dos personas');
select tests.eq((select status::text from public.appointments where id = (select id from orig)), 'confirmada', 'la cita original sigue intacta mientras hay oferta');
select tests.eq(private.slot_is_free(tests.fx('sara'), tests.at_local(4, '15:45'), 30), false, 'el hueco ofrecido queda retenido');

-- Nadie puede reservar ese hueco mientras está retenido.
select tests.login('00000000-0000-0000-0000-00000000c003');
select tests.fails(format('select public.book_appointment(%L, array[%L]::uuid[], %L)', tests.fx('sara'), tests.fx('corte'), tests.at_local(4, '15:45')),
  'hueco_no_disponible', 'el hueco retenido no se vende a otro');
select tests.fails(format('select public.accept_offer(%L)', (select id from w1)), 'sin_permiso', 'nadie acepta la oferta de otro');
select tests.logout();

-- Nico acepta: nueva cita y, solo entonces, se cancela la original.
select tests.login('00000000-0000-0000-0000-00000000c001');
create temp table acc as select public.accept_offer((select id from w1)) as r;
select tests.eq(((select r from acc) ->> 'ok')::boolean, true, 'aceptar crea la nueva cita');
select tests.eq((select status::text from public.appointments where id = (select id from orig)), 'cancelada', 'la original se cancela al aceptar');
select tests.eq((select start_at from public.appointments where id = ((select r from acc) ->> 'appointment_id')::uuid), tests.at_local(4, '15:45'), 'en el hueco ofrecido');
select tests.logout();
select tests.eq((select count(*)::int from public.appointments where staff_id = tests.fx('sara') and start_at = tests.at_local(4, '15:45') and status <> 'cancelada'), 1, 'el hueco se vende una sola vez');

rollback;

-- Oferta caducada: no cambia nada.
begin;
select tests.login('00000000-0000-0000-0000-00000000c002');
do $$
declare t time := '15:00';
begin
  while t <= '19:30' loop
    perform public.book_appointment(tests.fx('sara'), array[tests.fx('corte')], tests.at_local(4, t));
    t := t + interval '45 minutes';
  end loop;
end $$;
select tests.logout();
select tests.login('00000000-0000-0000-0000-00000000c001');
create temp table orig as select public.book_appointment(tests.fx('sara'), array[tests.fx('corte')], tests.at_local(6, '17:00')) as id;
create temp table w1 as select public.join_waitlist(tests.fx('norte'), array[tests.fx('corte')], array[tests.fx('sara')],
  (now() at time zone 'Europe/Madrid')::date + 4, '15:00', '20:00', (select id from orig)) as id;
select tests.logout();
select tests.login('00000000-0000-0000-0000-00000000c002');
select public.cancel_appointment((select id from public.appointments where start_at = tests.at_local(4, '15:45')));
select tests.logout();
update public.waitlist_requests set offer_expires_at = now() - interval '1 minute' where id = (select id from w1);
select tests.login('00000000-0000-0000-0000-00000000c001');
select tests.eq((select public.accept_offer((select id from w1)) ->> 'error'), 'sin_oferta', 'una oferta caducada no se puede aceptar');
select tests.logout();
select tests.eq((select status::text from public.appointments where id = (select id from orig)), 'confirmada', 'y la cita original no cambia');
select tests.eq((select status::text from public.waitlist_requests where id = (select id from w1)), 'caducada', 'la solicitud queda caducada');
rollback;
