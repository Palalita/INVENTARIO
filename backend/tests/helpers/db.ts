import { prisma } from "../../src/config/prisma";
import { env, isTest } from "../../src/config/env";

/**
 * Limpia todas las tablas de la base de datos de test entre tests, respetando
 * el orden de dependencias FK, y reinicia la secuencia de numeración de
 * facturas para que los tests sean deterministas.
 *
 * Guarda de seguridad: si por un error de carga de entorno NODE_ENV/.env.test
 * no tomaron efecto y esto terminara apuntando a la base de desarrollo, esta
 * función debe abortar en vez de borrar datos reales. No confiar únicamente en
 * NODE_ENV: además exige que el nombre de la base de datos contenga "test".
 */
export async function resetDb() {
  if (!isTest || !env.DATABASE_URL.includes("test")) {
    throw new Error(
      `resetDb() se negó a correr: NODE_ENV="${env.NODE_ENV}" y DATABASE_URL="${env.DATABASE_URL}" ` +
        `no parecen apuntar a una base de datos de test. Esto es para evitar borrar datos reales.`
    );
  }

  await prisma.invoiceItem.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.product.deleteMany();
  await prisma.client.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Invoice_number_seq" RESTART WITH 1`);
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
