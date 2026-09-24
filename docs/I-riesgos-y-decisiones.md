# I · Riesgos y decisiones pendientes

## Decisiones tomadas por el promotor (24/09/2026)

| # | Decisión | Elegido |
|---|---|---|
| D1 | Plataforma inicial | **Web instalable (PWA)** para cliente, barbero y propietario (opción 1 de F) |
| D4 | Color de acento | **Terracota** (`--accent` actual), sobre base blanco roto / grafito |
| D6 | Programa de fidelización inicial | **10 visitas atendidas → 1 corte incluido, válido 90 días** |
| D2 | Proveedor de backend | **Supabase** (región UE recomendada; la crea el promotor) |
| D3 | Nombre comercial | **Aún sin decidir**: se mantiene «Samba» como provisional |

## Decisiones pendientes del promotor

| # | Decisión | Por qué bloquea | Propuesta provisional |
|---|---|---|---|
| D1 | ~~Plataforma inicial~~ | — | **Decidido: PWA** |
| D2 | ~~Proveedor de backend~~ | — | **Decidido: Supabase**; falta elegir región al crear el proyecto |
| D3 | **Nombre comercial** | Dominio, pases Wallet, textos | Se usa «Samba» como **nombre de trabajo** porque es el nombre del repositorio. No está aprobado. |
| D4 | Logo (color **decidido: terracota**) | Identidad | Pendiente de nombre |
| D5 | Reglas de **cancelación, cambios, señales y ausencias** | Ticket, gestión de cita | Sin reglas; el prototipo lo indica |
| D6 | Fidelización: **decidido 10 visitas → 1 corte, 90 días**; faltan exclusiones y compatibilidad con otras ventajas | Recompensas reales | — |
| D7 | Regla de **lista de espera** (orden, caducidad de oferta) | Justicia entre clientes | Demo: orden de llegada, 30 min |
| D8 | ¿Cuándo se puede **editar la preparación**? (límite antes de la cita) | Operación del local | Demo: hasta la llegada |
| D9 | **Pertenencia del portfolio** cuando un profesional cambia de negocio | Derechos sobre fotos | Sin definir |
| D10 | **Conservación, exportación y borrado** de datos | Obligatorio antes de producción | Sin definir; requiere asesoramiento |
| D11 | Proveedor de **Wallet** (y si Samsung es viable) | Fase 2 | Apple + Google primero; Samsung por verificar |
| D12 | Proveedor de **IA** | Fase 3 | Sin elegir |
| D13 | Modelo de **suscripción de la plataforma** | Negocio | Sin definir |

## Decisiones reversibles tomadas en este trabajo

Se tomaron para poder avanzar (§65) y pueden cambiarse sin coste relevante:

| Decisión | Motivo |
|---|---|
| Prototipo web React + TS + Vite, sin backend | Navegable en cualquier dispositivo, sin coste ni infraestructura |
| «Reloj de demostración» empezando a las 10:00 del día actual (lunes si es domingo) | Que la agenda de hoy tenga sentido a cualquier hora que se abra |
| Persistencia en `localStorage` del navegador, con botón «Reiniciar demo» | Probar el recorrido sin servidor; nada sale del dispositivo |
| Selector de rol en la barra de demostración | Recorrer cliente → barbero → propietario en una sola sesión |
| Cámara del escáner simulada con controles de demo | No pedir permisos de cámara en un prototipo; el check-in manual es real |
| Fotos como siluetas SVG etiquetadas «Foto demo» | No usar imágenes de personas reales ni de las referencias |
| Barra inferior: 4 destinos + botón Reservar separado | §44 + R07; conserva los cinco destinos sin sexto botón |
| Sin fuentes externas (pila del sistema) | Rendimiento y privacidad; la tipografía de marca queda para D3/D4 |
| La cita que se reprograma pasa a «modificada» | Estado distinto del §14 |
| Un cliente sin reserva queda como «invitado» | §40: datos mínimos, vinculación posterior |

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Doble reserva por concurrencia | Alto | Restricción de exclusión en BD + transacción (no solo validación en la interfaz) |
| Fugas entre negocios o hacia barberos no asignados | Alto | RLS + tests por rol; ficha solo con historial del negocio |
| Fotos privadas expuestas por URL | Alto | Almacenamiento privado, URLs firmadas y caducas, permisos por finalidad |
| Duplicados por reintentos (check-in, cierre, canje) | Medio | `UNIQUE` + claves de idempotencia |
| Push poco fiable en iOS con PWA | Medio | Correo como canal principal; valorar envoltorio nativo si el piloto lo exige |
| Wallet: diferencias entre proveedores | Medio | El pase externo no promete el mismo diseño que el ticket; el QR en la app siempre funciona |
| Formularios largos para el barbero | Medio | Cierre en 5 pasos con todo opcional salvo servicios; borrador |
| Gamificación mal calibrada (premios que no se entienden) | Medio | Condiciones visibles en cada recompensa; reglas definidas por el negocio (D6) |
| Expectativas sobre la IA | Medio | Fase 3, etiquetado estricto, sin puntuar la apariencia ni inferir datos sensibles |
| Obligaciones legales de datos personales y fotografías | Alto | Asesoramiento antes de producción (D10); no se inventan plazos ni garantías |
| Alcance del CORE (25 puntos) para un primer lanzamiento | Medio | Hitos 1 → 2 en H; recortes documentados sin borrar requisitos |

## Contradicciones o ambigüedades encontradas en el documento maestro

| Tema | Observación | Cómo se ha resuelto |
|---|---|---|
| Navegación (§44) | Enumera 5 destinos, incluido «Reservar», y R07 pide 4 + un botón separado | Son compatibles: Reservar es el botón circular separado |
| Precio al repetir (§6, §22 CORE) | «Repetir» recupera la referencia, pero la cita debe usar el precio actual | La reserva desde «Repetir» toma el precio del catálogo vigente; lo reservado conserva su precio aunque luego cambie el catálogo |
| Servicios añadidos en sesión (§10, §18) | Se muestran y confirman antes de hacerlos | En el cierre, lo añadido va a precio actual y un ajuste distinto exige marcar «el cliente ha confirmado el importe» |
| Explorar (§35) está en Fase 2 pero la IA vinculada al catálogo (§23) lo necesita | — | Explorar básico en el prototipo; el Explorar multi-negocio sigue en F2 |
| «Ficha de mantenimiento» (§26) en ampliación y «Finalizar» en CORE | — | El campo de mantenimiento está en el cierre como opcional desplegable |
