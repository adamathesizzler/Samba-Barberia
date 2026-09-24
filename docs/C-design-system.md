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
