# B · Mapa de pantallas

Las 22 pantallas principales del §64, con su ruta en el prototipo y su estado.

Leyenda: ✅ en el prototipo · 🟡 parcial o simulada · ⏳ vista futura etiquetada · — no incluida todavía

| # | Pantalla | Rol | Ruta del prototipo | Estado | Notas |
|---|---|---|---|---|---|
| 01 | Onboarding y acceso | Cliente | — | — | El prototipo entra con un cliente ficticio. Autenticación real en MVP (H-1). |
| 02 | Home | Cliente | `#/cliente/inicio` | ✅ | Próxima cita contextual, premio, último estilo, ritmo (solo con ≥3 visitas). |
| 03 | Explorar | Cliente | `#/cliente/explorar` | ✅ | Solo fotos con permiso de portfolio. «Tendencias» deshabilitada hasta tener criterio. |
| 04 | Detalle de estilo | Cliente | `#/cliente/explorar/:foto` | ✅ | Precio actual, reservar con ese profesional, usar como referencia. |
| 05 | Reserva | Cliente | `#/cliente/reservar` | ✅ | 5 pasos; lista de espera si no hay hueco. |
| 06 | Confirmación | Cliente | `#/cliente/cita/:id` | ✅ | Ticket R01 que cambia con el estado; cambiar hora, cancelar, calendario (.ics real). |
| 07 | Pase / QR | Cliente | `#/cliente/pase/:id` | ✅ | QR con token opaco + código alternativo. Wallet: ⏳ Fase 2. |
| 08 | Preparar visita | Cliente | `#/cliente/preparar/:id` | ✅ | Modos, referencia, esto sí / esto no. |
| 09 | Perfil | Cliente | `#/cliente/perfil` | ✅ | Hero R02, visitas · estilos · recompensas. |
| 10 | Mi colección | Cliente | `#/cliente/historial?tab=estilo` | ✅ | Favoritos, Mis cortes, Barba, Color, Trenzas, Quiero probar; cuadrícula/lista (R06). |
| 11 | Historial | Cliente | `#/cliente/historial` | ✅ | Filtros por servicio; incluye otro negocio. |
| 12 | Detalle de visita | Cliente | `#/cliente/visita/:id` | ✅ | Fotos por vista, importes, mantenimiento, comentarios, repetir. |
| 13 | Antes/Después | Cliente | hoja en detalle de visita | ✅ | Compara dos visitas reales con fechas. |
| 14 | Logros | Cliente | `#/cliente/recompensas` | ✅ | Medallas R03: bloqueado / en progreso / conseguido. |
| 15 | Recompensas | Cliente | `#/cliente/recompensas` | ✅ | Monedero: disponibles, utilizadas, caducadas. |
| 16 | Mi actividad | Cliente | `#/cliente/actividad` | 🟡 | Resumen anual básico; gráficos ampliados en F2. |
| 17 | Style AI | Cliente | `#/cliente/style-ai` | ⏳ | Vista futura, sin proveedor conectado. |
| 18 | Resultado IA | Cliente | — | ⏳ | Fase 3. |
| 19 | Perfil profesional | Cliente | — | — | Datos del profesional visibles en reserva y ticket; perfil completo en F2. |
| 20 | Agenda del barbero | Profesional | `#/pro/hoy` | ✅ | Estados, pausas visibles, preparación modificada; vista de equipo para propietario. |
| 21 | Ficha de cliente para la sesión | Profesional | `#/pro/ficha/:id` | ✅ | «Quiere hoy» primero; solo historial del propio negocio. |
| 22 | Finalizar sesión | Profesional | `#/pro/finalizar/:id` | ✅ | 5 pasos, borrador local, fotos con fallo/reintento. |

## Vistas de apoyo (§64)

| Vista | Ruta | Estado |
|---|---|---|
| Gestión de cita (cambiar / cancelar) | hojas en `#/cliente/cita/:id` | ✅ |
| Lista de espera | `#/cliente/espera` | ✅ |
| Privacidad y fotos | `#/cliente/privacidad` | ✅ |
| Preferencias y «Cómo quiero mi sesión» | `#/cliente/preferencias` | ✅ |
| Ajustes (tema) | `#/cliente/ajustes` | ✅ |
| Escáner + check-in manual | `#/pro/escanear` | 🟡 cámara simulada |
| Canje de recompensa | `#/pro/canjear` | ✅ |
| Cliente sin reserva | `#/pro/sin-reserva` | ✅ |
| Gestión del propietario | `#/gestion` | 🟡 catálogo, bloqueos y auditoría |
| Notificaciones | — | — (no se envía nada; F2) |

## Navegación

- **Cliente:** Inicio · Explorar · Historial · Perfil + botón circular **Reservar** separado (R07). Encima, banda contextual «Próxima cita · 11:15 · Ver QR» solo el día de la cita (R08).
- **Profesional:** Hoy · Escanear · Canjear.
- **Propietario:** Agenda (todo el equipo) · Escanear · Canjear · Gestión.
- Cada rol solo navega su área; cambiar la URL no concede acceso (la comprobación está en la capa de datos).

## Variantes validadas en el prototipo (§64)

sin cita · sin fotos · subida fallida · cita cancelada · QR inválido / de otro negocio / repetido · recompensa utilizada o caducada · permiso denegado (ficha ajena) · sin hueco → lista de espera · hueco ocupado mientras se elegía.
