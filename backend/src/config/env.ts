// Carga y valida las variables de entorno una sola vez al arrancar el
// proceso. Cualquier otro archivo del backend que necesite una env var la
// importa desde aquí (`import { env } from "./config/env"`) en vez de leer
// `process.env` directamente, así el tipo y la validación quedan centralizados.
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

// Forma esperada de las variables de entorno, con valores por defecto para
// desarrollo local. Si falta una requerida (sin default), el proceso no
// arranca — mejor fallar rápido al inicio que a medias en producción.
const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerido"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  // min(32): estos dos secretos son la raíz de confianza de toda sesión de
  // la app (firman los JWT de acceso y derivan el hash de los refresh
  // tokens) — un valor corto o trivial los haría forzables por fuerza bruta.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET debe tener al menos 32 caracteres"),
  REFRESH_TOKEN_SECRET: z.string().min(32, "REFRESH_TOKEN_SECRET debe tener al menos 32 caracteres"),
  ADMIN_SEED_PASSWORD: z.string().default("Admin123!"),
  TAX_RATE: z.coerce.number().nonnegative().default(0.12),
  // Imágenes de producto (Cloudflare R2, API S3-compatible). Opcionales: si
  // faltan, el endpoint de subida responde un error claro en vez de romper el
  // arranque de la app para quien todavía no las configuró.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional()
});

// Un mismo valor copiado en ambas variables dejaría un refresh token
// robado (o su hash filtrado) utilizable también para forjar access tokens,
// así que se rechaza aunque cada una individualmente cumpla el min(32).
const envSchemaWithChecks = envSchema.refine(
  (data) => data.JWT_ACCESS_SECRET !== data.REFRESH_TOKEN_SECRET,
  { message: "JWT_ACCESS_SECRET y REFRESH_TOKEN_SECRET no pueden ser iguales", path: ["REFRESH_TOKEN_SECRET"] }
);

const parsed = envSchemaWithChecks.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Variables de entorno inválidas:", parsed.error.flatten().fieldErrors);
  throw new Error("Configuración de entorno inválida");
}

// `env` ya viene tipado y validado; `isProduction`/`isTest` son atajos que
// se usan en todo el proyecto para ramificar comportamiento (ej. cookies
// `secure`, seeds que rechazan contraseñas por defecto, etc.).
export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
