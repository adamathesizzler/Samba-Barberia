# H · Plan del MVP en tareas

Se parte del prototipo: el dominio y las pantallas ya existen, y el MVP las conecta a datos reales. Cada tarea termina con una **verificación** comprobable. El orden sigue el §58: primero el recorrido completo con una barbería, un profesional y pocos servicios, y después el resto del CORE.

**Prerrequisito:** plataforma ya decidida (PWA, I-D1); falta aprobar el proveedor de backend (I-D2). Sin esa aprobación no se crea infraestructura.

## Estado (24/09/2026)

| Tarea | Estado |
|---|---|
| 0.1 Migraciones | ✅ `supabase/migrations/` (esquema completo del modelo D) |
| 0.2 RLS + pruebas por rol | ✅ probado en Postgres 16; pendiente de verificar en el proyecto real (docs/supabase.md, paso 4) |
| 0.3 Autenticación | 🟡 lado servidor hecho (`ensure_customer_profile`, invitado anónimo que conserva su id al verificarse); faltan las pantallas de acceso |
| 0.4 App contra la API | ⏳ bloqueada hasta tener el proyecto creado (URL y clave pública) |
| 0.5 CI | ✅ `.github/workflows/ci.yml`: tipos, pruebas y build de la app + migraciones y pruebas SQL |

Además, la lógica de servidor de casi todo el Hito 1 y parte del 2 ya está implementada y probada: 1.1, 1.2, 1.4, 1.7, 1.9, 1.10 y 2.8/2.9 completas; 1.3, 1.5 y 1.6 en su lado de servidor. Falta conectarlas a las pantallas (0.4).

## Hito 0 · Cimientos

| # | Tarea | CORE | Verificación |
|---|---|---|---|
| 0.1 | Proyecto backend: migraciones de D (organización, catálogo, agenda, citas) | 2-7 | Migraciones aplican en limpio; esquema revisado |
| 0.2 | RLS por negocio y rol + usuarios de prueba por rol | 1, 4 | Tests de RLS: cada rol ve solo lo de la matriz E |
| 0.3 | Autenticación (enlace mágico o SMS) y perfil de cliente; reserva como invitado con vinculación posterior | 1, 9 | Invitado no ve historial; al verificar, se vincula sin duplicar |
| 0.4 | Sustituir `DemoBackend` por cliente de API con la misma interfaz | — | Las pantallas funcionan sin cambios de UI |
| 0.5 | CI: typecheck, Vitest, Playwright | — | Pipeline en verde |

## Hito 1 · Recorrido completo mínimo (1 barbería, 1 profesional, 3 servicios)

| # | Tarea | CORE | Verificación |
|---|---|---|---|
| 1.1 | Función `book_appointment` transaccional + restricción de exclusión | 7, 8 | Test de concurrencia: 2 reservas simultáneas → 1 cita |
| 1.2 | Cambiar / cancelar con historial de estados | 8 | Estados visibles en ticket y agenda |
| 1.3 | Preparación por cita (modos, referencia, esto sí / esto no) | 16, 17 | Solo aparece en su cita; aviso si cambia tras verla |
| 1.4 | QR con token (hash en BD) + `check_in` idempotente + manual | 20 | QR repetido → «ya registrado»; cancelado / ajeno → rechazo |
| 1.5 | Ficha de sesión con historial del negocio | 18 | Barbero no asignado → 403 por id directo |
| 1.6 | Subida de fotos a almacenamiento privado, variantes, estados, reintento | 12 | Fallo → no guardada; URLs firmadas y caducas |
| 1.7 | `close_session` idempotente + borrador | 11, 19 | Doble envío → una sesión; sin fotos OK |
| 1.8 | Historial y detalle de visita con importes históricos | 11 | Cambiar precio no altera el pasado |
| 1.9 | Fidelización básica: movimiento por sesión, recompensa al alcanzar meta | 23, 24 | Cancelada no suma; recompensa única |
| 1.10 | Repetir estilo con precio y disponibilidad actuales | 21, 22 | Test con precio cambiado |
| 1.11 | Playwright del recorrido del §66 de punta a punta | — | Verde en CI |

## Hito 2 · Resto del CORE

| # | Tarea | CORE | Verificación |
|---|---|---|---|
| 2.1 | Varios profesionales, duración/precio por profesional, estructura de sucursales | 3, 4, 5 | Catálogo filtra quién hace qué |
| 2.2 | Jornadas, descansos, vacaciones, bloqueos (gestión) | 6 | Bloqueo no borra citas; avisa de conflictos |
| 2.3 | Citas por teléfono y sin reserva en la misma agenda | 7 | Origen registrado; sin historiales duplicados |
| 2.4 | Permisos de foto por finalidad + portfolio + Explorar básico | 13 | Retirar permiso lo quita del portfolio |
| 2.5 | Preferencias con origen y confirmación | 15 | Propuesta no se muestra como confirmada |
| 2.6 | Favoritos / Mi estilo enlazados | 14, 21 | Favorito abre la visita original |
| 2.7 | Logros básicos configurables | 23 | Fecha y regla de consecución visibles |
| 2.8 | Canje verificable por el profesional | 24 | Doble canje → rechazo |
| 2.9 | Lista de espera con oferta que caduca y retiene el hueco | 25 | Tests: no vende dos veces; original intacta hasta aceptar |
| 2.10 | Perfil básico del profesional | 10 | Disponibilidad de la misma agenda |
| 2.11 | Gestión del propietario: equipo, catálogo, horarios, reglas de fidelización | 2, 5 | Solo propietario/encargado |
| 2.12 | Auditoría de acciones sensibles | — | Registro consultable por el propietario |

## Hito 3 · Piloto

| # | Tarea | Verificación |
|---|---|---|
| 3.1 | Revisión de accesibilidad (texto ampliado, lector de pantalla, contraste) | Informe con incidencias cerradas |
| 3.2 | Rendimiento de galería y reserva en móvil de gama media | Medición registrada |
| 3.3 | Textos legales y de privacidad **redactados y validados por quien corresponda** | No se inventan plazos (§55) |
| 3.4 | Copias de seguridad y separación demo / real | Restauración probada |
| 3.5 | Piloto con una barbería real (requiere autorización y datos reales) | Métricas del §57 definidas antes |

## Fuera del MVP (siguen en el documento maestro)

Fase 2: Wallet real, Antes/Después ampliado, portfolio completo, Explorar multi-negocio, seguimiento y mantenimiento inteligente, notificaciones, estadísticas, recap anual, «cómo quiero mi sesión» ampliado. Fase 3: Style AI y simulaciones. Experimental: My Session.

> Nota: el prototipo ya incluye versiones básicas de Antes/Después, Explorar, «Cómo quiero mi sesión» y Mi actividad porque eran baratas de validar visualmente. Eso no las adelanta al MVP.
