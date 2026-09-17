# Go-Live

## Antes de desplegar a producción
1. Generar secretos nuevos y únicos para producción (no reusar los de desarrollo):
   ```bash
   openssl rand -hex 32   # JWT_ACCESS_SECRET
   openssl rand -hex 32   # REFRESH_TOKEN_SECRET
   ```
2. Definir un `ADMIN_SEED_PASSWORD` fuerte y cambiarlo tras el primer login.
3. Confirmar que `NODE_ENV=production` en el backend (activa `secure` en la cookie
   de refresh token, exige HTTPS).
4. Configurar `FRONTEND_URL` en el backend con el dominio real del frontend (CORS).
5. Configurar `NEXT_PUBLIC_API_URL` en el frontend con el dominio real del backend.

## Opción A — Docker (recomendada si el host lo soporta)
Este repo incluye `docker-compose.yml` en la raíz (Postgres + backend + frontend).
En esta máquina de desarrollo no hay Docker instalado, por lo que **no se pudo
probar el compose localmente** — está escrito siguiendo las mismas variables de
entorno ya verificadas funcionando en desarrollo nativo, pero verifícalo antes de
depender de él:
```bash
cp backend/.env.example backend/.env   # completar con secretos de producción
cp frontend/.env.example frontend/.env
docker compose up -d --build
```
Faltan `backend/Dockerfile` y `frontend/Dockerfile` (no se crearon en esta ronda);
son el siguiente paso si se elige esta opción. Next.js ya soporta `output:
"standalone"` y Express corre bien en una imagen `node:20-alpine` estándar.

## Opción B — Vercel (frontend) + Railway/Render/Fly.io (backend + Postgres)
1. **Base de datos**: crear un Postgres administrado (Railway, Render, Supabase,
   Neon). Copiar su `DATABASE_URL`.
2. **Backend**: desplegar `/backend` en Railway/Render como servicio Node.
   - Build: `npm install && npx prisma generate`
   - Start: `npx prisma migrate deploy && npm start`
   - Variables de entorno: `DATABASE_URL`, `JWT_ACCESS_SECRET`,
     `REFRESH_TOKEN_SECRET`, `FRONTEND_URL`, `PORT`, `NODE_ENV=production`,
     `ADMIN_SEED_PASSWORD`.
   - Ejecutar una vez `npm run seed` (o vía consola del proveedor) para crear el
     admin inicial.
3. **Frontend**: desplegar `/frontend` en Vercel.
   - Variable de entorno: `NEXT_PUBLIC_API_URL=https://<dominio-backend>/api/v1`.
4. Verificar `GET https://<dominio-backend>/health` responde `{status:"ok"}`.
5. Login con el admin del seed y cambiar la contraseña.

## Desarrollo local (sin Docker) — lo que se usó para las pruebas de esta ronda
```bash
# Postgres local (Homebrew) ya corriendo; DB y usuario dedicados creados:
#   DB:   inventario_app_db
#   User: inventario_app_user

cd backend
npm install
npx prisma migrate dev
npm run seed
npm run dev          # http://localhost:4010 (PORT=4010 en backend/.env,
                      # el 4000 estaba ocupado por otro proyecto en esta máquina)

cd ../frontend
npm install
npm run dev           # http://localhost:3000
```
Usuario de prueba: `admin@inventario.local` / contraseña definida en
`ADMIN_SEED_PASSWORD` (`.env`, default `Admin123!`).

## Post-lanzamiento (backlog inmediato)
Ver `04-qa-gate.md` §"Limitaciones conocidas": UI de usuarios, UI de categorías,
export CSV de reportes. Ninguna requiere cambios de backend, solo pantallas nuevas
en `/frontend/app/(dashboard)`.
