import bcrypt from "bcrypt";
import request from "supertest";
import { Role } from "@prisma/client";
import { prisma } from "../../src/config/prisma";
import { app } from "./app";

export const DEFAULT_PASSWORD = "Password123!";

export async function createUser(overrides: Partial<{ name: string; email: string; role: Role; password: string }> = {}) {
  const passwordHash = await bcrypt.hash(overrides.password ?? DEFAULT_PASSWORD, 12);
  return prisma.user.create({
    data: {
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
      passwordHash,
      role: overrides.role ?? Role.VENDEDOR
    }
  });
}

export async function createAdmin(overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  return createUser({ ...overrides, role: Role.ADMIN });
}

export async function loginAs(email: string, password: string = DEFAULT_PASSWORD) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  return res;
}

export async function createCategory(name = `Categoría ${Date.now()}`) {
  return prisma.category.create({ data: { name } });
}

export async function createProduct(
  overrides: Partial<{
    sku: string;
    name: string;
    price: number;
    cost: number;
    stock: number;
    minStock: number;
    categoryId: string | null;
  }> = {}
) {
  return prisma.product.create({
    data: {
      sku: overrides.sku ?? `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: overrides.name ?? "Producto de prueba",
      price: overrides.price ?? 10,
      cost: overrides.cost ?? 5,
      stock: overrides.stock ?? 10,
      minStock: overrides.minStock ?? 2,
      categoryId: overrides.categoryId ?? undefined
    }
  });
}

export async function createClient(overrides: Partial<{ name: string; documentId: string }> = {}) {
  return prisma.client.create({
    data: {
      name: overrides.name ?? "Cliente de prueba",
      documentId: overrides.documentId ?? `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    }
  });
}
