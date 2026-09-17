import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { CreateCategoryInput, UpdateCategoryInput } from "./categories.schemas";

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

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

export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Categoría no encontrada");
  }
  await prisma.category.delete({ where: { id } });
}
