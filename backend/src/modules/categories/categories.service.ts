// CRUD de categorías de producto. Es el módulo más simple del backend — sin
// paginación (se asume que hay pocas categorías) ni soft delete.
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { CreateCategoryInput, UpdateCategoryInput } from "./categories.schemas";

// Todas las categorías, ordenadas alfabéticamente — pensado para llenar un
// <select> en el frontend, no para una tabla paginada.
export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

// Crea una categoría, rechazando nombres duplicados con un mensaje claro
// (el nombre es único a nivel de esquema, ver schema.prisma).
export async function createCategory(input: CreateCategoryInput) {
  const existing = await prisma.category.findUnique({ where: { name: input.name } });
  if (existing) {
    throw AppError.conflict("Ya existe una categoría con ese nombre", "DUPLICATE_CATEGORY");
  }
  return prisma.category.create({ data: input });
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Categoría no encontrada");
  }
  return prisma.category.update({ where: { id }, data: input });
}

// Borrado físico (no soft delete, a diferencia de Product). Es seguro
// porque `Product.categoryId` es una relación opcional (FK nullable) en el
// esquema: Prisma aplica SetNull por defecto en relaciones opcionales, así
// que los productos que usaban esta categoría quedan "sin categoría" en vez
// de bloquear el borrado o romperse.
export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Categoría no encontrada");
  }
  await prisma.category.delete({ where: { id } });
}
