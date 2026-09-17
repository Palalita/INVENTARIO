# Inventario — Backend

API REST para el sistema de inventario y facturación. Node.js 20 + TypeScript +
Express + Prisma + PostgreSQL. Ver `/docs/02-prd.md`, `/docs/03-architecture.md`
y `/docs/api-contract.md` en la raíz del repo para la especificación completa.

## Requisitos

- Node.js 20+
- PostgreSQL corriendo localmente (este proyecto se desarrolló contra Postgres
  vía Homebrew, no Docker)

## Setup

```bash
cd backend
npm install
cp .env.example .env   # completa DATABASE_URL, JWT_ACCESS_SECRET, REFRESH_TOKEN_SECRET
                        # (openssl rand -hex 32 para generar los secretos)

npx prisma generate
npx prisma migrate dev --name init   # crea las tablas en DATABASE_URL

npm run seed   # crea categorías, usuario admin y datos de ejemplo
```

Usuario admin creado por el seed:
- email: `admin@inventario.local`
- password: valor de `ADMIN_SEED_PASSWORD` en `.env`, o `Admin123!` por defecto.

### Levantar el servidor

```bash
npm run dev     # con recarga automática (tsx watch)
# o
npm run build && npm start
```

El servidor escucha en `PORT` (default `4000`). `GET /health` no requiere
autenticación.

## Variables de entorno

Ver `.env.example`. Ninguna tiene valores reales; genera tus propios secretos
con `openssl rand -hex 32`.

## Base de datos de test

Los tests corren contra una base de datos PostgreSQL separada
(`inventario_app_test_db` por defecto, ver `.env.test`) para no afectar los
datos de desarrollo. Si no existe, créala una vez (como un rol con permiso de
`CREATEDB`, o como superusuario):

```bash
psql -h localhost -U <rol_admin> -d postgres -c \
  "CREATE DATABASE inventario_app_test_db OWNER inventario_app_user;"

DATABASE_URL="postgresql://inventario_app_user:<password>@localhost:5432/inventario_app_test_db" \
  npx prisma migrate deploy
```

Cada test limpia las tablas relevantes antes de ejecutarse
(`tests/helpers/db.ts`), así que los tests son independientes entre sí y se
ejecutan en un solo proceso (`vitest.config.ts` usa `pool: "forks"` con
`singleFork: true`) para evitar condiciones de carrera sobre la misma base de
datos.

```bash
npm test          # corre todos los tests una vez
npm run test:watch
```

## Scripts

| Script                | Descripción                                        |
|------------------------|-----------------------------------------------------|
| `npm run dev`          | Servidor en modo desarrollo con recarga automática  |
| `npm run build`        | Compila TypeScript a `dist/`                        |
| `npm start`            | Corre el build compilado                             |
| `npm run typecheck`    | `tsc --noEmit`                                      |
| `npm run seed`         | Corre `prisma/seed.ts`                              |
| `npm test`             | Corre los tests con Vitest + Supertest              |
| `npx prisma studio`    | Explorador visual de la base de datos               |

## Notas de diseño / desviaciones menores del contrato

- El campo `Invoice.number` usa `@default(autoincrement())` sobre un `Int` no
  clave primaria; es válido en Prisma + PostgreSQL (genera una secuencia
  dedicada) y se mantuvo tal como está en `03-architecture.md`.
- La cookie `refreshToken` se marca `secure` solo cuando `NODE_ENV=production`,
  para poder probarla en `http://localhost` en desarrollo (los navegadores
  bloquean cookies `Secure` sobre HTTP en dominios que no sean `localhost`
  especial-caseados).
- El rate limiter de `/auth/login` (5 intentos / 15 min) se desactiva cuando
  `NODE_ENV=test` para no interferir con los tests de integración, que inician
  sesión múltiples veces por diseño.
- El `type` de movimiento de stock `AJUSTE` se trata igual que `ENTRADA`
  (incrementa stock); `SALIDA` decrementa y valida stock disponible
  (409 `INSUFFICIENT_STOCK`). El contrato no detalla la semántica exacta de
  `AJUSTE`, así que se optó por la convención más simple y explícita.
- Los montos (`price`, `subtotal`, `tax`, `total`, etc.) se serializan siempre
  como string con 2 decimales (`"150.00"`), y `passwordHash`/`tokenHash` se
  eliminan recursivamente de toda respuesta JSON (ver `src/utils/serialize.ts`).
