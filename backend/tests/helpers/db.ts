import { prisma } from "../../src/config/prisma";

/**
 * Limpia todas las tablas de la base de datos de test entre tests, respetando
 * el orden de dependencias FK, y reinicia la secuencia de numeración de
 * facturas para que los tests sean deterministas.
 */
export async function resetDb() {
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
