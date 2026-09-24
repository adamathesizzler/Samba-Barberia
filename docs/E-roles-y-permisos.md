# E · Roles y matriz de acceso

Basado en §52. Los permisos se aplican **por acción y contexto en la capa de datos**; ocultar un botón no es una comprobación. En el prototipo: `app/src/domain/permissions.ts` y cada método de `backend.ts`; en el MVP: políticas RLS + funciones de servidor.

## Roles

| Rol | Ámbito |
|---|---|
| **Cliente** | Su cuenta, sus reservas, preparaciones, fotos, permisos, preferencias, recompensas. |
| **Invitado** | Una reserva concreta por enlace/código; sin acceso a historial hasta verificar identidad (§39). |
| **Barbero** | Su agenda y las fichas de sus citas en su negocio. |
| **Encargado** | Agendas y operación de su establecimiento/sucursal según permisos concedidos. |
| **Propietario** | Su negocio completo: catálogo, equipo, horarios, reglas, actividad. |
| **Super Admin** | Organizaciones y soporte. Sin acceso privado por defecto; accesos excepcionales limitados y registrados. |

## Matriz

✅ permitido · 🔹 solo lo propio / lo asignado · ❌ no

| Acción | Cliente | Barbero | Encargado | Propietario | Super Admin |
|---|---|---|---|---|---|
| Crear reserva | 🔹 para sí | ✅ en su negocio (teléfono, sin reserva) | ✅ | ✅ | ❌ |
| Cambiar / cancelar cita | 🔹 | 🔹 las suyas | ✅ negocio | ✅ negocio | ❌ |
| Preparar visita | 🔹 | ❌ (lee) | ❌ (lee) | ❌ (lee) | ❌ |
| Registrar llegada (QR / manual) | ❌ | ✅ negocio | ✅ negocio | ✅ negocio | ❌ |
| Abrir ficha de sesión | ❌ | 🔹 citas asignadas | ✅ negocio | ✅ negocio | ❌ |
| Ver historial del cliente | 🔹 todo el suyo | 🔹 solo en su negocio, clientes con cita suya | ✅ solo su negocio | ✅ solo su negocio | ❌ |
| Ver gasto total del cliente | 🔹 | ❌ | ❌ | ❌ (solo importes de su negocio) | ❌ |
| Subir fotos a una visita | 🔹 (referencias) | 🔹 citas asignadas | ✅ | ✅ | ❌ |
| Conceder / retirar permisos de foto | 🔹 | ❌ | ❌ | ❌ | ❌ |
| Publicar en portfolio | ❌ | 🔹 solo con permiso del cliente | idem | idem | ❌ |
| Cerrar sesión / corregir importe | ❌ | 🔹 | ✅ | ✅ | ❌ |
| Proponer preferencia | ❌ | ✅ | ✅ | ✅ | ❌ |
| Confirmar preferencia | 🔹 | ❌ | ❌ | ❌ | ❌ |
| Canjear recompensa | ❌ (la muestra) | ✅ negocio | ✅ | ✅ | ❌ |
| Catálogo, precios, horarios, bloqueos | ❌ | ❌ | 🔹 según permisos | ✅ | ❌ |
| Reglas de fidelización | ❌ | ❌ | ❌ | ✅ | ❌ |
| Ver auditoría | ❌ | ❌ | 🔹 | ✅ negocio | 🔹 registrado |
| Gestionar organizaciones | ❌ | ❌ | ❌ | ❌ | ✅ |

## Reglas transversales

- **Otro negocio = ninguna fila.** El rol de propietario no da acceso a otros negocios (§52).
- **Referencias compartidas (§42):** el negocio B ve solo la foto compartida para esa cita; no precios, gasto, otras fotos ni notas de A; no puede modificarla ni usarla en publicidad.
- **QR:** localiza una cita; la autorización del escáner se comprueba aparte. Cancelado, ausente u otro negocio → rechazo.
- **Retirar a un miembro del equipo** revoca sus accesos; sus fotos de portfolio siguen las reglas explícitas del negocio; nunca se transfieren datos privados de clientes al cambiar de empleo (§36).
- **Todo acceso sensible queda en `audit_logs`** (check-in, cierre, corrección, canje, cambios de permisos, accesos de soporte).

## Verificado en el prototipo

`app/src/domain/backend.test.ts` comprueba: cliente no reserva por otro; cliente no registra llegadas; barbero no cambia precios; barbero no asignado y barbero de otro negocio no abren la ficha por identificador directo; la ficha solo trae historial del propio negocio; fotos sin permiso de portfolio no aparecen en Explorar.
