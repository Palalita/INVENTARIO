# INVENTARIO — Sistema de Inventario y Facturación

Aplicación full-stack para gestión de inventario y facturación.

- **Frontend**: Next.js + TypeScript + Tailwind + shadcn/ui (`/frontend`)
- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL (`/backend`)
- **Docs**: ver `/docs` (idea, PRD, arquitectura, contrato de API)

## Desarrollo local

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up -d db
cd backend && npm install && npx prisma migrate dev && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

Backend: http://localhost:4000 · Frontend: http://localhost:3000

## Flujo de desarrollo seguido
1. `docs/01-idea.md` — idea refine
2. `docs/02-prd.md` + `docs/03-architecture.md` + `docs/api-contract.md` — spec/PRD
3. `backend/`, `frontend/` — implementación
4. `backend/tests`, `frontend/tests` — test & debug
5. QA gate — ver `docs/04-qa-gate.md`
6. Go-live — ver `docs/05-go-live.md`
