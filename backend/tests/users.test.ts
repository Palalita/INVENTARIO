import { beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "./helpers/app";
import { resetDb, disconnectDb } from "./helpers/db";
import { createAdmin, createUser, loginAs } from "./helpers/factories";

describe("Users (admin)", () => {
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

  it("admin puede crear un usuario vendedor", async () => {
    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Nuevo Vendedor", email: "nuevo@test.local", password: "Password123!", role: "VENDEDOR" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("nuevo@test.local");
    expect(res.body.user.role).toBe("VENDEDOR");
    expect(res.body.user.active).toBe(true);
    // La contraseña nunca debe viajar de vuelta en la respuesta.
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it("un vendedor no puede crear usuarios (403)", async () => {
    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${vendedorToken}`)
      .send({ name: "Intento", email: "intento@test.local", password: "Password123!", role: "VENDEDOR" });

    expect(res.status).toBe(403);
  });

  it("un vendedor no puede listar usuarios (403)", async () => {
    const res = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${vendedorToken}`);
    expect(res.status).toBe(403);
  });

  it("no permite crear dos usuarios con el mismo correo", async () => {
    await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Uno", email: "dup@test.local", password: "Password123!", role: "VENDEDOR" });

    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Dos", email: "dup@test.local", password: "Password123!", role: "VENDEDOR" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
  });

  it("admin puede listar usuarios con paginación", async () => {
    const res = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body).toHaveProperty("page");
    expect(res.body).toHaveProperty("total");
  });

  it("admin puede desactivar un usuario y ese usuario deja de poder iniciar sesión", async () => {
    const created = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "A desactivar", email: "desactivar@test.local", password: "Password123!", role: "VENDEDOR" });

    const patchRes = await request(app)
      .patch(`/api/v1/users/${created.body.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.user.active).toBe(false);

    const loginRes = await loginAs("desactivar@test.local", "Password123!");
    expect(loginRes.status).toBe(401);
  });

  it("admin puede cambiar el rol de un usuario", async () => {
    const created = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Futuro admin", email: "futuroadmin@test.local", password: "Password123!", role: "VENDEDOR" });

    const patchRes = await request(app)
      .patch(`/api/v1/users/${created.body.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "ADMIN" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.user.role).toBe("ADMIN");
  });

  it("no permite desactivar al único admin activo", async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${adminId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_ADMIN");
  });

  it("no permite quitarle el rol de administrador al único admin activo", async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${adminId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "VENDEDOR" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_ADMIN");
  });

  it("sí permite desactivar a un admin si hay otro admin activo", async () => {
    const secondAdmin = await createAdmin({ email: "segundo-admin@test.local" });

    const res = await request(app)
      .patch(`/api/v1/users/${adminId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.user.active).toBe(false);
    expect(secondAdmin.role).toBe("ADMIN");
  });
});
