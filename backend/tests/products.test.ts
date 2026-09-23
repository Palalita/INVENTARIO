import { beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb, disconnectDb } from "./helpers/db";
import { createAdmin, createUser, loginAs } from "./helpers/factories";
import { Role } from "@prisma/client";
import { prisma } from "../src/config/prisma";

describe("Products CRUD", () => {
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

  it("admin puede crear un producto", async () => {
    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sku: "SKU-A1", name: "Producto A", price: 19.99, cost: 10, stock: 5, minStock: 1 });

    expect(res.status).toBe(201);
    expect(res.body.product.sku).toBe("SKU-A1");
    expect(res.body.product.price).toBe("19.99");
    expect(res.body.product.stock).toBe(5);
  });

  it("vendedor no puede crear un producto (403)", async () => {
    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ sku: "SKU-B1", name: "Producto B", price: 5, cost: 2, stock: 1, minStock: 1 });

    expect(res.status).toBe(403);
  });

  it("lista productos con paginación", async () => {
    await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sku: "SKU-C1", name: "Producto C", price: 1, cost: 0.5, stock: 1, minStock: 0 });

    const res = await request(app).get("/api/v1/products").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("page");
    expect(res.body).toHaveProperty("pageSize");
    expect(res.body).toHaveProperty("total");
  });

  it("rechaza un pageSize excesivo (protege contra pedir resultados masivos)", async () => {
    const res = await request(app)
      .get("/api/v1/products?pageSize=100000")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("obtiene, actualiza y elimina (soft delete) un producto", async () => {
    const createRes = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sku: "SKU-D1", name: "Producto D", price: 3, cost: 1, stock: 4, minStock: 1 });

    const productId = createRes.body.product.id;

    const getRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.product.id).toBe(productId);

    const patchRes = await request(app)
      .patch(`/api/v1/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Producto D editado" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.product.name).toBe("Producto D editado");

    const deleteRes = await request(app)
      .delete(`/api/v1/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(afterDeleteRes.status).toBe(200);
    expect(afterDeleteRes.body.product.active).toBe(false);
  });

  it("PATCH /products/:id ignora `stock` aunque venga en el body (solo stock-movements puede cambiarlo)", async () => {
    const createRes = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sku: "SKU-NOSTOCK", name: "Producto sin stock directo", price: 3, cost: 1, stock: 10, minStock: 1 });
    const productId = createRes.body.product.id;

    const patchRes = await request(app)
      .patch(`/api/v1/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Renombrado", stock: 999 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.product.name).toBe("Renombrado");
    // El stock debe seguir en 10 (el valor de creación), no 999: `stock` no
    // es un campo válido de updateProductSchema, así que Zod lo descarta
    // silenciosamente en vez de aplicarlo.
    expect(patchRes.body.product.stock).toBe(10);

    const movementCount = await prisma.stockMovement.count({ where: { productId } });
    expect(movementCount).toBe(0);
  });

  it("no permite SKU duplicado", async () => {
    await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sku: "SKU-DUP", name: "Producto E", price: 1, cost: 1, stock: 1, minStock: 1 });

    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sku: "SKU-DUP", name: "Producto E2", price: 1, cost: 1, stock: 1, minStock: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_SKU");
  });

  it("rechaza un precio fuera del rango de Decimal(12,2) con 400 (no un 500)", async () => {
    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sku: "SKU-OVERFLOW", name: "Producto F", price: 99999999999, cost: 1, stock: 1, minStock: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("responde con Cache-Control: no-store en la API", async () => {
    const res = await request(app).get("/api/v1/products").set("Authorization", `Bearer ${adminToken}`);

    expect(res.headers["cache-control"]).toBe("no-store");
  });

  describe("Imagen de producto", () => {
    // Firma real de un PNG (8 bytes) seguida de datos cualquiera: suficiente
    // para pasar la validación de contenido sin ser un PNG decodificable de
    // verdad, que es todo lo que el backend revisa.
    const VALID_PNG_BYTES = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0, 0, 0, 0])
    ]);

    async function createProduct(sku: string) {
      const res = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ sku, name: `Producto ${sku}`, price: 1, cost: 1, stock: 1, minStock: 1 });
      return res.body.product.id as string;
    }

    it("vendedor no puede subir una imagen (403)", async () => {
      const productId = await createProduct("SKU-IMG1");

      const res = await request(app)
        .post(`/api/v1/products/${productId}/image`)
        .set("Authorization", `Bearer ${vendedorToken}`)
        .attach("image", VALID_PNG_BYTES, { filename: "foto.png", contentType: "image/png" });

      expect(res.status).toBe(403);
    });

    it("rechaza un tipo de archivo no permitido", async () => {
      const productId = await createProduct("SKU-IMG2");

      const res = await request(app)
        .post(`/api/v1/products/${productId}/image`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("image", Buffer.from("no es una imagen"), {
          filename: "archivo.txt",
          contentType: "text/plain"
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_FILE_TYPE");
    });

    it("rechaza un archivo cuyo contenido real no coincide con el tipo declarado", async () => {
      // Content-Type dice image/png, pero los bytes no son los de un PNG real
      // (Content-Type de un multipart lo controla quien sube el archivo, así
      // que no basta con confiar en lo que declara).
      const productId = await createProduct("SKU-IMG5");

      const res = await request(app)
        .post(`/api/v1/products/${productId}/image`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("image", Buffer.from("<html><body>no soy una imagen</body></html>"), {
          filename: "falso.png",
          contentType: "image/png"
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_FILE_CONTENT");
    });

    it("responde con un error claro si el almacenamiento de imágenes no está configurado", async () => {
      // El entorno de test no trae credenciales reales de R2 a propósito.
      const productId = await createProduct("SKU-IMG3");

      const res = await request(app)
        .post(`/api/v1/products/${productId}/image`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("image", VALID_PNG_BYTES, { filename: "foto.png", contentType: "image/png" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("IMAGE_STORAGE_NOT_CONFIGURED");
    });

    it("eliminar la imagen de un producto que no tiene una no falla", async () => {
      const productId = await createProduct("SKU-IMG4");

      const res = await request(app)
        .delete(`/api/v1/products/${productId}/image`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.product.imageUrl).toBeNull();
    });
  });
});
