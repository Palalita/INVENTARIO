import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { CreateProductInput, ListProductsQuery, UpdateProductInput } from "./products.schemas";

export async function listProducts(query: ListProductsQuery) {
  const { skip, take, page, pageSize } = getPaginationArgs(query);

  const where: Prisma.ProductWhereInput = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { sku: { contains: query.search, mode: "insensitive" } }
    ];
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.lowStock) {
    // stock <= minStock: no se puede comparar dos columnas directamente con el
    // filtro de Prisma, se resuelve con una raw query de soporte.
    const lowStockIds = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Product" WHERE stock <= "minStock"
    `;
    where.id = { in: lowStockIds.map((p) => p.id) };
  }

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      include: { category: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.product.count({ where })
  ]);

  return buildPaginatedResponse(data, total, page, pageSize);
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: { category: true } });
  if (!product) {
    throw AppError.notFound("Producto no encontrado");
  }
  return product;
}

export async function createProduct(input: CreateProductInput) {
  const existing = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (existing) {
    throw AppError.conflict("Ya existe un producto con ese SKU", "DUPLICATE_SKU");
  }
  return prisma.product.create({
    data: {
      sku: input.sku,
      name: input.name,
      description: input.description,
      categoryId: input.categoryId ?? undefined,
      price: input.price,
      cost: input.cost,
      stock: input.stock,
      minStock: input.minStock
    },
    include: { category: true }
  });
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Producto no encontrado");
  }

  if (input.sku && input.sku !== existing.sku) {
    const skuTaken = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (skuTaken) {
      throw AppError.conflict("Ya existe un producto con ese SKU", "DUPLICATE_SKU");
    }
  }

  return prisma.product.update({
    where: { id },
    data: {
      ...input,
      categoryId: input.categoryId === undefined ? undefined : input.categoryId
    },
    include: { category: true }
  });
}

export async function deleteProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Producto no encontrado");
  }
  await prisma.product.update({ where: { id }, data: { active: false } });
}
