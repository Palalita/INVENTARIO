import { beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers/app";
import { resetDb, disconnectDb } from "./helpers/db";
import { createAdmin, DEFAULT_PASSWORD } from "./helpers/factories";

describe("Auth", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it("login exitoso devuelve user + accessToken y set-cookie refreshToken", async () => {
    const admin = await createAdmin({ email: "admin@test.local" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: admin.email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(admin.email);
    expect(res.body.user.passwordHash).toBeUndefined();

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
    expect(cookieStr).toMatch(/refreshToken=/);
  });

  it("login fallido con password incorrecta devuelve 401 INVALID_CREDENTIALS", async () => {
    const admin = await createAdmin({ email: "admin2@test.local" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: admin.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("login fallido con usuario inexistente devuelve 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "no-existe@test.local", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("GET /auth/me sin token devuelve 401", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("NO_TOKEN");
  });

  it("GET /auth/me con token válido devuelve el usuario autenticado", async () => {
    const admin = await createAdmin({ email: "admin3@test.local" });
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: admin.email, password: DEFAULT_PASSWORD });

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(admin.email);
  });

  it("reusar un refresh token ya rotado revoca TODA la sesión, no solo ese intento", async () => {
    function extractRefreshCookie(res: request.Response): string {
      const setCookie = res.headers["set-cookie"];
      const cookies = Array.isArray(setCookie) ? setCookie : [String(setCookie)];
      const match = cookies.map((c) => c.match(/refreshToken=([^;]+)/)).find(Boolean);
      if (!match) throw new Error("No se encontró la cookie refreshToken en la respuesta");
      return `refreshToken=${match[1]}`;
    }

    const admin = await createAdmin({ email: "admin-reuse@test.local" });
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: admin.email, password: DEFAULT_PASSWORD });
    const cookieA = extractRefreshCookie(loginRes);

    // Rotación normal: A queda revocado, se emite B.
    const refreshRes = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookieA);
    expect(refreshRes.status).toBe(200);
    const cookieB = extractRefreshCookie(refreshRes);

    // Alguien reusa A (robado, o el dueño legítimo con una pestaña vieja).
    // Debe rechazarse...
    const reuseRes = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookieA);
    expect(reuseRes.status).toBe(401);

    // ...y además, ese reuso debe haber matado también a B: la sesión que sí
    // ganó la rotación no debería seguir viva, porque un reuso detectado es
    // señal de que la sesión completa pudo estar comprometida.
    const bRes = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookieB);
    expect(bRes.status).toBe(401);
  });

  it("rutas protegidas rechazan peticiones sin token", async () => {
    const resProducts = await request(app).get("/api/v1/products");
    const resClients = await request(app).get("/api/v1/clients");
    const resInvoices = await request(app).get("/api/v1/invoices");

    expect(resProducts.status).toBe(401);
    expect(resClients.status).toBe(401);
    expect(resInvoices.status).toBe(401);
  });
});
