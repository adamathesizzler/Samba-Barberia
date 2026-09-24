# A · Arquitectura funcional

> Fuente: Documento maestro v2.0 (24/09/2026). Este documento organiza sus 67 apartados en módulos; no añade funciones nuevas.

## Recorrido principal

```
Reserva → Preparación → Check-in → Servicio → Resultado → Historial → Fidelización → Nueva reserva
   §9-10      §7,15        §13,41     §16-18     §19-21      §4-6       §29-32         §6,27
```

Cada módulo pertenece a uno de los **ocho pilares** (§2). Una función que no encaje en ninguno no entra.

## Módulos

| Módulo | Pilar | Qué hace | Apartados | Fase |
|---|---|---|---|---|
| **Identidad y cuentas** | Gestión | Alta/identificación de cliente, reserva como invitado, vinculación posterior, roles de personal | §39, 40, 52 | MVP |
| **Organización** | Gestión | Negocios, sucursales, profesionales y su pertenencia; aislamiento por negocio | §51, 53 | MVP (1 negocio, estructura multi) |
| **Catálogo** | Reservas | Servicios, precios fijos o «desde», duración por profesional, quién hace qué | §9, 10, 51 | MVP |
| **Agenda** | Reservas | Jornadas, descansos, bloqueos, vacaciones, margen entre citas; agenda única para app, web, teléfono y sin reserva | §9, 17, 40 | MVP |
| **Reservas** | Reservas | Crear, cambiar y cancelar con validación **al confirmar**; historial de estados; lista de espera | §9, 14, 28 | MVP |
| **Preparación** | Experiencia en el local | Repetir/elegir estilo, referencia, «esto sí / esto no», nota; atada a una cita concreta | §7, 15 | MVP |
| **Llegada** | Experiencia en el local | QR con token opaco, escaneo por personal autenticado, alternativa manual, sin duplicados | §13, 41 | MVP |
| **Ficha de sesión** | Herramientas del profesional | Lo que quiere hoy primero; preferencias; historial del propio negocio | §16, 17 | MVP |
| **Cierre de sesión** | Herramientas del profesional | Servicios → importe → fotos → cambios → finalizar; idempotente; borrador | §18, 19, 26 | MVP |
| **Medios y permisos** | Perfil visual | Fotos por visita y vista, estados de subida, permisos por finalidad | §19, 20, 42 | MVP |
| **Historial y Mi estilo** | Historial inteligente | Visitas por fecha, colecciones por intención, favoritos enlazados, repetir con condiciones actuales | §3-6, 8 | MVP |
| **Fidelización** | Fidelización | Progreso, logros, recompensas, monedero y canje verificable | §29-32 | MVP (básico) / F2 (ampliado) |
| **Actividad económica** | Historial inteligente | Gasto, visitas, medias; separa previsto/final/productos | §33 | F2 (el registro básico por visita es MVP) |
| **Descubrimiento** | Perfil visual | Explorar, portfolio del profesional, perfil profesional | §35, 36 | F2 (perfil básico MVP) |
| **Seguimiento** | Historial inteligente | Consulta post-corte, mantenimiento, ritmo de visitas, avisos | §25-27 | F2 |
| **Wallet** | Reservas | Pase Apple / Google (Samsung por verificar) | §12 | F2 |
| **Style AI** | IA de estilo | Análisis orientativo, simulación, enlace con catálogo | §22-24, 60 | F3 |
| **Recap anual** | Fidelización | «Tu año en la barbería» | §34 | F2 |
| **My Session** | (experimental) | Playlist para la cita | §38, 61 | Experimental |
| **Gestión del propietario** | Gestión | Equipo, catálogo, horarios, reglas, actividad, auditoría | §51 | MVP (mínimo) / F2 |

## Separaciones que el modelo respeta en todos los módulos

1. **Reserva ≠ atención ≠ pago.** `appointments` es la intención; `sessions` el resultado; el pago es un estado aparte (§10, 14, 18, 54).
2. **Precio histórico ≠ precio actual.** Cada cita y sesión guarda una copia de sus líneas de servicio (§4, 6, 9).
3. **Comentario puntual ≠ instrucción para la próxima ≠ preferencia confirmada** (§7, 8).
4. **Producto usado ≠ recomendado ≠ vendido** (§5, 26, 33).
5. **Foto guardada ≠ foto publicable.** Permiso por finalidad y por foto (§20).
6. **Real ≠ simulado.** Integraciones no conectadas se muestran como tales (§56, 65).
7. **Un negocio no ve lo de otro.** Compartir una referencia no abre el historial (§42, 53).

## Operaciones que deben ser idempotentes

| Operación | Clave de unicidad | Efecto de repetir |
|---|---|---|
| Crear reserva | (profesional, franja) validada en transacción | Segunda reserva rechazada con alternativas |
| Check-in | una llegada por cita | «Ya registrado» |
| Cerrar sesión | una sesión por cita | Devuelve la sesión existente |
| Sumar fidelización | un movimiento por sesión | No suma |
| Canjear recompensa | estado `disponible → utilizada` | «Ya utilizada» |
| Aceptar oferta de espera | oferta vigente + hueco retenido | La cita original solo se cancela tras crear la nueva |
