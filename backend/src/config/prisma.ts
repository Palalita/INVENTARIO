// Instancia única (singleton) del cliente de Prisma, compartida por todos
// los módulos (`import { prisma } from "../../config/prisma"`). Crear un
// PrismaClient nuevo por request agotaría el pool de conexiones a Postgres;
// por eso se crea una sola vez aquí y se reutiliza en toda la app.
import { PrismaClient } from "@prisma/client";
import { isProduction } from "./env";

export const prisma = new PrismaClient({
  log: isProduction ? ["error", "warn"] : ["error", "warn"]
});
