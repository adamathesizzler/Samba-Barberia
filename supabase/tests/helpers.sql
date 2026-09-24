-- Utilidades de prueba: iniciar sesión como un usuario, comprobar valores y errores.
create schema tests;
grant usage on schema tests to anon, authenticated;

-- Actúa como el usuario indicado, igual que haría PostgREST con su JWT.
create function tests.login(p_user uuid, p_anonymous boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anonymous)::text, true);
  execute 'set local role authenticated';
end $$;

create function tests.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

create function tests.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create function tests.eq(p_actual anyelement, p_expected anyelement, p_what text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALLO: % — esperado %, obtenido %', p_what, p_expected, p_actual;
  end if;
  raise notice 'ok: %', p_what;
end $$;

-- Ejecuta p_sql y exige que falle con el código de negocio (o SQLSTATE) indicado.
create function tests.fails(p_sql text, p_code text, p_what text) returns void language plpgsql as $$
declare v_msg text; v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
    if v_msg = p_code or v_state = p_code then
      raise notice 'ok: %', p_what;
      return;
    end if;
    raise exception 'FALLO: % — esperado error %, obtenido % (%)', p_what, p_code, v_msg, v_state;
  end;
  raise exception 'FALLO: % — esperado error %, pero no falló', p_what, p_code;
end $$;

grant execute on all functions in schema tests to anon, authenticated;
