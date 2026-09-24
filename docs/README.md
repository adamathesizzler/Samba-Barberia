# Documentación · Samba (nombre de trabajo)

Entregables pedidos en el §67 del *Documento maestro v2.0* (24/09/2026). El documento maestro sigue siendo la fuente principal: esto lo organiza, no lo sustituye.

| | Entregable | Archivo |
|---|---|---|
| A | Arquitectura funcional | [A-arquitectura-funcional.md](A-arquitectura-funcional.md) |
| B | Mapa completo de pantallas | [B-mapa-de-pantallas.md](B-mapa-de-pantallas.md) |
| C | Design System | [C-design-system.md](C-design-system.md) |
| D | Modelo de datos | [D-modelo-de-datos.md](D-modelo-de-datos.md) |
| E | Matriz de roles y permisos | [E-roles-y-permisos.md](E-roles-y-permisos.md) |
| F | Arquitectura técnica propuesta | [F-arquitectura-tecnica.md](F-arquitectura-tecnica.md) |
| G | Estructura del proyecto | [G-estructura-de-proyecto.md](G-estructura-de-proyecto.md) |
| H | Plan del MVP en tareas | [H-plan-mvp.md](H-plan-mvp.md) |
| I | Riesgos y decisiones pendientes | [I-riesgos-y-decisiones.md](I-riesgos-y-decisiones.md) |
| J | Prototipo navegable del recorrido principal | [`../app`](../app) |
| — | Requisitos con estado y fase (67 apartados + CORE) | [requisitos.md](requisitos.md) |
| — | Pruebas de aceptación | [pruebas-de-aceptacion.md](pruebas-de-aceptacion.md) |
| — | Backend Supabase: qué hay, cómo probarlo y cómo ponerlo en marcha | [supabase.md](supabase.md) |

## Estado a 24/09/2026

- **Hecho:** definición A–I, y un prototipo navegable con datos ficticios que recorre Reserva → Preparación → Check-in → Servicio → Resultado → Historial → Fidelización → Nueva reserva, con reglas de negocio cubiertas por tests.
- **Simulado y etiquetado:** cámara, Wallet, compartir imágenes, Style AI y música. No existen pagos online ni notificaciones.
- **Backend (Hito 0):** migraciones de Supabase, permisos (RLS) y funciones escritas y probadas sobre Postgres 16. Todavía **no hay un proyecto de Supabase creado**, la app no está conectada a él y no hay despliegue. No se han usado datos personales reales.
- **Decidido:** PWA, Supabase, color terracota y fidelización 10 → 1 corte. **Pendiente:** nombre, logo, cancelaciones, lista de espera y exclusiones del premio (ver I).
