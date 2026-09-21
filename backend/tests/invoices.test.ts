import { beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Role, MovementType } from "@prisma/client";
import { app } from "./helpers/app";
import { resetDb, disconnectDb } from "./helpers/db";
import { prisma } from "../src/config/prisma";
import { createAdmin, createUser, createProduct, createClient, loginAs } from "./helpers/factories";

describe("Invoices", () => {
  let adminToken: string;
  let adminId: string;
  let vendedorToken: string;

  beforeEach(async () => {
    await resetDb();
    const admin = await createAdmin({ email: "admin@test.local" });
    const vendedor = await createUser({ email: "vendedor@test.local", role: Role.VENDEDOR });
    adminId = admin.id;
    adminToken = (await loginAs(admin.email)).body.accessToken;
    vendedorToken = (await loginAs(vendedor.email)).body.accessToken;
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it("crea una factura, descuenta el stock y calcula subtotal/impuesto/total correctamente", async () => {
    const product = await createProduct({ price: 10, stock: 20, minStock: 2 });
    const client = await createClient();

    const res = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ clientId: client.id, items: [{ productId: product.id, quantity: 3 }] });

    expect(res.status).toBe(201);
    expect(res.body.invoice.status).toBe("EMITIDA");
    expect(res.body.invoice.subtotal).toBe("30.00");
    expect(res.body.invoice.tax).toBe("3.60"); // 12% default
    expect(res.body.invoice.total).toBe("33.60");

    const updatedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updatedProduct.stock).toBe(17);

    const movement = await prisma.stockMovement.findFirst({
      where: { productId: product.id, type: MovementType.SALIDA }
    });
    expect(movement).not.toBeNull();
    expect(movement?.quantity).toBe(3);
  });

  it("devuelve 409 INSUFFICIENT_STOCK y no modifica el stock si no hay suficiente", async () => {
    const product = await createProduct({ price: 10, stock: 5, minStock: 1 });
    const client = await createClient();

    const res = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ clientId: client.id, items: [{ productId: product.id, quantity: 100 }] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.error.details).toEqual([
      { productId: product.id, available: 5, requested: 100 }
    ]);

    const unchangedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(unchangedProduct.stock).toBe(5);

    const invoiceCount = await prisma.invoice.count();
    expect(invoiceCount).toBe(0);

    const movementCount = await prisma.stockMovement.count();
    expect(movementCount).toBe(0);
  });

  it("anular una factura repone el stock y marca status ANULADA", async () => {
    const product = await createProduct({ price: 10, stock: 20, minStock: 2 });
    const client = await createClient();

    const createRes = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ clientId: client.id, items: [{ productId: product.id, quantity: 4 }] });

    expect(createRes.status).toBe(201);
    const invoiceId = createRes.body.invoice.id;

    const afterCreate = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(afterCreate.stock).toBe(16);

    const cancelRes = await request(app)
      .patch(`/api/v1/invoices/${invoiceId}/cancel`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.invoice.status).toBe("ANULADA");

    // Rastro de auditoría: la factura la creó el vendedor, pero la anuló el
    // admin — cancelledByUserId debe reflejar a quien anuló, no a quien
    // emitió originalmente.
    expect(cancelRes.body.invoice.cancelledByUserId).toBe(adminId);
    expect(cancelRes.body.invoice.cancelledAt).not.toBeNull();
    expect(cancelRes.body.invoice.cancelledBy?.id).toBe(adminId);

    const afterCancel = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(afterCancel.stock).toBe(20);

    const entradaMovement = await prisma.stockMovement.findFirst({
      where: { productId: product.id, type: MovementType.ENTRADA }
    });
    expect(entradaMovement).not.toBeNull();
    expect(entradaMovement?.quantity).toBe(4);
    // El movimiento de reversa queda a nombre de quien anuló (admin), no de
    // quien emitió la factura originalmente (vendedor).
    expect(entradaMovement?.userId).toBe(adminId);
  });

  it("un vendedor no puede anular una factura (403)", async () => {
    const product = await createProduct({ price: 10, stock: 20, minStock: 2 });
    const client = await createClient();

    const createRes = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ clientId: client.id, items: [{ productId: product.id, quantity: 1 }] });

    const invoiceId = createRes.body.invoice.id;

    const cancelRes = await request(app)
      .patch(`/api/v1/invoices/${invoiceId}/cancel`)
      .set("Authorization", `Bearer ${vendedorToken}`);

    expect(cancelRes.status).toBe(403);
  });

  it("un vendedor no puede ver ni descargar el PDF de la factura de otro vendedor", async () => {
    const otherVendedor = await createUser({ email: "otro-vendedor@test.local", role: Role.VENDEDOR });
    const otherVendedorToken = (await loginAs(otherVendedor.email)).body.accessToken;

    const product = await createProduct({ price: 10, stock: 20, minStock: 2 });
    const client = await createClient();

    const createRes = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ clientId: client.id, items: [{ productId: product.id, quantity: 1 }] });
    const invoiceId = createRes.body.invoice.id;

    const getRes = await request(app)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${otherVendedorToken}`);
    expect(getRes.status).toBe(404);

    const pdfRes = await request(app)
      .get(`/api/v1/invoices/${invoiceId}/pdf`)
      .set("Authorization", `Bearer ${otherVendedorToken}`);
    expect(pdfRes.status).toBe(404);

    // El dueño de la factura y un admin sí pueden verla.
    const ownerRes = await request(app)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${vendedorToken}`);
    expect(ownerRes.status).toBe(200);

    const adminRes = await request(app)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
  });

  it("genera el PDF de una factura con muchas líneas sin cortarse (paginación)", async () => {
    const client = await createClient();
    const products = await Promise.all(
      Array.from({ length: 40 }, (_, i) => createProduct({ sku: `PAG-${i}`, price: 10, stock: 5, minStock: 1 }))
    );

    const createRes = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({
        clientId: client.id,
        items: products.map((p) => ({ productId: p.id, quantity: 1 }))
      });
    expect(createRes.status).toBe(201);

    const pdfRes = await request(app)
      .get(`/api/v1/invoices/${createRes.body.invoice.id}/pdf`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(pdfRes.status).toBe(200);
    const body: Buffer = Buffer.isBuffer(pdfRes.body) ? pdfRes.body : Buffer.from(pdfRes.text ?? "", "binary");
    // Un PDF con salto de página real tiene más de un objeto /Page — no
    // prueba el layout exacto, pero sí que pdfkit efectivamente agregó
    // páginas en vez de dibujar 40 filas fuera de una sola.
    const pageMatches = body.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pageMatches.length).toBeGreaterThan(1);
  });

  it("rechaza un formato de fecha inválido en el listado con 400 (no un 500)", async () => {
    const res = await request(app)
      .get("/api/v1/invoices?from=not-a-date")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("filtra por from/to incluyendo el día completo en hora de Guatemala", async () => {
    const product = await createProduct({ price: 10, stock: 20, minStock: 2 });
    const client = await createClient();

    const createRes = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ clientId: client.id, items: [{ productId: product.id, quantity: 1 }] });

    // Factura hecha "ahora" (hora real del test) — se pide el listado
    // filtrado por el día de hoy en el calendario UTC. Si el filtro
    // estuviera mal (cortando a medianoche UTC en vez de medianoche
    // Guatemala), una factura creada en la noche (hora GT) podría no
    // aparecer al pedir "hoy" según el calendario UTC del servidor.
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/invoices?from=${today}&to=${today}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((inv: { id: string }) => inv.id === createRes.body.invoice.id)).toBe(true);
  });

  it("genera el PDF de una factura", async () => {
    const product = await createProduct({ price: 10, stock: 20, minStock: 2 });
    const client = await createClient();

    const createRes = await request(app)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ clientId: client.id, items: [{ productId: product.id, quantity: 1 }] });

    const invoiceId = createRes.body.invoice.id;

    const pdfRes = await request(app)
      .get(`/api/v1/invoices/${invoiceId}/pdf`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers["content-type"]).toBe("application/pdf");
    const bodyLength = Buffer.isBuffer(pdfRes.body) ? pdfRes.body.length : (pdfRes.text ?? "").length;
    expect(bodyLength).toBeGreaterThan(0);
  });
});
