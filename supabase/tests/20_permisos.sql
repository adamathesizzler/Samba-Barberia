-- Aislamiento y matriz de acceso (§42, §52, §55, §66).
begin;

-- Historial previo de Nico con David, con una foto privada y otra autorizada para portfolio.
do $$
declare s uuid; a uuid; p1 uuid; p2 uuid;
begin
  insert into public.appointments (code, business_id, location_id, customer_id, staff_id, start_at, end_at, busy_until, status)
  values ('B00900', tests.fx('norte'), tests.fx('loc'), tests.fx('nico'), tests.fx('david'), now() - interval '30 days', now() - interval '30 days' + interval '30 min', now() - interval '30 days' + interval '35 min', 'completada')
  returning id into a;
  insert into public.sessions (appointment_id, business_id, customer_id, staff_id, estimated_cents, final_cents, duration_min, technical_note, closed_by)
  values (a, tests.fx('norte'), tests.fx('nico'), tests.fx('david'), 2200, 2200, 30, 'nota interna', tests.fx('david')) returning id into s;
  insert into public.photos (business_id, customer_id, appointment_id, session_id, source, status, uploaded_by, storage_path)
  values (tests.fx('norte'), tests.fx('nico'), a, s, 'profesional', 'subida', '00000000-0000-0000-0000-00000000a002', 'x/1') returning id into p1;
  insert into public.photos (business_id, customer_id, appointment_id, session_id, source, status, uploaded_by, storage_path)
  values (tests.fx('norte'), tests.fx('nico'), a, s, 'profesional', 'subida', '00000000-0000-0000-0000-00000000a002', 'x/2') returning id into p2;
  insert into public.photo_permissions (photo_id, purpose, granted) values (p1, 'historial_privado', true), (p2, 'historial_privado', true), (p2, 'portfolio', true);
  insert into tests.fixtures values ('sesion_previa', s), ('foto_privada', p1), ('foto_portfolio', p2);
end $$;

-- Nico ve todo lo suyo.
select tests.login('00000000-0000-0000-0000-00000000c001');
select tests.eq((select count(*)::int from public.sessions), 1, 'el cliente ve su historial');
select tests.eq((select count(*)::int from public.photos), 2, 'el cliente ve sus fotos');
select tests.logout();

-- Alex: ningún dato de Nico.
select tests.login('00000000-0000-0000-0000-00000000c002');
select tests.eq((select count(*)::int from public.appointments), 0, 'otro cliente no ve citas ajenas');
select tests.eq((select count(*)::int from public.sessions), 0, 'otro cliente no ve historiales ajenos');
select tests.eq((select count(*)::int from public.photos), 0, 'otro cliente no ve fotos ajenas');
select tests.eq((select count(*)::int from public.customers), 1, 'otro cliente solo ve su propio perfil');
select tests.fails(format('select public.set_photo_permission(%L, %L, true)', tests.fx('foto_privada'), 'portfolio'), 'sin_permiso', 'solo el dueño decide sobre sus fotos');
select tests.logout();

-- David (barbero asignado): ve el historial de Nico en su negocio y el QR no.
select tests.login('00000000-0000-0000-0000-00000000a002');
select tests.eq((select count(*)::int from public.sessions where customer_id = tests.fx('nico')), 1, 'el barbero asignado ve el historial del cliente');
select tests.eq((select count(*)::int from public.appointment_passes), 0, 'el barbero no puede leer el token del QR');
select tests.eq((select count(*)::int from public.loyalty_movements), 0, 'el barbero no ve los movimientos de fidelización');
select tests.logout();

-- Sara (barbera del mismo negocio sin citas con Nico): nada.
select tests.login('00000000-0000-0000-0000-00000000a003');
select tests.eq((select count(*)::int from public.sessions where customer_id = tests.fx('nico')), 0, 'un barbero sin citas con el cliente no ve su historial');
select tests.eq((select count(*)::int from public.appointments where id = tests.fx('cita_hoy')), 0, 'ni su cita por identificador directo');
select tests.eq((select count(*)::int from public.photos where id = tests.fx('foto_privada')), 0, 'ni sus fotos por identificador directo');
select tests.logout();

-- Leo (otro negocio): nada de Norte.
select tests.login('00000000-0000-0000-0000-00000000a004');
select tests.eq((select count(*)::int from public.appointments where business_id = tests.fx('norte')), 0, 'otro negocio no ve citas');
select tests.eq((select count(*)::int from public.sessions where business_id = tests.fx('norte')), 0, 'otro negocio no ve historiales');
select tests.eq((select count(*)::int from public.customers where id = tests.fx('nico')), 0, 'otro negocio no ve el perfil del cliente');
select tests.eq((select count(*)::int from public.audit_logs), 0, 'otro negocio no ve la auditoría');
select tests.logout();

-- Marta (propietaria): todo su negocio, y la auditoría.
select tests.login('00000000-0000-0000-0000-00000000a001');
select tests.eq((select count(*)::int from public.appointments where business_id = tests.fx('norte')) >= 2, true, 'la propietaria ve la agenda de su negocio');
select tests.eq((select count(*)::int from public.sessions where customer_id = tests.fx('nico')), 1, 'la propietaria ve el historial en su negocio');
select tests.logout();

-- Portfolio: solo fotos autorizadas, visibles sin sesión.
select tests.as_anon();
select tests.eq((select array_agg(photo_id) from public.portfolio(tests.fx('norte'))), array[tests.fx('foto_portfolio')], 'el portfolio solo muestra fotos autorizadas');
select tests.eq((select count(*)::int from public.photos), 0, 'anónimo no lee la tabla de fotos');
select tests.logout();

-- Retirar la autorización la quita del portfolio.
select tests.login('00000000-0000-0000-0000-00000000c001');
select public.set_photo_permission(tests.fx('foto_portfolio'), 'portfolio', false);
select tests.eq((select count(*)::int from public.portfolio(tests.fx('norte'))), 0, 'retirar el permiso la quita del portfolio');
select tests.logout();

-- Retirar a un miembro del equipo revoca su acceso.
select tests.login('00000000-0000-0000-0000-00000000a002');
select tests.fails(format('select public.deactivate_staff_member(%L)', tests.fx('sara')), 'sin_permiso', 'un barbero no da de baja a otros');
select tests.logout();
select tests.login('00000000-0000-0000-0000-00000000a001');
select public.deactivate_staff_member(tests.fx('david'));
select tests.logout();
select tests.login('00000000-0000-0000-0000-00000000a002');
select tests.eq((select count(*)::int from public.sessions), 0, 'un barbero dado de baja pierde el acceso al historial');
select tests.fails(format('select public.check_in(%L)', 'token-nico-hoy'), 'sin_permiso', 'y no puede registrar llegadas');
select tests.logout();

rollback;
