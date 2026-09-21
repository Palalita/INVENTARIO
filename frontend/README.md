# Inventario — Frontend

Interfaz web del sistema de inventario y facturación. Next.js 16 (App Router)
+ TypeScript + Tailwind CSS + shadcn/ui, consumiendo la API REST de `../backend`.
Ver `/docs/02-prd.md` y `/docs/03-architecture.md` en la raíz del repo para la
especificación completa, y `/docs/06-manual-tecnico.md` para una explicación
a fondo del código.

## Requisitos

- Node.js 20+
- El backend (`../backend`) corriendo y accesible (local o desplegado)

## Setup

```bash
cd frontend
npm install
cp .env.example .env   # NEXT_PUBLIC_API_URL apuntando al backend

npm run dev            # http://localhost:3000
```

## Autenticación

La sesión vive en dos partes: un access token (JWT, 15 min) en memoria
(Zustand, `lib/stores/auth-store.ts`) y un refresh token en una cookie
`httpOnly` que pone el backend. `components/auth/auth-guard.tsx` protege las
rutas del panel (`app/(dashboard)/`) y `components/auth/require-admin.tsx`
protege las exclusivas de ADMIN (ej. Usuarios). Ambas redirigen del lado del
cliente porque la cookie de sesión vive en el dominio del backend, no en el
del frontend — Next.js en el servidor no puede leerla.

## Estructura

```
app/            Rutas (App Router): (auth)/login, (dashboard)/{dashboard,productos,clientes,facturas,usuarios}
components/     Componentes por dominio (products/, clients/, users/, invoices/, dashboard/, auth/)
                + common/ (genéricos), layout/ (shell de la app), ui/ (shadcn/ui)
lib/            api.ts (cliente HTTP), hooks/ (TanStack Query por recurso),
                schemas/ (validación Zod de formularios), stores/ (Zustand),
                invoice-calculations.ts (subtotal/impuesto/total), types.ts
```

## Scripts

| Script           | Descripción                                  |
|-------------------|-----------------------------------------------|
| `npm run dev`     | Servidor de desarrollo (Turbopack)             |
| `npm run build`   | Build de producción                            |
| `npm start`       | Corre el build compilado                       |
| `npm run lint`    | ESLint (incluye reglas de React Compiler)      |
| `npm test`        | Corre los tests con Vitest                     |

## Despliegue

Desplegado en Vercel con el **Root Directory** del proyecto apuntando a
`frontend/` (necesario para que los despliegues automáticos por push a
GitHub funcionen — un deploy manual de `vercel --prod` corrido dentro de
`frontend/` funciona igual sin esa configuración, pero el deploy automático
sí la necesita porque clona el repo completo).
