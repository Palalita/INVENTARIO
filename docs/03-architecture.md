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
- `express-rate-limit` en `/api/v1/auth/login` (5 intentos / 15 min por IP).
- `helmet()` con CSP básica; `cors({ origin: FRONTEND_URL, credentials: true })`.
- Middleware `requireAuth` valida JWT; `requireRole(...roles)` valida autorización.
- Todas las mutaciones validan body con Zod antes de llegar al service.
- Contraseñas con `bcrypt`, cost factor 12.
- Nunca exponer `passwordHash` ni `tokenHash` en responses (usar DTO/select).

## Transacciones críticas
- **Crear factura**: dentro de `prisma.$transaction`, verificar stock suficiente
  por cada línea, crear `Invoice` + `InvoiceItem[]`, descontar `Product.stock`,
  registrar `StockMovement` tipo `SALIDA`. Si algún producto no tiene stock
  suficiente, se aborta toda la transacción (409 Conflict).
- **Anular factura**: dentro de transacción, repone stock (`StockMovement` tipo
  `ENTRADA` con motivo "Anulación factura #N") y marca `status = ANULADA`.
