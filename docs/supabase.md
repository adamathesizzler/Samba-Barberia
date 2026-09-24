# Supabase: backend del MVP

Decisión del promotor (24/09/2026): **PWA + Supabase**. Esta carpeta contiene todo lo que se aplica sobre el proyecto; el proyecto en sí se crea desde tu cuenta.

## Qué hay en `supabase/`

| Archivo | Contenido |
|---|---|
| `config.toml` | Configuración local de la CLI (inicio de sesión anónimo activado para reservar como invitado, §39) |
| `migrations/…01_esquema.sql` | Tablas, tipos, índices y restricciones (docs/D). Incluye la **restricción de exclusión** que impide dos citas solapadas y los `UNIQUE` que impiden duplicar llegada, cierre, movimiento de fidelización y canje |
| `migrations/…02_permisos.sql` | RLS en todas las tablas. La app **no puede escribir directamente** en ninguna tabla |
| `migrations/…03_funciones.sql` | Todas las operaciones como funciones RPC que comprueban quién llama: `book_appointment`, `reschedule_appointment`, `cancel_appointment`, `check_in`, `close_session`, `redeem_reward`, `join_waitlist`, `accept_offer`, `save_preparation`, `register_photo`/`confirm_photo`, `set_photo_permission`, `walk_in`, `update_service_price`, `add_exception`, `add_staff_member`… |
| `migrations/…04_almacenamiento.sql` | Bucket privado `fotos` (máx. 15 MB, jpeg/png/webp/heic) y sus políticas |
| `seed.sql` | Barbería de demostración para desarrollo local (`supabase db reset`) |
| `tests/` | Pruebas SQL de reglas y permisos por rol + prueba de concurrencia real |

## Pruebas

```bash
supabase/tests/run.sh                      # crea un Postgres temporal (necesita PostgreSQL 15+ instalado)
DATABASE_URL=postgres://… supabase/tests/run.sh   # sobre una base vacía (así corre en CI)
```

El script aplica las migraciones tal cual sobre Postgres 16, con un *stub* mínimo que imita lo que Supabase ya trae (roles `anon`/`authenticated`/`service_role`, `auth.uid()`, privilegios por defecto). Resultado actual: **101 comprobaciones + concurrencia, todas en verde**. También se comprobó que las pruebas detectan un fallo: al abrir a propósito la política de historiales, la prueba correspondiente falla.

**Límites de estas pruebas:** no ejecutan Supabase real (Auth, PostgREST y Storage). La migración de Storage se omite en ellas. Hay que verificarlas en un proyecto real con el paso 4 de abajo.

## Poner en marcha el proyecto (lo haces tú; unos 15 minutos)

1. **Crear el proyecto** en [supabase.com](https://supabase.com) → *New project*. Región recomendada: UE (p. ej. Frankfurt o París). Guarda la contraseña de la base de datos.
2. **Auth** → *Sign In / Providers*:
   - activar **Email** (enlace mágico o código);
   - activar **Anonymous sign-ins**, para reservar sin cuenta;
   - en *URL Configuration*, poner la URL donde se publique la web.
3. **Aplicar las migraciones** desde tu ordenador:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```
4. **Comprobar en el proyecto real** (SQL editor):
   - `select * from storage.buckets where id = 'fotos';` → debe existir y tener `public = false`.
   - Crear dos usuarios de prueba en *Authentication* y verificar que uno no ve las citas del otro.
5. **Dar de alta el negocio** (SQL editor, que usa la clave de servicio):
   ```sql
   select public.create_business('Nombre del local', '<id del usuario propietario>', 'Nombre', 'Sucursal', 'Dirección');
   ```
   Después, el propietario añade a su equipo con `add_staff_member(negocio, correo, nombre, rol)`. Cada persona debe haber creado antes su cuenta.
6. **Tareas periódicas:** activar la extensión `pg_cron` y programar
   `select cron.schedule('limpieza', '*/5 * * * *', 'select public.run_housekeeping()');`
   Caduca recompensas y ofertas de la lista de espera y vuelve a ofrecer huecos.
7. **Pasarme las claves públicas** para conectar la app: `Project URL` y `anon public key`. No me pases la `service_role key` ni la contraseña de la base de datos.

## Convenciones para futuras migraciones

- Toda escritura nueva va en una función `security definer set search_path = ''` que compruebe el rol. No se conceden `insert`/`update`/`delete` a `anon`/`authenticated`.
- Supabase concede `execute` a `anon` sobre funciones nuevas: cada migración que cree funciones debe repetir los `revoke`/`grant` del final de la migración 3.
- Errores de negocio: `private.fail('codigo', 'Texto para la persona')`. La app muestra `detail` y decide por `message`.
- Cada regla nueva lleva su prueba en `supabase/tests/`.
