import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

// Carga .env.test cuando NODE_ENV=test, .env en cualquier otro caso.
// override: true es intencional: Vitest/Vite precargan variables del .env
// raíz (incluyendo DATABASE_URL) en process.env antes de que este módulo se
// ejecute. Sin override, dotenv conserva ese valor ya presente y los tests
// terminan conectados a la base de datos equivocada (ver resetDb() en
// tests/helpers/db.ts, que además valida esto en runtime como red de
// seguridad adicional).
const rawNodeEnv = process.env.NODE_ENV || "development";
const envFile = rawNodeEnv === "test" ? ".env.test" : ".env";
dotenv.config({ path: path.resolve(__dirname, "../../", envFile), override: true });

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerido"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET es requerido"),
  REFRESH_TOKEN_SECRET: z.string().min(1, "REFRESH_TOKEN_SECRET es requerido"),
  ADMIN_SEED_PASSWORD: z.string().default("Admin123!"),
  TAX_RATE: z.coerce.number().nonnegative().default(0.12)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Variables de entorno inválidas:", parsed.error.flatten().fieldErrors);
  throw new Error("Configuración de entorno inválida");
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
