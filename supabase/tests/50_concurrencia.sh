#!/usr/bin/env bash
# Dos conexiones reservan el mismo hueco a la vez: solo una cita debe quedar confirmada (§66).
set -uo pipefail
book() {
  psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL
begin;
select tests.login('$1');
select public.book_appointment(tests.fx('david'), array[tests.fx('corte')], tests.at_local(5, '10:00'));
select pg_sleep(1);
commit;
SQL
}
book 00000000-0000-0000-0000-00000000c002 & p1=$!
book 00000000-0000-0000-0000-00000000c003 & p2=$!
wait $p1; r1=$?; wait $p2; r2=$?
n=$(psql "$DATABASE_URL" -X -At -c "select count(*) from public.appointments where staff_id = tests.fx('david') and start_at = tests.at_local(5, '10:00') and status <> 'cancelada'")
psql "$DATABASE_URL" -X -q -c "delete from public.appointments where staff_id = tests.fx('david') and start_at = tests.at_local(5, '10:00')" >/dev/null
if [[ "$n" == 1 && $((r1 + r2)) -ne 0 && ( $r1 -eq 0 || $r2 -eq 0 ) ]]; then
  echo "  ok: dos reservas simultáneas del mismo hueco → una sola cita"
else
  echo "  FALLO: reservas simultáneas → citas=$n, resultados=$r1/$r2"; exit 1
fi
