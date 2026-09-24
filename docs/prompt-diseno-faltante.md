# Prompt · Lo que le falta al diseño «Barbería · Tu estilo, siempre contigo» (v1.0)

Continúa el diseño existente de la app de barbería (v1.0, iOS/Android, claro/oscuro) **sin cambiar su estética**: blanco/negro con grises, acento azul #3B82F6 / violeta #7C3AED, glow #EDEBFF, SF Pro Display, componentes con profundidad (sombras suaves, glassmorphism, botones con relieve), foto protagonista, botón negro en pastilla con flecha en círculo blanco, barra inferior Inicio · Explorar · (+) · Citas · Perfil y tarjeta violeta de Style AI. La app es para una sola barbería. Diseña las pantallas y estados siguientes con el mismo espaciado, radios y jerarquía.

## 01 · Inicio
- La tarjeta «Tu próxima cita» cambia según el momento: antes → «Preparar visita»; el día → «Mostrar QR»; al llegar → «Llegada registrada»; al terminar → «Ver resultado». Estados con icono y texto: confirmada, modificada, cancelada, llegada, en atención.
- Banda flotante sobre la barra inferior el día de la cita: «Próxima cita · 12:00 · Ver QR».
- La campana abre avisos: oferta de lista de espera y recompensa disponible.
- Tres datos breves en tarjetas: «24 días desde tu último corte» · «19 visitas con Alex» · «~24 días, tu ritmo».
- Style AI con etiqueta «Próximamente».

## Nueva · Bienvenida
Foto a pantalla completa, «Tu estilo. Siempre contigo.», panel inferior con una frase de valor y el botón negro con flecha «Empezar».

## 02 · Explorar y 03 · Detalle de look
- Cada look es un trabajo real del local publicado con permiso del cliente: muestra barbero, duración y precio actual («desde» si procede).
- «Quiero este look» guarda la imagen como referencia de la próxima cita y abre la reserva con ese barbero y servicio.
- Nota discreta: «Tu barbero confirmará la adaptación; no garantiza el mismo resultado».

## 04 · Reserva (en pasos, misma estética de chips)
1. Servicios: tarjetas con duración y precio, selección múltiple.
2. Barbero: tarjeta con foto, especialidades y «Tu barbero de siempre».
3. Fecha y hora con tus chips; estado sin huecos con tarjeta «Avísame si se libera algo» y franja horaria; estado «Ese hueco acaba de ocuparse» con horas alternativas.
4. Preparar mi visita (sustituye a la nota): Repetir último look · Elegir uno anterior · Subir referencia · Quiero cambiar · Lo hablo con mi barbero; campos «Esto sí (qué mantener)» / «Esto no (qué cambiar)».
5. Revisión: desglose «Corte 22 € + Barba 10 € = 32 € total previsto» y «El pago se hace en el local».

## Nueva · Ticket de reserva
Cabecera oscura «Reserva confirmada», código #B24091, muescas de ticket, fecha y hora, servicios, barbero y dirección. Acciones: Mostrar QR · Wallet (Próximamente) · Calendario · Cambiar hora · Cancelar.

## Nueva · Pase QR
QR grande sobre blanco, código alternativo «Si el QR falla, di #B24091», texto «No contiene tus datos personales».

## Citas (pestaña)
- Segmentado «Próximas / Pasadas».
- Visita pasada → detalle: fotos por vista (frontal, lateral izq., lateral der.), servicios e importe de ese día, «Cómo mantenerlo», «Me gustó / Cambiaría», comparador Antes/Después con deslizador, acciones Favorito · Repetir (con precio actual) · Compartir (sin importes).

## 05 · Perfil (oscuro)
- Mis looks con colecciones: Favoritos · Mis cortes · Barba · Quiero probar.
- Recompensas: tu barra 8/10, medallas de logros (bloqueado / en progreso / conseguido) y monedero Disponibles / Utilizadas / Caducadas con código de canje y vencimiento.
- Preferencias: chips con origen («propuesta por tu barbero» → Confirmar) y «Cómo quiero mi sesión» con interruptores.
- Privacidad y fotos: interruptor por foto «Permitir en el portfolio del local».
- Mi actividad: gasto del año, visitas, media y servicios frecuentes.
- «Métodos de pago» como «Próximamente» (la app no cobra online).
- Tema: Sistema / Claro / Oscuro.

## App del barbero (misma estética)
Hoy (agenda por horas, pausas rayadas no reservables, estados, aviso «preparación modificada») · Escanear QR con resultados «Llegada registrada / Ya registrado / Reserva cancelada / Otro establecimiento» y búsqueda manual por nombre o código · Ficha de sesión con foto de referencia y «Quiere hoy» (mantener / cambiar) en primer plano, preferencias, última visita e historial del local · Finalizar sesión en 5 pasos: servicios · importe con ajuste confirmado · fotos guiadas (frontal, laterales, posterior, detalle; con subida fallida y reintento) · nota técnica · pago «en el local / pendiente» · Canjear recompensa · Cliente sin reserva.

## Gestión (propietaria)
Catálogo con precios, bloqueo de tramos de agenda, registro de actividad.

## Estados en todas las pantallas
Vacío (sin citas, sin fotos), carga, error junto al campo, permiso denegado, integración «Próximamente» (Wallet, Style AI, pagos), confirmaciones con toast.

## Movimiento
Presión `scale(0.96)` con rebote suave al soltar; pantallas que entran por la derecha; foto que se expande del listado al detalle; hojas inferiores arrastrables; indicadores de pestaña que se deslizan; parallax en fotos de cabecera; versión con fundidos para «reducir movimiento».
