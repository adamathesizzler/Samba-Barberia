# G · Estructura del proyecto

```
Samba-Barberia/
├── README.md                     Qué es, cómo ejecutarlo, estado
├── docs/
│   ├── README.md                 Índice de la documentación y estado general
│   ├── A-arquitectura-funcional.md
│   ├── B-mapa-de-pantallas.md
│   ├── C-design-system.md
│   ├── D-modelo-de-datos.md
│   ├── E-roles-y-permisos.md
│   ├── F-arquitectura-tecnica.md
│   ├── G-estructura-de-proyecto.md
│   ├── H-plan-mvp.md
│   ├── I-riesgos-y-decisiones.md
│   ├── requisitos.md             Los 67 apartados con estado y fase
│   └── pruebas-de-aceptacion.md  Criterios del §66 y cómo se comprueban
└── app/                          Prototipo navegable (J)
    ├── index.html
    ├── package.json              dev · build · typecheck · test
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx               Rutas, navegación por rol, barra de demostración
        ├── app/
        │   ├── router.ts         Router por hash
        │   └── store.tsx         Backend de demo, reloj de demo, rol activo, persistencia local
        ├── domain/               Reglas de negocio sin interfaz (se portan al servidor en el MVP)
        │   ├── types.ts          Entidades (espejo de D)
        │   ├── availability.ts   Huecos, jornadas, bloqueos, margen, ofertas retenidas
        │   ├── permissions.ts    Matriz de acceso (E)
        │   ├── backend.ts        Operaciones: reservar, check-in, cerrar, canjear, lista de espera…
        │   ├── queries.ts        Lecturas derivadas: progreso, logros, gasto, ficha, portfolio
        │   ├── seed.ts           Datos ficticios coherentes
        │   ├── time.ts           Fechas locales y formato
        │   └── backend.test.ts   Criterios de aceptación (§66)
        ├── ui/
        │   ├── Icon.tsx          Iconos propios
        │   ├── common.tsx        Primitivas: foto demo, avatar, estado, progreso, hoja, interruptor…
        │   └── product.tsx       Componentes del producto (§63)
        ├── screens/
        │   ├── cliente/          Home, Explorar, Reserva, Cita/Pase, Preparar, Historial, Perfil, Recompensas
        │   └── barbero/          Hoy/Escáner/Canje/Sin reserva, Ficha, Finalizar, Gestión
        └── styles/
            ├── tokens.css        Tokens claro/oscuro (C)
            └── app.css           Componentes base
```

## Convenciones

- **El dominio no importa React.** Todo lo que decide (disponibilidad, permisos, idempotencia) está en `domain/` y tiene tests; las pantallas solo llaman a sus operaciones y muestran el resultado real, incluidos los errores.
- **Importes en céntimos**, fechas locales `YYYY-MM-DDTHH:mm` del establecimiento.
- **Todo lo simulado se etiqueta** en la interfaz (`SimBadge`, «Foto demo», «Modo demostración»).
- Textos de interfaz en español; identificadores de código en inglés salvo los términos de dominio del documento (estados, finalidades).

## Estructura prevista para el MVP

```
app/            → web (se mantiene; `domain/` pasa a llamar a la API)
supabase/       → migraciones SQL, políticas RLS, funciones (book, check_in, close_session, redeem, waitlist)
e2e/            → Playwright: recorrido del §66 por rol
```
