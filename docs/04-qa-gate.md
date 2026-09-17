# QA Gate

Estado al 2026-09-16, tras implementación (backend + frontend en paralelo) y una
ronda de pruebas de integración end-to-end reales (backend levantado + Postgres local
+ frontend en el navegador, no solo tests automatizados).

## Resultado de verificación automatizada
| Chequeo | Backend | Frontend |
|---|---|---|
| Install | ✅ | ✅ |
| Lint / typecheck | ✅ (`tsc --noEmit`) | ✅ (`next lint`, 0 errores, 3 warnings inofensivos) |
| Build | ✅ | ✅ (`next build`) |
| Tests unitarios/integración | ✅ 16/16 (Vitest+Supertest) | ✅ 12/12 (Vitest+RTL) |

## Bugs encontrados y corregidos durante QA manual en navegador
Los agentes de backend y frontend se construyeron en paralelo contra el mismo
`api-contract.md`, pero el contrato no especificaba el **sobre** (wrapper) exacto de
cada respuesta de un solo recurso. El backend envolvió consistentemente cada
respuesta de un solo recurso como `{ <entidad>: {...} }` (p. ej. `{ product: {...} }`,
`{ invoice: {...} }`), mientras el frontend asumió en varios puntos que la API
devolvía la entidad "plana". Esto causaba errores reales en runtime, detectados solo
al probar en el navegador (los tests unitarios de cada lado, al mockear su propio
lado, no lo detectaban):

1. **Dashboard crasheaba** (`(data ?? []).map is not a function`) — `GET
   /dashboard/sales-report` devuelve `{ data: [...] }`, el hook esperaba el array
   directo. **Corregido** en `lib/hooks/use-dashboard.ts`.
2. **Página de productos crasheaba** al listar categorías — `GET /categories`
   devuelve `{ data: [...] }`. **Corregido** en `lib/hooks/use-categories.ts`.
3. **Crear factura mostraba "Factura #undefined creada"** y redirigía a una URL
   rota — `POST/GET/PATCH /invoices*` devuelven `{ invoice: {...} }`. **Corregido**
   en `lib/hooks/use-invoices.ts` (create, get, cancel).
4. Por el mismo patrón, se corrigieron también crear/editar producto, crear/editar
   cliente y registrar movimiento de stock en `use-products.ts` / `use-clients.ts`
   (no llegaron a manifestarse como crash visible en la sesión de prueba, pero el
   mismo defecto estaba presente y se confirmó comparando cada endpoint con curl
   directo al backend).

Después de cada corrección se repitió el flujo en navegador real (Chrome, vía
automatización) hasta completarlo sin errores de consola.

5. **`window.confirm()` nativo congelaba la sesión de automatización del navegador**
   al anular una factura (diálogo bloqueante fuera del árbol de React). Se reemplazó
   en los 3 puntos donde se usaba (anular factura, eliminar cliente, desactivar
   producto) por un componente `ConfirmDialog` propio basado en shadcn `AlertDialog`
   — no bloqueante, más acorde a un frontend "moderno", y verificado en los 3 casos.

## Flujo dorado verificado manualmente end-to-end (navegador real + Postgres real)
- Login con el usuario admin del seed.
- Dashboard carga KPIs y gráfica sin error.
- Listado de productos y clientes.
- Crear factura: selección de cliente, autocompletado de producto, cálculo en vivo
  de subtotal/impuesto(12%)/total, creación exitosa.
- **Stock decrementado correctamente** tras crear la factura (verificado en DB).
- Descarga de PDF de factura (archivo generado y válido).
- Anular factura con el nuevo diálogo de confirmación — **stock repuesto
  correctamente** (verificado en DB).
- Desactivar producto con el nuevo diálogo de confirmación.
- Rate limiting de login confirmado (5 intentos/15 min, headers `RateLimit-*`
  presentes).

## Checklist de requisitos no funcionales (`02-prd.md` §6)
- [x] Contraseñas con bcrypt cost 12.
- [x] JWT access corto + refresh token httpOnly.
- [x] Rate limiting en login.
- [x] Helmet + CORS restringido a `FRONTEND_URL`.
- [x] Validación Zod en todas las mutaciones.
- [x] Transacciones atómicas en creación/anulación de factura.
- [x] Paginación en todos los listados.
- [x] Sin secretos en el repo (`.env` real está gitignored; solo `.env.example` con
      placeholders se versiona).
- [x] `passwordHash`/`tokenHash` nunca se exponen en respuestas.

## Limitaciones conocidas (fuera del flujo dorado principal, no bloquean go-live de un MVP)
Documentadas explícitamente para que quede claro qué falta, no se descubrió tarde:
- **No hay UI de gestión de usuarios** (`/usuarios`, solo admin). El backend ya
  expone `GET/POST/PATCH /users` completos y probados; falta la pantalla.
- **No hay botón de exportar CSV** del reporte de ventas en el dashboard, aunque
  el backend soporta `GET /dashboard/sales-report?format=csv`.
- Confirmaciones de fecha en filtros de facturas usan `<input type="date">` nativo
  en vez de un date-picker con calendario.

Recomendación: estas pantallas faltantes son trabajo de front-end acotado (la API
ya existe y está probada) — buen primer follow-up post-lanzamiento.

## Actualización 2026-09-16 (post-lanzamiento inicial)
- **Gestión de categorías agregada**: diálogo "Categorías" en `/productos` (solo
  admin) con crear/renombrar/eliminar, usando `POST/PATCH/DELETE /categories` que
  ya existían en el backend. Verificado end-to-end en navegador (crear, renombrar,
  eliminar con confirmación, y reflejo inmediato en el selector de categoría del
  formulario de producto y en el filtro del listado).
- **Bug de UI corregido**: los 4 `Select` del proyecto (filtro de categoría,
  categoría del formulario de producto, estado de factura, tipo de movimiento de
  stock) mostraban el `value` interno crudo (UUID de categoría, o un sentinel
  interno) en vez de la etiqueta legible — `SelectValue` de Base UI necesita un
  render-prop explícito para resolver el label. Corregido en los 4 puntos.
- **Bug de UI corregido**: `Button` con `render={<Link/>}` (navegación como
  enlace) generaba una advertencia de Base UI por no declarar `nativeButton={false}`;
  corregido en "Nueva factura" y "Ver factura".

## Actualización 2026-09-16 (segunda ronda de features)
- **Header con contexto**: la barra superior ahora muestra la sección activa
  (ícono + nombre) a la izquierda y un menú de usuario (avatar, nombre, rol,
  correo, cerrar sesión) a la derecha, visible también en mobile (antes el
  nombre del usuario solo vivía en el pie del sidebar, oculto en mobile).
- **Campo "Costo" quitado del formulario de producto**: el modelo y el backend
  conservan `cost` (default 0, no se pierde información existente), pero ya no
  se pide ni se envía desde el formulario de creación/edición.
- **`documentId` renombrado a `nit`** en todo el stack (Prisma, migraciones,
  backend, frontend, docs) — el negocio siempre lo usó como NIT (el seed ya
  traía "CF-0001", el código fiscal estándar de Consumidor Final en Guatemala).
  Migración `20260917020541_rename_document_id_to_nit` aplicada en dev y test.
- **Creación rápida de cliente dentro de "Nueva factura"**: el combobox de
  cliente (que ya buscaba por nombre/NIT en servidor) ahora ofrece
  "Crear cliente ⟨texto buscado⟩" al final de la lista; abre el mismo formulario
  de cliente en modo diálogo controlado, precarga el nombre con lo buscado, y al
  guardar selecciona automáticamente el cliente recién creado en la factura.
- **Bug corregido durante QA de esta ronda**: `DropdownMenuLabel` (usado en el
  nuevo menú de usuario) requiere estar envuelto en `DropdownMenuGroup` — Base UI
  lanzaba `MenuGroupContext is missing` y tumbaba el árbol de React al abrir el
  menú. Corregido envolviendo el label en `DropdownMenuGroup`.
- Verificado end-to-end en navegador: header en todas las secciones, crear
  producto sin costo, tabla/formulario de clientes con columna "NIT", y el
  flujo completo de factura nueva → buscar cliente inexistente → crear cliente
  al vuelo → queda seleccionado → agregar producto → crear factura → detalle
  muestra el NIT correctamente.

## Actualización 2026-09-16 (bugs de datos post-lanzamiento)
- **Causa raíz encontrada de las bases de datos vacías recurrentes**: Vitest/Vite
  precargan `DATABASE_URL` del `.env` raíz en `process.env` antes de que corriera
  `src/config/env.ts`; como `dotenv.config()` no sobreescribe por defecto,
  `.env.test` no tenía efecto pese a que `NODE_ENV=test` sí se resolvía bien —
  cada `npm test` vaciaba la base de datos de **desarrollo**, no la de test.
  Corregido con `override: true` en la carga de env, más una guarda en
  `resetDb()` que aborta si `NODE_ENV`/`DATABASE_URL` no apuntan claramente a
  una base de test. Verificado corriendo la suite completa y confirmando que
  los datos de desarrollo sobreviven.
- **Bug corregido**: el gráfico "Ventas — últimos 14 días" no mostraba ventas
  del día aunque existieran. `getSalesReport` comparaba fechas de calendario
  (`YYYY-MM-DD`, sin hora) parseadas como medianoche **UTC** contra timestamps
  guardados en UTC pero generados en hora **local** del servidor — en cualquier
  zona horaria detrás de UTC (como la de este proyecto, Guatemala/UTC-6) eso
  recorta ventas de la tarde/noche del rango. Se agregó `startOfLocalDay()`
  (misma hora local que ya usaban `startOfToday()`/`startOfMonth()`) y `to` pasó
  a ser un límite exclusivo al día siguiente. Verificado: una factura creada
  minutos antes ahora aparece correctamente en el gráfico.
