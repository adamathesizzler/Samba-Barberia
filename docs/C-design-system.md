# C · Design System

Propuesta de diseño, **no una marca aprobada** (§46, 62). Implementado como tokens CSS en `app/src/styles/tokens.css` y componentes en `app/src/styles/app.css` + `app/src/ui/`.

## Principios

1. **Fotografía protagonista, interfaz discreta.** Blancos rotos y grafito; el color lo aportan las fotos.
2. **La tarea manda sobre el efecto** (§65): en agenda, QR, ficha e importes, superficies opacas y contraste estable. El cristal solo en barra flotante, banda contextual, botones sobre foto y paneles de perfil (§48).
3. **Un solo lenguaje de selección** (R05/R06): lo seleccionado es una superficie grafito (claro) o hueso (oscuro) dentro de un contenedor neutro, con texto/ARIA además del color.
4. **Estado ≠ marca ≠ fidelización**: tres familias de color que no se mezclan.

## Tokens

### Color (semánticos)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#f5f4f1` | `#0d0d0e` | Fondo de página |
| `--surface` / `-2` / `-3` | `#fff` / `#eeece8` / `#e4e1dc` | `#17171a` / `#212125` / `#2b2b30` | Tarjetas, contenedores, pistas |
| `--text` / `-2` / `-3` | `#151515` / `#66625c` / `#8d8983` | `#f1f0ed` / `#a8a49e` / `#7c7973` | Principal, secundario, terciario |
| `--border` | 9 % negro | 9 % blanco | Bordes finos |
| `--selected` / `--on-selected` | grafito / blanco | hueso / negro | Selección, CTA principal |
| `--accent` | `#a4522b` | `#d27a4e` | **Acento provisional configurable por negocio** (§46) |
| `--success`, `--warning`, `--danger` (+ `-bg`) | | | Solo estados |
| `--loyalty` (+ `-bg`) | `#a88452` | `#d6b582` | Solo fidelización (premios, medallas) |
| `--glass`, `--glass-border` | 72 % blanco | 70 % carbón | Superficies translúcidas |

El modo oscuro no invierte: usa carbón y grafito para separar niveles (§47). Con `prefers-reduced-transparency` el cristal pasa a superficie opaca; con `prefers-reduced-motion` las animaciones se reducen a 1 ms.

### Tipografía

Pila del sistema (`-apple-system`, SF Pro, Inter, Segoe UI, Roboto). Sin fuentes externas en el prototipo.

| Token | Tamaño | Uso |
|---|---|---|
| `--fs-3xl` | 36 px, 700, −0.03em | Saludo, cifras protagonistas |
| `--fs-2xl` | 28 px | Hora de la cita, título de ticket |
| `--fs-xl` | 22 px | Títulos de página |
| `--fs-lg` | 18 px | Títulos de sección |
| `--fs-md` | 15 px | Texto y botones |
| `--fs-sm` / `--fs-xs` | 13 / 12 px | Metadatos, ayudas |

### Espacio, radios, elevación, movimiento

- Espaciado base 4: `--s1`…`--s10` (4–40 px). Margen lateral de página 16 px.
- Radios: `--r-sm` 10 · `--r-md` 16 · `--r-lg` 22 · `--r-xl` 28 · `--r-full`.
- Elevación: **dos niveles** únicamente (`--shadow-1` tarjeta, `--shadow-2` flotante/ticket).
- Movimiento: `--ease` = cubic-bezier(.2,.8,.2,1); `--t-fast` 160 ms, `--t-med` 280 ms. Ticket entra desde abajo (420 ms); pestaña activa se desplaza; progreso anima su anchura.
- Área táctil mínima `--tap` 44 px.

## Componentes base

| Familia | Clases | Estados |
|---|---|---|
| Botones | `.btn` `.primary` `.accent` `.outline` `.ghost` `.danger` `.sm` `.block`, `.icon-btn`, `.fab` | normal, pulsado (escala .97), deshabilitado, cargando (texto) |
| Chips / filtros | `.chip[aria-pressed|aria-checked]`, `.chips` | normal, seleccionado, deshabilitado |
| Control segmentado | `.segmented [aria-selected]` | |
| Formularios | `.field .input .textarea .select .hint .error`, `.check`, `.switch[aria-checked]` | foco visible, error junto al campo |
| Avisos | `.notice .success .warning .danger`, `.badge .success .warning .danger .loyalty .sim` | estado siempre con texto + icono |
| Superficies | `.card .flat .tinted .clickable`, `.glass`, `.list .list-item` | |
| Progreso | `.progress`, `.progress.segments` (≤ 12 unidades) | `role="progressbar"` |
| Hoja inferior / toast | `.sheet`, `.toast` | modal con `aria-modal` |
| Vacíos | `.empty` | sin datos inventados |

## Componentes del producto (§63)

Implementados en `app/src/ui/product.tsx` y pantallas:

| Componente | Dónde | Estado |
|---|---|---|
| `AppointmentCard` | Home | ✅ cambia su acción según el momento |
| `Ticket` (WalletPassCard interno) | Confirmación | ✅ cabecera por estado (confirmada / cancelada / completada) |
| `CheckInQR` | Pase | ✅ |
| `CustomerSessionCard` | Ficha profesional | ✅ (pantalla `SessionCardScreen`) |
| `VisitPreparationCard` | Detalle de cita / Preparar | ✅ |
| `BarberCard`, `ServiceCard` | Reserva | ✅ como filas de lista |
| `WaitlistCard` | Lista de espera | ✅ |
| `StyleCard`, `StyleGallery`, `VisitCard` (`VisitRow`) | Historial, Perfil | ✅ |
| `BeforeAfterSlider` | Detalle de visita | ✅ gesto + control deslizante accesible |
| `PreferenceChip` | Ficha, Preferencias | ✅ distingue propuesta (borde discontinuo) |
| `AchievementCard`, `RewardCard`, `ProgressBar` | Recompensas, Home | ✅ |
| `SpendingSummary` | Mi actividad | 🟡 básico |
| `AIRecommendationCard`, `StylePreviewCard`, `YearRecapCard` | — | ⏳ F2/F3 |

## Fotos en el prototipo

No se usan fotos de personas reales ni las de las referencias. `PhotoArt` dibuja una silueta SVG por tono y vista, siempre con etiqueta «Foto demo», «Referencia externa» o «Simulación IA».

## Validación pendiente (§62)

Las cuatro escenas de control (Home con foto, ficha del barbero, formulario de reserva y ticket) están implementadas en claro y oscuro. Falta: revisión con texto ampliado al 200 %, tableta y escritorio con distribución propia, y valoración del acento de marca cuando exista nombre/logo.

## Referencias adicionales R11–R13 (24/09/2026)

Aportadas por el promotor como inspiración para adaptar, no para copiar.

| Ref. | Qué es | Qué se toma | Qué no se toma |
|---|---|---|---|
| **R11** | Perfil con foto a pantalla completa que se funde en oscuro | Foto de fondo que se difumina hacia el fondo de la página; nombre grande centrado; botón de pastilla principal junto a uno redondo; tres cifras en fila; tarjeta translúcida de presentación; galería debajo | Seguidores, «Follow», chat. Las cifras son visitas, estilos y recompensas; la tarjeta resume las preferencias confirmadas |
| **R12** | Galería con foto de cabecera que se desvanece en blanco | Cabecera fotográfica con máscara degradada; fecha grande con el año en gris; botones de cristal en pastilla; título de sección con recuento a la derecha; cuadrícula de 3 columnas con piezas redondeadas y separación; navegación flotante | Acciones de «Clean» o limpieza automática |
| **R13** | App de citas (happn): bienvenida, inicio y mapa | Fondo aéreo con degradados suaves; saludo con avatar y pastillas a la derecha; fichas de categoría con relieve; tarjeta de foto grande con botones de cristal en el lateral y etiquetas abajo; datos breves en tres fichas; botón central en forma de esfera; bienvenida con titular grande y botón negro con flecha | Mapa de personas cercanas, porcentajes de afinidad, «me gusta». El fondo usa tonos melocotón y azul pálido, en coherencia con el acento terracota decidido |

### Dónde se aplica

- **Bienvenida** (`#/cliente/bienvenida`, pantalla 01): R13. Se muestra la primera vez; se puede volver a ver desde Ajustes.
- **Inicio**: R13. Saludo, fichas de categoría que abren la reserva con ese servicio, próxima cita como tarjeta fotográfica con QR / Preparar / Reserva y datos breves (días desde el último corte, visitas con su barbero, ritmo; «—» si no hay datos suficientes).
- **Perfil**: R11.
- **Historial**: cabecera R12 con la última visita.
- **Navegación del cliente**: pastilla flotante con esfera central «Reservar» (R13), que sustituye al botón separado de R07 manteniendo los mismos cinco destinos.

### Tokens nuevos

`--ground-1`, `--ground-2` (fondo aéreo) y `--orb-1`, `--orb-2` (esfera), definidos en claro y oscuro. Componentes: `.glass-round` y `.chip-glass` (cristal oscuro para ir sobre foto), `.glass-pill`, `.cat`, `.photo-card`, `.facts`, `.profile-hero`, `.fade-hero`, `.orb`, `.welcome`, `.cta-arrow`.

### Fotos de demostración

`PhotoArt` pasa a dibujar retratos de estudio en silueta (luz suave, borde iluminado, perfil o frente, tres tipos de corte) con más contraste de color. Siguen etiquetados «Foto demo»; en cabeceras la etiqueta va arriba para no tapar el contenido.

## Movimiento e interacción (24/09/2026)

Criterios de Emil Kowalski (design engineering) y de *Designing Fluid Interfaces* de Apple, aplicados en `app/src/ui/motion.ts`, `app/src/app/router.ts` y el bloque «Oficio de interacción» de `app.css`.

| Principio | Cómo se aplica |
|---|---|
| Respuesta al pulsar, no al soltar | Todo lo pulsable se hunde a `scale(0.96)` en 100 ms y vuelve con un leve muelle (`--ease-spring`, 420 ms): presión rápida, suelta con cuerpo |
| Curvas con carácter | `--ease-out` (0.23, 1, 0.32, 1) para respuestas; `--ease-drawer` (0.32, 0.72, 0, 1) para hojas y pantallas; nunca `ease-in` |
| Continuidad espacial | Adelante: la pantalla nueva entra por la derecha y la anterior retrocede un 28 % y se oscurece. Atrás: vuelve por el mismo camino. Entre pestañas: fundido. La barra inferior y la de demostración no se mueven (View Transitions API; sin soporte, entrada suave de respaldo) |
| Elemento compartido | La foto que tocas en Perfil, Mi estilo o Explorar se expande hasta la foto grande del detalle |
| Manipulación directa | La hoja inferior sigue al dedo 1:1, resiste hacia arriba (rubber-band) y se cierra con un gesto rápido (velocidad > 0,11 px/ms) aunque recorra poca distancia. Sale por donde entró |
| Indicadores que se deslizan | Pestañas, pestaña activa de la barra inferior y controles segmentados: una pastilla se desplaza con `transform` (interrumpible), en lugar de saltar |
| Profundidad | Cabeceras de Perfil e Historial con parallax y ampliación al estirar; tarjeta de la próxima cita con inclinación 3D sutil que sigue al ratón con inercia (solo con puntero fino); materiales con luz en el borde superior y sombra en dos capas; el contenido se desvanece bajo la barra inferior |
| Detalle en momentos poco frecuentes | Entrada escalonada de Inicio solo la primera vez por sesión; cifras del perfil que cuentan hasta su valor; segmentos del premio que se llenan uno tras otro; corazón con «pop» al marcar favorito; ticket que llega con material (desenfoque → nítido) |
| Aviso (toast) | Entra con desenfoque y escala; sale más rápido de lo que entró |
| Háptica con significado | Vibración breve en reserva confirmada, llegada registrada, sesión cerrada y errores. Nunca en navegación normal |
| Accesibilidad | Con «reducir movimiento»: sin transiciones de pantalla, parallax ni inclinación; las entradas pasan a fundidos de 200 ms. Con «reducir transparencia», el cristal es opaco |

## Diseño v1.0 del promotor (R14, 24/09/2026)

Hoja de diseño «Barbería · Tu estilo, siempre contigo» con cinco pantallas (Inicio, Explorar, Detalle de look, Reserva, Perfil), componentes, colores (Negro #0B0B0C, Gris oscuro #1C1C1E, Gris #8E8E93, Gris claro #D1D1D6, Blanco, Azul #3B82F6, Violeta #7C3AED, Glow #EDEBFF), tipografía SF Pro Display y barra inferior Inicio · Explorar · (+) · Citas · Perfil. **Sustituye a R11–R13 como dirección visual principal**; los tokens se han reescrito con esta paleta.

Lo que se añadió dentro de esa estética (lo que el diseño no cubría) está en [`prompt-diseno-faltante.md`](prompt-diseno-faltante.md): tarjeta de cita que cambia con el momento, ticket y pase QR, reserva completa (servicios, barbero, lista de espera, preparar mi visita, total), pestaña Citas con pasadas y detalle de visita, recompensas completas, preferencias, privacidad de fotos, actividad, app del barbero y gestión.

Componentes nuevos: `.home-hero`, `.dark-glass`, `.next-card`, `.quick`, `.looks-row`/`.look-mini`, `.ai-card`/`.ai-orb`, `.explore-grid`/`.look-card`, `.look-hero`, `.thumbs`, `.pill-cta` (+ `.dark`), `.date-chip`, `.time-grid`/`.time-chip`, `.svc-card`, `.barber-card`, `.action-bar`, `.stat-tiles`, `.progress-card`/`.bar`, `.menu`, `.appt-mini`, `.soon`. El Perfil se pinta siempre en oscuro con la clase `.theme-dark`, que redefine los tokens solo en esa pantalla.
