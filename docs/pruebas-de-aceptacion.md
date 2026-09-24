# Pruebas de aceptación (§66)

**Entorno:** prototipo `app/` (React + TS), backend en memoria, Node 22. Tests automáticos con Vitest (`npm test`) y un recorrido en Chromium con Playwright (script de sesión, no incluido todavía en el repositorio; ver H-0.5).

**Resultado del 24/09/2026:** 30 tests de dominio en verde; recorrido completo cliente → barbero → cliente → propietario sin errores de consola, en tema claro y oscuro, a 390×844.

Esto valida **las reglas del prototipo**, no un sistema en producción: no hay servidor, concurrencia real ni almacenamiento real.

## Recorrido obligatorio

| Paso | Prototipo |
|---|---|
| Crear o identificar cliente | 🟡 cliente de demo o «sin reserva» (invitado) |
| Elegir barbería → servicios / profesional → reservar | ✅ |
| Preparar visita | ✅ |
| Confirmación y QR | ✅ |
| Registrar llegada | ✅ QR (simulado) o manual |
| Abrir ficha profesional | ✅ |
| Realizar y documentar servicio → finalizar | ✅ |
| Ver resultado en historial | ✅ |
| Avanzar según reglas de fidelización | ✅ la cita de hoy de Nico completa 10/10 y desbloquea un premio |
| Repetir ese estilo en una cita nueva | ✅ «Repetir» → reserva con precio actual |

## Casos mínimos

| Caso | Cómo se comprueba | Estado |
|---|---|---|
| Dos personas, mismo hueco → no hay dos citas | `backend.test.ts` «dos personas no obtienen el mismo hueco» | ✅ |
| Cambia horario, precio o servicio → las citas conservan su contexto | «cambiar el precio del catálogo no altera…» · Gestión › bloqueo avisa de conflictos | ✅ |
| Preparación en la cita y negocio correctos | «se guarda en la cita correcta…» · «marca el cambio si el profesional ya la había visto» | ✅ |
| QR válido identifica; cancelado o ajeno no; repetir no duplica | 4 tests en «QR y check-in» | ✅ |
| Profesional no autorizado no ve fotos ni gastos por id directo | «un profesional no asignado no abre la ficha…» | ✅ |
| Flujo manual sin QR respetando permisos | «check-in manual y QR actualizan el mismo estado»; búsqueda solo en la agenda de hoy del negocio | ✅ |
| Cerrar sin fotos; repetir el cierre no duplica | «se puede cerrar sin fotos y repetir…» | ✅ |
| Subida fallida no se anuncia; fotos privadas fuera del portfolio | «una subida fallida no se guarda…» · «las fotos privadas no aparecen en el portfolio» | ✅ |
| Repetir look usa precio y disponibilidad actuales | «repetir un estilo usa el precio actual» | ✅ |
| Cancelada no suma; premio no se canjea dos veces | «una cita cancelada no suma visita» · «un premio no se canjea dos veces ni por otro cliente» | ✅ |
| Gastos distinguen previsto, final, compras y ajustes | Detalle de visita y Mi actividad (revisión manual) | ✅ manual |
| Lista de espera no cancela la original sin confirmar ni vende dos veces | 3 tests en «lista de espera» | ✅ |
| Datos de una barbería separados; compartir foto no abre historial | «la ficha solo muestra historial del propio negocio» · «QR de otro negocio» | ✅ (compartir referencia entre negocios: pendiente, D) |
| Recap compartido oculta datos privados | — | ⏳ F2 |
| IA, Wallet y música muestran si son reales, simuladas o no disponibles | Revisión manual: etiquetas «Fase 2/3», «Simulado», «no conectado» | ✅ manual |
| Texto largo, claro/oscuro, teclado abierto, tamaños | Claro y oscuro a 390 px ✅; texto ampliado, tableta y teclado: **pendiente** | 🟡 |

## Otros casos añadidos

- Recompensas vencidas pasan a «caducada».
- Los logros se calculan con visitas reales.
- Sin historial suficiente no se inventa ritmo de visitas.
- Cliente sin reserva: se registra con llegada hecha; si el profesional está ocupado se rechaza.
- Una corrección de importe queda registrada con autor y no crea otra visita.
- No se puede cerrar sin llegada registrada.

## Pendiente

- Pruebas de RLS y de concurrencia reales (MVP, H-0.2 y H-1.1).
- Recorrido Playwright versionado en el repositorio y en CI (H-0.5).
- Auditoría de accesibilidad con lector de pantalla y texto al 200 % (H-3.1).
