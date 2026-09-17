# Arquitectura

## Estructura de carpetas

```
INVENTARIO/
  backend/
    src/
      config/          # env, prisma client, logger
      middlewares/      # auth, errorHandler, rateLimit, validate
      modules/
        auth/            # controller, service, routes, schemas
        users/
        categories/
        products/
        stock-movements/
        clients/
        invoices/
        dashboard/
      utils/
      app.ts
      server.ts
    prisma/
      schema.prisma
      seed.ts
    tests/
    .env.example
    package.json
  frontend/
    app/
      (auth)/login/
      (dashboard)/
        productos/
        clientes/
        facturas/
        inventario/
        dashboard/
    components/
    lib/               # api client, auth store, utils
    tests/
    .env.example
    package.json
  docker-compose.yml
  README.md
```

## Capas backend (por módulo)
`routes -> middleware (auth/validate) -> controller -> service -> prisma`
- **routes**: define endpoints y aplica middlewares.
- **controller**: parsea request/response, no contiene lógica de negocio.
- **service**: lógica de negocio, transacciones Prisma.
- **schemas**: validación Zod de body/query/params.

## Prisma schema (resumen)

```prisma
enum Role {
  ADMIN
  VENDEDOR
}

enum MovementType {
  ENTRADA
  SALIDA
  AJUSTE
}

enum InvoiceStatus {
  EMITIDA
  ANULADA
}

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role     @default(VENDEDOR)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  invoices     Invoice[]
  movements    StockMovement[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tokenHash String
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Category {
  id       String    @id @default(uuid())
  name     String    @unique
  products Product[]
}

model Product {
  id          String    @id @default(uuid())
  sku         String    @unique
  name        String
  description String?
  imageUrl    String?
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id])
  price       Decimal   @db.Decimal(12, 2)
  cost        Decimal   @db.Decimal(12, 2) @default(0)
  stock       Int       @default(0)
  minStock    Int       @default(0)
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  movements   StockMovement[]
  invoiceItems InvoiceItem[]

  @@index([name])
}

model StockMovement {
  id        String       @id @default(uuid())
  productId String
  product   Product      @relation(fields: [productId], references: [id])
  type      MovementType
  quantity  Int
  reason    String?
  userId    String
  user      User         @relation(fields: [userId], references: [id])
  createdAt DateTime     @default(now())

  @@index([productId, createdAt])
}

model Client {
  id         String    @id @default(uuid())
  name       String
  nit        String?   @unique
  email      String?
  phone      String?
  address    String?
  createdAt  DateTime  @default(now())
  invoices   Invoice[]
}

model Invoice {
  id        String        @id @default(uuid())
  number    Int           @unique @default(autoincrement())
  clientId  String
  client    Client        @relation(fields: [clientId], references: [id])
  userId    String
  user      User          @relation(fields: [userId], references: [id])
  status    InvoiceStatus @default(EMITIDA)
  subtotal  Decimal       @db.Decimal(12, 2)
  tax       Decimal       @db.Decimal(12, 2)
  total     Decimal       @db.Decimal(12, 2)
  createdAt DateTime      @default(now())
  items     InvoiceItem[]

  @@index([createdAt])
}

model InvoiceItem {
  id        String  @id @default(uuid())
  invoiceId String
  invoice   Invoice @relation(fields: [invoiceId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  unitPrice Decimal @db.Decimal(12, 2)
  subtotal  Decimal @db.Decimal(12, 2)
}
```

## Seguridad — decisiones concretas
- JWT access token firmado con `JWT_ACCESS_SECRET`, expira en 15 min.
- Refresh token opaco (uuid), se guarda hasheado (sha256) en `RefreshToken`,
  se envía al cliente en cookie `httpOnly, secure, sameSite=strict`.
- `express-rate-limit` en `/api/v1/auth/login` (5 intentos / 15 min por IP), y
  uno general más laxo (600/15min) sobre todo `/api/v1` — el store es en
  memoria del proceso, así que si el backend llega a correr en más de una
  instancia hace falta moverlo a un store compartido (Redis) para que el
  límite siga siendo real.
- `helmet()` con CSP básica; `cors({ origin: FRONTEND_URL, credentials: true })`.
- Middleware `requireAuth` valida JWT; `requireRole(...roles)` valida autorización.
- Todas las mutaciones validan body con Zod antes de llegar al service,
  incluyendo un tope máximo (`pageSize` ≤ 100) en todos los listados paginados.
- Contraseñas con `bcrypt`, cost factor 12. El seed se niega a correr en
  producción con la contraseña de admin por defecto.
- Nunca exponer `passwordHash` ni `tokenHash` en responses (usar DTO/select).
- Anular una factura queda auditado (`Invoice.cancelledAt`,
  `cancelledByUserId`) — no hay un log de auditoría genérico todavía para el
  resto de las acciones (editar producto, cambiar precio, etc.).

## Transacciones críticas
- **Crear factura**: dentro de `prisma.$transaction`, verificar stock suficiente
  por cada línea, crear `Invoice` + `InvoiceItem[]`, descontar `Product.stock`,
  registrar `StockMovement` tipo `SALIDA`. Si algún producto no tiene stock
  suficiente, se aborta toda la transacción (409 Conflict).
- **Anular factura**: dentro de transacción, repone stock (`StockMovement` tipo
  `ENTRADA` con motivo "Anulación factura #N") y marca `status = ANULADA`.

## Imágenes de producto
- Solo se guarda la **URL** en `Product.imageUrl` — el binario nunca toca
  PostgreSQL. El archivo se sube a **Cloudflare R2** (API S3-compatible, capa
  gratuita: 10GB/mes y sin cobro por descargas, a diferencia de S3).
- El navegador nunca habla directo con R2: sube el archivo por
  `multipart/form-data` a nuestro propio backend (`POST /products/:id/image`),
  que valida tipo (JPEG/PNG/WEBP) y tamaño (máx. 5MB) con `multer` en memoria,
  y lo reenvía a R2 con `@aws-sdk/client-s3`. Evita exponer credenciales de R2
  al cliente y evita configurar CORS en el bucket.
- Las variables `R2_*` (`src/config/env.ts`) son **opcionales**: si faltan, el
  resto de la app sigue funcionando normal y el endpoint de subida responde
  `400 IMAGE_STORAGE_NOT_CONFIGURED` en vez de romper el arranque del backend.
