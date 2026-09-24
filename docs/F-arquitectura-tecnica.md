# F · Arquitectura técnica propuesta

> **Estado: propuesta.** La tecnología, la plataforma inicial y los proveedores siguen pendientes de decisión del promotor (§61, §67). Nada de lo siguiente se ha contratado ni desplegado.

## Qué existe hoy

Un **prototipo navegable** (`app/`): React 19 + TypeScript + Vite, sin servidor. Un «backend» en memoria (`app/src/domain/backend.ts`) aplica las reglas del documento y se prueba con Vitest. Los datos se guardan solo en el navegador de quien lo abre. Cámara, Wallet, IA, pagos y notificaciones no están conectados y se muestran como tales.

## Alternativas para el MVP

| | **1. Web progresiva (PWA) única** — *recomendada* | 2. App nativa (Expo/React Native) + web de gestión | 3. Nativa pura (Swift + Kotlin) + web |
|---|---|---|---|
| Reservar sin instalar (§39) | ✅ nativo del enfoque | Necesita además una web de reserva | Necesita además una web de reserva |
| Código compartido cliente / barbero / propietario | Uno | Dos (app + web) | Tres |
| Cámara y subida de fotos | ✅ `<input capture>` / getUserMedia | ✅ | ✅ |
| Escáner QR | ✅ con permiso de cámara (y alternativa manual, §41) | ✅ | ✅ |
| Apple Wallet | Pase `.pkpass` firmado en servidor; se añade desde Safari | ✅ | ✅ |
| Google Wallet | Enlace «Guardar en Google Wallet» generado en servidor | ✅ | ✅ |
| Samsung | **Por verificar** (§12) | Por verificar | Por verificar |
| Notificaciones push | Limitadas en iOS (requiere añadir a pantalla de inicio); correo/SMS como canal alternativo | ✅ | ✅ |
| Rendimiento / 60 fps (§49) | Bueno si se cuidan imágenes y listas; medir | Mejor | Máximo |
| Presencia en tiendas | Opcional más tarde envolviendo con Capacitor | ✅ | ✅ |
| Coste y tiempo | El menor | Medio | El mayor |

**Recomendación:** empezar con **1**, porque cumple el recorrido completo con un solo código, permite reservar sin instalar y reutiliza el prototipo. Revisar la decisión si el piloto demuestra que hacen falta push fiables en iOS o publicación en tiendas: entonces se envuelve con Capacitor, o se pasa a la opción 2 para el cliente.

## Pila propuesta (opción 1)

| Capa | Propuesta | Por qué | Alternativa |
|---|---|---|---|
| Interfaz | React + TypeScript + Vite (ya en el prototipo), PWA | Continuidad; los componentes y el Design System se reutilizan | Next.js si se quiere SSR para páginas públicas |
| Datos | PostgreSQL gestionado | Restricciones de exclusión para la doble reserva, `UNIQUE` para la idempotencia, RLS para aislar negocios | — |
| Auth, almacenamiento y funciones | Supabase (Postgres + Auth + Storage privado con URLs firmadas + Edge Functions) | Todo en un proveedor, RLS nativo, bajo coste en piloto | Firebase (peor encaje relacional), backend propio en Node + Postgres |
| Imágenes | Variantes (miniatura / galería / detalle) generadas al subir | Perfil y galería sin descargar originales (§19) | CDN de imágenes |
| Pases Wallet | Función de servidor que firma `.pkpass` (certificado Apple) y genera JWT de Google Wallet | Las claves no salen del servidor (§55) | Proveedor SaaS de pases |
| Avisos | Correo transaccional + push web cuando haya permiso | Estado de envío real (§27) | SMS / WhatsApp con alcance propio (§40) |
| Pruebas | Vitest (dominio), Playwright (recorrido), pruebas de RLS con usuarios de cada rol | Criterios del §66 automatizados | — |
| Hosting web | Estático con CDN | Barato y sin servidor propio | — |

## Cómo pasan las reglas del prototipo al MVP

| Regla | Prototipo | MVP |
|---|---|---|
| Validar hueco al confirmar | `isSlotFree` en `book()` | Función `book_appointment` en transacción + `EXCLUDE USING gist` |
| Check-in / cierre / canje únicos | comprobación en memoria | `UNIQUE` + `Idempotency-Key` |
| Permisos | `permissions.ts` | Políticas RLS + comprobación en funciones |
| QR | token aleatorio de 128 bits | idem, guardado como hash; rotación opcional si se valida (§13) |
| Oferta de lista de espera retiene el hueco | `isSlotFree` considera ofertas | la oferta ocupa rango en la restricción de exclusión hasta caducar |
| Auditoría | `state.audit` | `audit_logs` con acceso restringido |

## Qué hace falta decidir o contratar antes de construirlo

1. Plataforma inicial (esta propuesta u otra).
2. Proveedor de backend y región de datos.
3. Cuenta de Apple Developer (para firmar pases) y emisor de Google Wallet.
4. Proveedor de correo.
5. Dominio y nombre comercial.

Ninguno de estos pasos se ha dado: implican coste o publicación y necesitan autorización (§61, §67).
