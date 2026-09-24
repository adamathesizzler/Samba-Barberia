# Requisitos con estado y fase

Los 67 apartados del documento maestro v2.0. **Ninguno se elimina**: aplazar no es descartar (§58, Anexo B).

- **Tipo**: B = base, A = ampliación, M = mejora propuesta, D = dirección/definición.
- **Fase**: MVP (CORE §58), F2, F3, Exp (experimental), Transversal.
- **Prototipo**: ✅ funciona con datos ficticios · 🟡 parcial o simulado (etiquetado) · ⏳ vista futura etiquetada · — no incluido · 📄 cubierto en documentación.

| § | Requisito | Tipo | Fase | Prototipo | Dónde |
|---|---|---|---|---|---|
| 1 | Idea y valor del producto | D | Transversal | 📄 | A |
| 2 | Ocho pilares | D | Transversal | 📄 | A |
| 3 | Perfil visual del cliente | B | MVP | ✅ | Perfil |
| 4 | Historial visual de cada visita | B | MVP | ✅ | Historial, detalle de visita |
| 5 | Todos los servicios, no solo cortes | B | MVP | ✅ | Catálogo con 7 categorías; varias líneas por sesión |
| 6 | Mi estilo: banco personal | B/A | MVP | ✅ | Historial › Mi estilo; favoritos enlazados |
| 7 | Esto me gusta / esto no quiero repetir | M | MVP (CORE 17) | ✅ | Detalle de visita, Preparar, Ficha |
| 8 | Preferencias y memoria de estilo | A | MVP (CORE 15) | ✅ | Preferencias; propuesta ≠ confirmada |
| 9 | Reservas y agenda fiable | B | MVP | ✅ | Reserva; validación al confirmar; tests |
| 10 | Precio transparente, extras, condiciones | M | MVP | ✅ | Revisión de reserva; «desde»; ajuste confirmado al cerrar |
| 11 | Ticket digital | B | MVP | ✅ | Confirmación (R01) |
| 12 | Apple Wallet / Android / Samsung | B | F2 | ⏳ | Hoja «Wallet» explica el estado real |
| 13 | QR seguro y check-in | B | MVP (CORE 20) | ✅ | Pase + Escanear; tests |
| 14 | Reserva que cambia según el momento | M | MVP | ✅ | Tarjeta de Home, banda contextual, ticket |
| 15 | Preparar mi visita | A | MVP (CORE 16) | ✅ | Preparar |
| 16 | Ficha instantánea del barbero | B | MVP (CORE 18) | ✅ | Ficha de sesión |
| 17 | Experiencia diaria del profesional | A | MVP | ✅ | Hoy |
| 18 | Finalizar sesión en pocos pasos | M | MVP (CORE 19) | ✅ | Finalizar; idempotente; borrador |
| 19 | Captura y carga de fotos | B/M | MVP (CORE 12) | 🟡 | Cámara simulada; estados, fallo y reintento reales |
| 20 | Permisos de fotos y publicación | B/A | MVP (CORE 13) | ✅ | Privacidad; portfolio por foto |
| 21 | Comparador Antes/Después | A | F2 | ✅ | Detalle de visita (básico) |
| 22 | Style AI | B | F3 | ⏳ | Vista futura |
| 23 | IA vinculada a catálogo y trabajos reales | A | F3 | — | Explorar ya enlaza trabajo → reserva |
| 24 | Simulación con IA | B/A | F3 | — | Etiqueta «Simulación IA» preparada en `PhotoArt` |
| 25 | Seguimiento después del corte | M | F2 | — | Comentarios de visita ya existen |
| 26 | Ficha de mantenimiento y productos | A/M | MVP (básico) | ✅ | Cierre › Más; detalle de visita |
| 27 | Mantenimiento inteligente | A | F2 | 🟡 | Ritmo de visitas en Home (solo con ≥ 3 visitas) |
| 28 | Lista de espera inteligente | M | MVP (CORE 25) | ✅ | Reserva sin hueco, detalle de cita, Lista de espera; tests |
| 29 | Barra de progreso de fidelización | B | MVP | ✅ | Home, Recompensas |
| 30 | Logros y niveles | B/A | MVP (CORE 23) | ✅ | Recompensas (R03) |
| 31 | Recompensas reales y reglas | B | MVP (CORE 24) | 🟡 | Reglas de demostración (I-D6) |
| 32 | Monedero de recompensas | A | MVP (básico) | ✅ | Recompensas; Canjear |
| 33 | Historial económico | B | F2 (registro básico MVP) | 🟡 | Mi actividad |
| 34 | Tu año en la barbería | A | F2 | — | |
| 35 | Explorar estilos | A | F2 | ✅ | Explorar (un negocio) |
| 36 | Perfil de cada profesional | A | MVP básico / F2 portfolio | 🟡 | Datos en reserva y ticket |
| 37 | Cómo quiero mi sesión | M | F2 | ✅ | Preferencias; visible en ficha |
| 38 | My Session: música | B opc. | Exp | ⏳ | Ajustes indica que no está conectado |
| 39 | Reservar sin instalar | M | MVP | 📄 | Propuesta PWA (F); invitado en D |
| 40 | Citas por teléfono, presenciales, sin reserva | M | MVP | ✅ | Sin reserva; origen «teléfono» en agenda |
| 41 | Alternativa al QR | M | MVP | ✅ | Búsqueda manual en Escanear; código en el pase |
| 42 | Qué se comparte entre barberías | B/M | MVP (aislamiento) | ✅ | Ficha solo del negocio; test |
| 43 | Home de contexto | A | MVP | ✅ | Home |
| 44 | Navegación | D | MVP | ✅ | Barra R07 + banda R08 |
| 45 | Dirección artística y referencias | D | Transversal | 📄 | C |
| 46 | Modo claro y color de marca | A | MVP | ✅ | Tokens; acento provisional |
| 47 | Modo oscuro con profundidad | A | MVP | ✅ | Tokens oscuros + selector en Ajustes |
| 48 | Cristal y transparencias | D | MVP | ✅ | Solo navegación, banda y paneles; reducción de transparencia |
| 49 | Microinteracciones y rendimiento | A | MVP | 🟡 | Animaciones breves; 60 fps sin medir |
| 50 | Accesibilidad | A | MVP | 🟡 | ARIA, foco, estado con texto; falta auditoría |
| 51 | Panel del propietario | A | MVP mínimo / F2 | 🟡 | Gestión: catálogo, bloqueos, auditoría |
| 52 | Roles y matriz de acceso | D | MVP | ✅ | E; `permissions.ts`; tests |
| 53 | Arquitectura multi-barbería | A | MVP (estructura) | ✅ | Dos negocios de demo aislados |
| 54 | Modelo de datos | D | MVP | 📄 | D; `types.ts` |
| 55 | Seguridad, privacidad y operación | D | MVP | 📄 | D, E, F, I |
| 56 | Lo que no queremos | D | Transversal | ✅ | Revisado en cada pantalla |
| 57 | Posicionamiento y éxito | D | Transversal | 📄 | A, H-3.5 |
| 58 | MVP y CORE | D | — | 📄 | H |
| 59 | Fase 2 | D | F2 | 📄 | H |
| 60 | Fase 3 IA | D | F3 | 📄 | H, I-D12 |
| 61 | Experimental y cuestiones abiertas | D | Exp | 📄 | I |
| 62 | Design System | D | MVP | ✅ | C |
| 63 | Componentes propios | D | MVP | ✅ | C, `ui/product.tsx` |
| 64 | Mapa de pantallas | D | MVP | 📄 | B |
| 65 | Prioridades y criterios | D | Transversal | 📄 | I |
| 66 | Primera prueba y criterios de aceptación | D | MVP | ✅ | pruebas-de-aceptacion.md; `backend.test.ts` |
| 67 | Prompt de ejecución | D | — | 📄 | Este conjunto de entregables A–J |

## Los 25 puntos del CORE en el prototipo

1 Auth 🟡 (selector de rol, sin login real) · 2 Barberías ✅ · 3 Sucursales ✅ estructura · 4 Profesionales ✅ · 5 Servicios y precios ✅ · 6 Disponibilidad y bloqueos ✅ · 7 Agenda unificada ✅ · 8 Reservas, cambios, cancelaciones ✅ · 9 Perfil del cliente ✅ · 10 Perfil básico del profesional 🟡 · 11 Historial ✅ · 12 Fotos por visita 🟡 (cámara simulada) · 13 Permisos fotográficos ✅ · 14 Referencias ✅ · 15 Preferencias ✅ · 16 Preparar visita ✅ · 17 Esto sí / esto no ✅ · 18 Ficha del barbero ✅ · 19 Finalizar sesión ✅ · 20 QR y check-in ✅ · 21 Favoritos ✅ · 22 Repetir con condiciones actuales ✅ · 23 Logros ✅ · 24 Recompensas y canje ✅ · 25 Lista de espera ✅
