#!/usr/bin/env bash
# Aplica las migraciones sobre un Postgres limpio y ejecuta las pruebas SQL.
# Uso: supabase/tests/run.sh             (crea un Postgres temporal; necesita binarios de PostgreSQL 15+)
#      DATABASE_URL=postgres://... supabase/tests/run.sh   (usa una base vacía existente, p. ej. en CI)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"

cleanup() { :; }
if [[ -z "${DATABASE_URL:-}" ]]; then
  bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  [[ -n "$bin" ]] || bin="$(dirname "$(command -v pg_ctl)")"
  dir="$(mktemp -d /tmp/samba-pg.XXXXXX)"
  port="${PGPORT_TEST:-54329}"
  run_pg() { if [[ "$(id -u)" == 0 ]]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
  [[ "$(id -u)" == 0 ]] && chown postgres "$dir"
  run_pg "'$bin/initdb' -D '$dir/data' -U postgres --auth=trust -E UTF8 >/dev/null"
  run_pg "'$bin/pg_ctl' -D '$dir/data' -o '-p $port -k $dir -c listen_addresses=127.0.0.1' -l '$dir/log' -w start >/dev/null"
  cleanup() { run_pg "'$bin/pg_ctl' -D '$dir/data' -m immediate stop >/dev/null" || true; rm -rf "$dir"; }
  export DATABASE_URL="postgres://postgres@127.0.0.1:$port/postgres"
fi
trap cleanup EXIT

psql_run() { PGOPTIONS='--client-min-messages=warning' psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

echo "→ stub de Supabase y utilidades de prueba"
psql_run -f "$here/supabase_stub.sql"
psql_run -f "$here/helpers.sql"
for m in "$root"/migrations/*.sql; do
  echo "→ migración $(basename "$m")"
  psql_run -f "$m"
done
echo "→ seed.sql (datos de demostración)"
psql_run -f "$root/seed.sql"
psql_run -f "$here/00_fixtures.sql"

shopt -s nullglob
fail=0
for t in "$here"/[1-9]*.sql; do
  echo "→ $(basename "$t")"
  if ! out="$(PGOPTIONS='--client-min-messages=notice' psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -f "$t" 2>&1)"; then
    echo "$out" | grep -E "FALLO|ERROR|error" | head -5
    fail=1
  else
    echo "$out" | grep -c "ok:" | xargs -I{} echo "  {} comprobaciones"
  fi
done

for t in "$here"/[1-9]*.sh; do
  [[ -e "$t" ]] || continue
  echo "→ $(basename "$t")"
  if ! DATABASE_URL="$DATABASE_URL" bash "$t"; then fail=1; fi
done

if [[ $fail -ne 0 ]]; then echo "✗ Hay pruebas fallidas"; exit 1; fi
echo "✓ Todas las pruebas de base de datos pasan"
