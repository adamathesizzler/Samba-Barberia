# D · Modelo de datos

Propuesta para el MVP sobre PostgreSQL (ver F). Los nombres siguen el §54. En el prototipo estas entidades viven en memoria (`app/src/domain/types.ts`) con las mismas relaciones y reglas.

## Diagrama de relaciones

```
users ─1:1─ customer_profiles ─┬─< appointments >── staff >── businesses ──< locations
                                │        │  └─< appointment_services >── services ──< staff_services >── staff
                                │        ├── visit_preparations
                                │        ├── check_ins (≤1)
                                │        └── sessions (≤1) ──< session_services
                                │                 ├─< session_products
                                │                 ├─< photos ──< photo_permissions
                                │                 ├── style_entries
                                │                 └── loyalty_movements (≤1)
                                ├─< preferences
                                ├─< feedback
                                ├─< rewards ──< reward_redemptions
                                └─< waitlist_requests ──< waitlist_offers
staff ──< availability_rules / availability_exceptions
audit_logs (todas)
```

## Entidades

Todas las tablas de negocio llevan `business_id` para aislamiento por RLS y `created_at`/`updated_at`.

| Tabla | Campos clave | Restricciones |
|---|---|---|
| `users` | id, email/phone verificado | proveedor de auth |
| `customer_profiles` | user_id (nullable para invitado), display_name, guest, session_style jsonb | un perfil por usuario |
| `customer_business_links` | customer_id, business_id, preferred_staff_id | la relación con cada negocio es explícita |
| `businesses` | id, name, accent_color, status | |
| `locations` | id, business_id, name, address, timezone | |
| `staff` | id, business_id, user_id, display_name, bio, specialties[], buffer_min, active | |
| `staff_roles` | staff_id, role (`barbero`/`encargado`/`propietario`), location_id nullable | rol por contexto |
| `services` | id, business_id, name, category, duration_min, price_cents, price_kind (`fijo`/`desde`), active | |
| `staff_services` | staff_id, service_id, duration_min?, price_cents? | PK compuesta |
| `availability_rules` | staff_id, location_id, weekday, start, end | jornada semanal |
| `availability_exceptions` | staff_id, start_at, end_at, kind (`descanso`/`bloqueo`/`vacaciones`/`ausencia`) | |
| `appointments` | id, code, business_id, location_id, customer_id, staff_id, start_at, end_at, status, source, qr_token_hash, finish_by, created_by | **exclusión**: `EXCLUDE USING gist (staff_id WITH =, tstzrange(start_at, end_at + buffer) WITH &&) WHERE status IN (activos)` |
| `appointment_status_history` | appointment_id, status, at, actor, note | |
| `appointment_services` | appointment_id, service_id, name, duration_min, price_cents, price_kind | **copia**; no depende del catálogo vigente |
| `visit_preparations` | appointment_id (PK), mode, style_entry_id, reference_photo_id, keep, change, note, seen_by_staff_at, changed_after_seen | una por cita |
| `check_ins` | appointment_id **UNIQUE**, staff_id, at, method (`qr`/`manual`) | llegada única |
| `sessions` | id, appointment_id **UNIQUE**, estimated_cents, final_cents, duration_min, technical_note, maintenance, payment_status, closed_by | cierre único |
| `session_services` | session_id, service_id, name, price_cents | |
| `session_corrections` | session_id, field, from, to, by, at | correcciones con autor |
| `products`, `session_products` | kind (`usado`/`vendido`), qty, price_cents | recomendado ≠ vendido |
| `photos` | id, business_id, customer_id, session_id?, appointment_id?, view, source (`profesional`/`cliente`/`referencia_externa`/`simulacion_ia`), storage_path, status (`pendiente`/`subida`/`fallida`), variants jsonb | almacenamiento privado; URLs firmadas |
| `photo_permissions` | photo_id, purpose (`historial_privado`/`compartir_cliente`/`portfolio`/`promocion`), granted, at, by | **append-only**; vale el último |
| `shared_references` | photo_id, from_business_id, to_appointment_id, granted_by, revoked_at | compartir entre negocios sin copiar historial (§42) |
| `style_entries` | id, customer_id, session_id, title, category, cover_photo_id, favorite, want_again | favorito **enlaza** la sesión |
| `preferences` | customer_id, label, value, origin (`cliente`/`profesional`/`sugerida`), confirmed | |
| `feedback` | customer_id, session_id?, photo_id?, kind, liked, change, author, author_id | no es reseña pública |
| `achievements`, `customer_achievements` | business_id, name, threshold, rule | fecha y regla de consecución |
| `loyalty_programs` | business_id, unit, goal, reward_template | |
| `loyalty_movements` | customer_id, business_id, session_id **UNIQUE**, delta, reason | historial de movimientos (§54 ext.) |
| `rewards` | id, business_id, customer_id, name, benefit, conditions, origin, status, expires_at, redeem_code | |
| `reward_redemptions` | reward_id **UNIQUE**, staff_id, session_id?, at | canje único |
| `waitlist_requests` | customer_id, business_id, service_ids, staff_ids, date, time_from, time_to, original_appointment_id, status | |
| `waitlist_offers` | request_id, staff_id, start_at, end_at, expires_at, status | la oferta **retiene** el hueco (entra en la restricción de exclusión) |
| `consents` | customer_id, purpose (`avisos`/`seguimiento`/`promociones`/`ia`), granted, at | por finalidad |
| `notifications` | customer_id, channel, kind, status (`preparada`/`enviada`/`fallida`), error | no se da por enviada sin confirmación |
| `wallet_passes` | appointment_id, provider, serial, status | F2 |
| `ai_analyses`, `ai_previews` | input_photo_id, provider, status, result | F3; siempre `source = simulacion_ia` |
| `music_connections`, `session_playlists` | | Experimental |
| `audit_logs` | at, actor, action, target, detail mínimo | acceso restringido |

## Estados

**Cita:** `confirmada → (modificada) → llegada → en_atencion → completada`; desde confirmada/modificada: `cancelada` o `ausencia`. Completada ≠ pagada.

**Oferta de espera:** `activa → oferta_enviada → aceptada | caducada | cancelada`.

**Recompensa:** `disponible → utilizada | caducada`.

**Foto:** `pendiente → subida | fallida → (reintento) subida`.

## Reglas en base de datos (no solo en la interfaz)

- Doble reserva: restricción de exclusión + transacción `SERIALIZABLE` al confirmar.
- Idempotencia: `UNIQUE` en `check_ins.appointment_id`, `sessions.appointment_id`, `loyalty_movements.session_id`, `reward_redemptions.reward_id`; además cabecera `Idempotency-Key` en las funciones de servidor.
- Aislamiento: RLS por `business_id` + rol; el barbero solo filas de citas suyas.
- El QR guarda solo `sha256(token)`; el token viaja en el pase.
