-- Check-in, cierre de sesión, fotos, fidelización y canje (§13, §18, §19, §29-32, §66).
begin;

-- Check-in.
select tests.login('00000000-0000-0000-0000-00000000c001');
select tests.fails($$select public.check_in('token-nico-hoy')$$, 'sin_permiso', 'un cliente no registra llegadas');
select tests.logout();

select tests.login('00000000-0000-0000-0000-00000000a004');
select tests.fails($$select public.check_in('token-nico-hoy')$$, 'otro_negocio', 'el QR de otro negocio no da acceso');
select tests.logout();

select tests.login('00000000-0000-0000-0000-00000000a002');
select tests.fails(format('select public.close_session(%L, array[%L, %L]::uuid[])', tests.fx('cita_hoy'), tests.fx('degradado'), tests.fx('barba')),
  'sin_llegada', 'no se cierra una sesión sin llegada registrada');
select tests.fails($$select public.check_in('inventado')$$, 'no_encontrado', 'un QR inventado no identifica nada');
select tests.eq((select public.check_in('SAMBA-CHECKIN:token-nico-hoy') ->> 'status'), 'registrado', 'un QR válido registra la llegada');
select tests.eq((select public.check_in('token-nico-hoy') ->> 'status'), 'ya_registrado', 'repetir el escaneo no duplica');
select tests.eq((select public.check_in(null, tests.fx('cita_hoy')) ->> 'status'), 'ya_registrado', 'el check-in manual comparte el mismo estado');
select tests.eq((select count(*)::int from public.check_ins where appointment_id = tests.fx('cita_hoy')), 1, 'hay una sola llegada');

-- Fotos: una subida correcta y una fallida.
create temp table ph as
  select (public.register_photo(tests.fx('cita_hoy'), 'frontal') ->> 'photo_id')::uuid as ok_id,
         (public.register_photo(tests.fx('cita_hoy'), 'lateral_izq') ->> 'photo_id')::uuid as bad_id;
select tests.eq(public.confirm_photo((select ok_id from ph), true)::text, 'subida', 'una subida confirmada queda guardada');
select tests.eq(public.confirm_photo((select bad_id from ph), false)::text, 'fallida', 'una subida fallida queda como fallida');

-- Cierre: se añade Cejas? No existe; se cobra lo reservado + ajuste confirmado.
create temp table c1 as select public.close_session(
  tests.fx('cita_hoy'), array[tests.fx('degradado'), tests.fx('barba')], 300, 'Más volumen lateral', 'Cera mate',
  array['Cera mate'], '[{"name":"Cera 75 ml","qty":1,"price_cents":1400}]', array[(select ok_id from ph), (select bad_id from ph)], null, '', 'registrado_en_local'
) as r;
select tests.eq(((select r from c1) ->> 'duplicated')::boolean, false, 'la sesión se cierra');
select tests.eq(jsonb_array_length((select r from c1) -> 'new_rewards'), 1, 'la décima visita desbloquea una recompensa');
select tests.eq((select final_cents from public.sessions where appointment_id = tests.fx('cita_hoy')), 3700, 'importe final = reservado + ajuste confirmado');
select tests.eq((select array_agg(id) from public.photos where session_id = ((select r from c1) ->> 'session_id')::uuid), array[(select ok_id from ph)], 'solo la foto subida entra en la visita');
select tests.eq((select count(*)::int from public.session_products where kind = 'vendido'), 1, 'el producto vendido se registra aparte');

create temp table c2 as select public.close_session(tests.fx('cita_hoy'), array[tests.fx('degradado')]) as r;
select tests.eq(((select r from c2) ->> 'duplicated')::boolean, true, 'repetir el cierre devuelve la sesión existente');
select tests.eq((select count(*)::int from public.sessions where appointment_id = tests.fx('cita_hoy')), 1, 'no se duplica la visita');
select tests.logout();
select tests.eq((select sum(delta)::int from public.loyalty_movements where customer_id = tests.fx('nico')), 10, 'la fidelización suma una sola vez');
select tests.eq((select count(*)::int from public.rewards where customer_id = tests.fx('nico')), 1, 'y crea una sola recompensa');

-- Corrección con autor, sin crear otra visita.
select tests.login('00000000-0000-0000-0000-00000000a002');
select public.correct_session_amount(((select r from c1) ->> 'session_id')::uuid, 3400, 'ajuste retirado');
select tests.eq((select count(*)::int from public.session_corrections), 1, 'la corrección queda registrada');
select tests.eq((select count(*)::int from public.sessions where customer_id = tests.fx('nico')), 1, 'corregir no crea otra visita');
select tests.logout();

-- El cliente ve su resultado y su recompensa.
select tests.login('00000000-0000-0000-0000-00000000c001');
select tests.eq((select count(*)::int from public.style_entries), 1, 'el resultado aparece en Mi estilo');
select tests.eq((select status::text from public.rewards), 'disponible', 'el cliente ve la recompensa disponible');
select public.toggle_favorite((select id from public.style_entries limit 1));
select tests.eq((select favorite from public.style_entries limit 1), true, 'el cliente marca un favorito');
create temp table code as select redeem_code from public.rewards limit 1;
select tests.logout();

-- Canje.
select tests.login('00000000-0000-0000-0000-00000000a004');
select tests.fails(format('select public.redeem_reward(%L, %L)', (select redeem_code from code), tests.fx('nico')), 'otro_negocio', 'otro negocio no canjea la recompensa');
select tests.logout();
select tests.login('00000000-0000-0000-0000-00000000a003');
select tests.fails(format('select public.redeem_reward(%L, %L)', (select redeem_code from code), tests.fx('alex')), 'otro_cliente', 'no se canjea para otro cliente');
select public.redeem_reward((select redeem_code from code), tests.fx('nico'));
select tests.fails(format('select public.redeem_reward(%L, %L)', (select redeem_code from code), tests.fx('nico')), 'ya_utilizada', 'un premio no se canjea dos veces');
select tests.logout();

-- Caducidad.
update public.rewards set status = 'disponible', expires_at = now() - interval '1 day' where customer_id = tests.fx('nico');
delete from public.reward_redemptions;
select tests.login('00000000-0000-0000-0000-00000000a003');
select tests.fails(format('select public.redeem_reward(%L, %L)', (select redeem_code from code), tests.fx('nico')), 'caducada', 'una recompensa vencida no se canjea');
select tests.logout();
select public.run_housekeeping();
select tests.eq((select status::text from public.rewards where customer_id = tests.fx('nico')), 'caducada', 'las tareas periódicas marcan las vencidas');

rollback;

-- Una cita cancelada no suma y no se puede cerrar.
begin;
select tests.login('00000000-0000-0000-0000-00000000c001');
select public.cancel_appointment(tests.fx('cita_hoy'));
select tests.logout();
select tests.login('00000000-0000-0000-0000-00000000a002');
select tests.fails($$select public.check_in('token-nico-hoy')$$, 'cancelada', 'un QR cancelado no registra llegada');
select tests.fails(format('select public.close_session(%L, array[%L]::uuid[])', tests.fx('cita_hoy'), tests.fx('degradado')), 'sin_llegada', 'una cita cancelada no se cierra');
select tests.logout();
select tests.eq((select sum(delta)::int from public.loyalty_movements where customer_id = tests.fx('nico')), 9, 'una cita cancelada no suma a la fidelización');
rollback;

-- Cliente sin reserva.
begin;
select tests.login('00000000-0000-0000-0000-00000000a003');
create temp table w as select public.walk_in('Paso por aquí', tests.fx('sara'), array[tests.fx('corte')]) as id;
select tests.eq((select status::text from public.appointments where id = (select id from w)), 'llegada', 'el cliente sin reserva queda con la llegada hecha');
select tests.eq((select guest from public.customers c join public.appointments a on a.customer_id = c.id where a.id = (select id from w)), true, 'y como invitado sin cuenta');
select tests.logout();
select tests.login('00000000-0000-0000-0000-00000000c001');
select tests.fails(format('select public.walk_in(%L, %L, array[%L]::uuid[])', 'X', tests.fx('sara'), tests.fx('corte')), 'sin_permiso', 'un cliente no registra clientes sin reserva');
select tests.logout();
rollback;
