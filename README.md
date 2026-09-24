# Samba · app de barbería

> «Samba» es un **nombre de trabajo**. El nombre comercial está pendiente.

No es solo una app para pedir hora. Es la memoria digital de la relación entre una persona, su estilo y su barbero: reservar, preparar la visita, registrar la llegada, documentar el resultado, recordarlo y volver.

Este repositorio contiene:

- **`docs/`**: los entregables de definición (arquitectura, pantallas, design system, datos, permisos, tecnología propuesta, plan del MVP, riesgos) y la trazabilidad de los 67 apartados del documento maestro. Empieza por [`docs/README.md`](docs/README.md).
- **`app/`**: un **prototipo navegable** con datos ficticios. No es una aplicación de producción.
- **`supabase/`**: el backend del MVP (tablas, permisos por rol, funciones y pruebas). Para ponerlo en marcha, lee [`docs/supabase.md`](docs/supabase.md).

## Probar el prototipo

```bash
cd app
npm install
npm run dev        # abre http://localhost:5173
npm test           # reglas de negocio (criterios del §66)
npm run build      # typecheck + build estático en app/dist
```

En la barra superior («Modo demostración») puedes:

- **cambiar de rol**: Cliente · Nico, Barbero · David, Barbera · Sara, Propietaria · Marta;
- **avanzar el reloj de demostración** (+15 min, +1 h, +1 día), que empieza a las 10:00 del día actual;
- **reiniciar la demo**.

Los cambios se guardan solo en tu navegador.

### Recorrido sugerido (5 minutos)

1. **Cliente:** en Inicio verás la cita de hoy a las 11:15 y el premio 9/10. Pulsa *Mostrar QR*. Después ve a *Preparar* y revisa el «esto sí / esto no».
2. **Barbero · David:** *Escanear* → *Controles de demo* → «QR de Nico Ferrer». Vuelve a escanearlo: saldrá «Ya registrado». Después *Abrir ficha* → *Finalizar sesión* → añade una foto → *Finalizar*. Se desbloquea una recompensa.
3. **Cliente:** Inicio muestra la recompensa disponible; en Historial está la visita nueva; *Repetir* reserva con el precio actual.
4. **Barbero:** *Canjear* con el código de la recompensa. Si intentas canjearlo otra vez, se rechaza.
5. **Propietaria · Marta:** cambia un precio en *Gestión* y comprueba que las citas ya reservadas conservan su importe.

## Qué está simulado

Cámara del escáner y de fotos, Apple/Google Wallet, compartir imágenes, Style AI y música. Cada uno aparece etiquetado en la interfaz. La app **no cobra** ni envía notificaciones.
