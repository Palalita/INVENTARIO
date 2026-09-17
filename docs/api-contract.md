# Contrato de API — `/api/v1`

Todas las respuestas de error: `{ "error": { "code": string, "message": string } }`.
Todas las respuestas paginadas: `{ "data": [...], "page": number, "pageSize": number, "total": number }`.

## Auth
- `POST /auth/login` `{ email, password }` → `{ user, accessToken }` + set-cookie `refreshToken`
- `POST /auth/refresh` (cookie) → `{ accessToken }`
- `POST /auth/logout` (cookie) → 204, revoca refresh token
- `GET /auth/me` (auth) → `{ user }`

## Users (admin)
- `GET /users?page=&pageSize=`
- `POST /users` `{ name, email, password, role }`
- `PATCH /users/:id` `{ name?, role?, active? }`

## Categories
- `GET /categories`
- `POST /categories` (admin) `{ name }`
- `PATCH /categories/:id` (admin)
- `DELETE /categories/:id` (admin)

## Products
- `GET /products?search=&categoryId=&lowStock=&page=&pageSize=`
- `GET /products/:id`
- `POST /products` (admin) `{ sku, name, description?, categoryId?, price, cost, stock, minStock }`
- `PATCH /products/:id` (admin)
- `DELETE /products/:id` (admin) — soft delete (`active=false`)
- `POST /products/:id/image` (admin) `multipart/form-data`, campo `image` (JPEG/PNG/WEBP, máx. 5MB) —
  sube la imagen a Cloudflare R2 y actualiza `Product.imageUrl`. 400 `IMAGE_STORAGE_NOT_CONFIGURED` si
  faltan las variables `R2_*` en el backend; 400 `INVALID_FILE_TYPE` / `FILE_TOO_LARGE` según corresponda.
- `DELETE /products/:id/image` (admin) — quita `Product.imageUrl` y borra el objeto en R2 si estaba
  configurado.

## Stock movements
- `GET /products/:id/movements?page=`
- `POST /products/:id/movements` (auth) `{ type: ENTRADA|SALIDA|AJUSTE, quantity, reason? }`

## Clients
- `GET /clients?search=&page=`
- `GET /clients/:id`
- `POST /clients` `{ name, nit?, email?, phone?, address? }`
- `PATCH /clients/:id`
- `DELETE /clients/:id` (admin)

## Invoices
- `GET /invoices?from=&to=&status=&page=`
- `GET /invoices/:id`
- `POST /invoices` `{ clientId, items: [{ productId, quantity }] }` → 201 con factura completa
  - 409 si stock insuficiente: `{ error: { code: "INSUFFICIENT_STOCK", message, details: [{ productId, available, requested }] } }`
- `PATCH /invoices/:id/cancel` (admin) → repone stock, marca ANULADA
- `GET /invoices/:id/pdf` → `application/pdf`

## Dashboard
- `GET /dashboard/summary` → `{ salesToday, salesMonth, invoiceCountMonth, lowStockProducts: [...], topProducts: [...] }`
- `GET /dashboard/sales-report?from=&to=&format=json|csv`

## Health
- `GET /health` → `{ status: "ok", uptime }` (sin auth, sin rate limit)

## Convenciones
- Auth: header `Authorization: Bearer <accessToken>`.
- Todos los endpoints bajo `/api/v1` excepto `/health`.
- Fechas en ISO 8601 UTC.
- Montos como string decimal (evitar floating point) en JSON, ej. `"total": "150.00"`.
