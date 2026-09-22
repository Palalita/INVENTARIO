import { beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb, disconnectDb } from "./helpers/db";
import { prisma } from "../src/config/prisma";
import { createAdmin, createUser, createProduct, loginAs } from "./helpers/factories";
import { Role } from "@prisma/client";

describe("Categories", () => {
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

  it("vendedor no puede crear una categoría (403), pero sí puede listarlas", async () => {
    const createRes = await request(app)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ name: "Bebidas" });
    expect(createRes.status).toBe(403);

    const listRes = await request(app).get("/api/v1/categories").set("Authorization", `Bearer ${vendedorToken}`);
    expect(listRes.status).toBe(200);
  });

  it("no permite crear una categoría con un nombre duplicado", async () => {
    await request(app)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Bebidas" });

    const dupRes = await request(app)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Bebidas" });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe("DUPLICATE_CATEGORY");
  });

  it("actualizar una categoría inexistente responde 404", async () => {
    const res = await request(app)
      .patch("/api/v1/categories/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Nueva" });

    expect(res.status).toBe(404);
  });

  it("borrar una categoría deja sus productos sin categoría (SetNull) en vez de fallar o arrastrarlos", async () => {
    const catRes = await request(app)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Temporal" });
    const categoryId = catRes.body.category.id;

    const product = await createProduct({ categoryId });

    const deleteRes = await request(app)
      .delete(`/api/v1/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);

    const productAfter = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(productAfter.categoryId).toBeNull();
  });
});
