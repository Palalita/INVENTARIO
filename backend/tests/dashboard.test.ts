import { beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb, disconnectDb } from "./helpers/db";
import { prisma } from "../src/config/prisma";
import { createAdmin, createProduct, createClient, loginAs } from "./helpers/factories";

async function createInvoiceAt(adminToken: string, productId: string, clientId: string, createdAt: Date) {
  const res = await request(app)
    .post("/api/v1/invoices")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ clientId, items: [{ productId, quantity: 1 }] });
  await prisma.invoice.update({ where: { id: res.body.invoice.id }, data: { createdAt } });
  return res.body.invoice.id;
}

describe("Dashboard sales report", () => {
  let adminToken: string;

  beforeEach(async () => {
    await resetDb();
    const admin = await createAdmin({ email: "admin@test.local" });
    adminToken = (await loginAs(admin.email)).body.accessToken;
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it("sin from/to, acota a los últimos 90 días en vez de traer toda la historia", async () => {
    const product = await createProduct({ price: 10, stock: 100 });
    const client = await createClient();

    const now = new Date();
    const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // hace 5 días
    const old = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000); // hace 200 días

    await createInvoiceAt(adminToken, product.id, client.id, recent);
    await createInvoiceAt(adminToken, product.id, client.id, old);

    const res = await request(app)
      .get("/api/v1/dashboard/sales-report")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it("con from/to explícitos, respeta el rango pedido (incluye facturas viejas si se piden)", async () => {
    const product = await createProduct({ price: 10, stock: 100 });
    const client = await createClient();

    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    await createInvoiceAt(adminToken, product.id, client.id, old);

    const fromStr = new Date(old.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toStr = new Date().toISOString().slice(0, 10);

    const res = await request(app)
      .get(`/api/v1/dashboard/sales-report?from=${fromStr}&to=${toStr}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it("rechaza un formato de fecha inválido con 400", async () => {
    const res = await request(app)
      .get("/api/v1/dashboard/sales-report?from=not-a-date")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });
});
