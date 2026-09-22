import { beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "./helpers/app";
import { resetDb, disconnectDb } from "./helpers/db";
import { prisma } from "../src/config/prisma";
import { createAdmin, createUser, createProduct, loginAs } from "./helpers/factories";

describe("Stock movements", () => {
  let adminToken: string;
  let vendedorToken: string;

  beforeEach(async () => {
    await resetDb();
    const admin = await createAdmin({ email: "admin@test.local" });
    const vendedor = await createUser({ email: "vendedor@test.local", role: Role.VENDEDOR });
    adminToken = (await loginAs(admin.email)).body.accessToken;
    vendedorToken = (await loginAs(vendedor.email)).body.accessToken;
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it("un vendedor no puede registrar un AJUSTE de inventario (403)", async () => {
    const product = await createProduct({ stock: 10 });

    const res = await request(app)
      .post(`/api/v1/products/${product.id}/movements`)
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ type: "AJUSTE", quantity: 500, reason: "conteo" });

    expect(res.status).toBe(403);

    const unchanged = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(unchanged.stock).toBe(10);
  });

  it("un admin sí puede registrar un AJUSTE de inventario", async () => {
    const product = await createProduct({ stock: 10 });

    const res = await request(app)
      .post(`/api/v1/products/${product.id}/movements`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ type: "AJUSTE", quantity: 5, reason: "conteo" });

    expect(res.status).toBe(201);

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.stock).toBe(15);
  });

  it("un vendedor sí puede registrar ENTRADA/SALIDA manuales", async () => {
    const product = await createProduct({ stock: 10 });

    const entrada = await request(app)
      .post(`/api/v1/products/${product.id}/movements`)
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ type: "ENTRADA", quantity: 3, reason: "recepción" });
    expect(entrada.status).toBe(201);

    const salida = await request(app)
      .post(`/api/v1/products/${product.id}/movements`)
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ type: "SALIDA", quantity: 2, reason: "merma" });
    expect(salida.status).toBe(201);

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.stock).toBe(11); // 10 + 3 - 2
  });

  it("una SALIDA mayor al stock disponible devuelve 409 y no modifica el stock", async () => {
    const product = await createProduct({ stock: 5 });

    const res = await request(app)
      .post(`/api/v1/products/${product.id}/movements`)
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ type: "SALIDA", quantity: 100, reason: "merma" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");

    const unchanged = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(unchanged.stock).toBe(5);
  });

  it("rechaza una cantidad absurdamente grande con 400 (no un overflow contra la base)", async () => {
    const product = await createProduct({ stock: 10 });

    const res = await request(app)
      .post(`/api/v1/products/${product.id}/movements`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ type: "ENTRADA", quantity: 999999999, reason: "conteo" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
