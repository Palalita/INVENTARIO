# PRD — Sistema de Inventario y Facturación

## 1. Resumen
Aplicación web full-stack para gestión de inventario y facturación, con frontend
moderno (Next.js) y backend estable/escalable/seguro (Node.js + Express + PostgreSQL).

## 2. Stack técnico

### Backend
- Node.js 20 + TypeScript + Express
- PostgreSQL + Prisma ORM (migraciones versionadas)
- Autenticación: JWT access token (15 min) + refresh token (7 días) en cookie httpOnly
- Seguridad: helmet, cors restringido por origen, express-rate-limit, bcrypt, Zod
  para validación de entrada, middleware de autorización por rol
- Logging estructurado (pino), manejo centralizado de errores
- Tests: Vitest + Supertest (unit + integración) contra base de datos de test

### Frontend
- Next.js 14+ (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- TanStack Query (server state / cache / mutaciones)
- React Hook Form + Zod (formularios y validación)
- Zustand (estado de sesión en cliente)
- Recharts (dashboard)
- Tests: Vitest + React Testing Library

### Infraestructura / Go-Live
- Docker + docker-compose para desarrollo local (postgres, backend, frontend)
- Backend desplegable en Railway/Render/Fly.io; frontend en Vercel
- Variables de entorno documentadas en `.env.example` (nunca commitear `.env`)

## 3. Roles y permisos
| Acción                         | Admin | Vendedor |
|--------------------------------|:-----:|:--------:|
| Gestionar usuarios              | ✅    | ❌       |
| CRUD productos/categorías       | ✅    | Lectura  |
| Ajustes de inventario           | ✅    | Entradas/Salidas por venta |
| CRUD clientes                   | ✅    | ✅       |
| Crear/anular facturas           | ✅    | Crear (anular solo admin) |
| Ver dashboard/reportes          | ✅    | Ventas propias |

## 4. Modelo de datos (ver `03-architecture.md` para el schema Prisma completo)
User, Category, Product, StockMovement, Client, Invoice, InvoiceItem, RefreshToken.

## 5. Funcionalidades

### 5.1 Autenticación
- Login con email/password.
- Refresh token rotation; logout revoca el refresh token.
- Primer usuario admin se crea por seed script (no hay registro público).

### 5.2 Productos e inventario
- CRUD de productos (sku único, nombre, categoría, precio, costo, stock, stock mínimo).
- Movimientos de stock (entrada, salida, ajuste) con motivo y usuario responsable,
  actualizando `Product.stock` en una transacción.
- Alerta visual de stock bajo (`stock <= minStock`).
- Búsqueda y filtro por nombre/sku/categoría, con paginación.
- Imagen de producto (opcional) para que los trabajadores identifiquen cada
  producto visualmente en el catálogo y al armar una factura.

### 5.3 Clientes
- CRUD de clientes (nombre, NIT, email, teléfono, dirección).

### 5.4 Facturación
- Crear factura: selecciona cliente + líneas de producto/cantidad.
- Cálculo automático de subtotal, impuesto (configurable, default 12%) y total.
- Al confirmar, descuenta stock de cada producto en una transacción atómica
  (falla si no hay stock suficiente).
- Estados: `EMITIDA`, `ANULADA` (anular repone el stock).
- Generación de PDF de la factura (pdfkit).
- Numeración correlativa de facturas.

### 5.5 Dashboard y reportes
- KPIs: ventas del día/mes, número de facturas, productos con stock bajo,
  top 5 productos más vendidos.
- Reporte de ventas por rango de fechas, exportable a CSV.

## 6. Requisitos no funcionales
- **Seguridad**: OWASP Top 10 cubierto (validación estricta, sin SQL injection por
  usar Prisma parametrizado, rate limiting en `/auth/*`, CORS restringido, headers
  con helmet, contraseñas con bcrypt cost >= 12, JWT firmado con secreto fuerte
  vía env var).
- **Estabilidad**: manejo centralizado de errores, transacciones para operaciones
  que tocan stock, tests automatizados en flujos críticos.
- **Escalabilidad**: backend stateless (sesión vive en JWT/DB, no en memoria),
  paginación en todos los listados, índices en columnas de búsqueda frecuente
  (sku, email, fechas).
- **Observabilidad**: logs estructurados con requestId, endpoint de `/health`.

## 7. Fuera de alcance
Ver `01-idea.md`.
