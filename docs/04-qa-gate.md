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
