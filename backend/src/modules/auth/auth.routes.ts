import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import { loginRateLimiter, authSessionRateLimiter } from "../../middlewares/rateLimit";
import { loginSchema } from "./auth.schemas";
import * as authController from "./auth.controller";

// Rutas montadas en /api/v1/auth, ANTES del apiRateLimiter genérico (ver
// app.ts) — las tres rutas de abajo necesitan su propio limiter con una
// clave que no dependa de `req.ip` sin más (ver comentarios en
// middlewares/rateLimit.ts). Ninguna requiere requireAuth salvo /me, ya que
// login/refresh/logout son justamente cómo se obtiene o se cierra una
// sesión.
const router = Router();

// login: limitado por loginRateLimiter (protección contra fuerza bruta) y
// valida el body contra loginSchema antes de llegar al controlador.
router.post("/login", loginRateLimiter, validate({ body: loginSchema }), authController.login);
// refresh/logout no necesitan requireAuth (se identifican por la cookie de
// refresh token, no por un access token en el header), pero sí llevan
// authSessionRateLimiter, con clave por sesión en vez de por IP.
router.post("/refresh", authSessionRateLimiter, authController.refresh);
router.post("/logout", authSessionRateLimiter, authController.logout);
// me: sí requiere estar autenticado (access token válido en el header).
router.get("/me", requireAuth, authController.me);

export default router;
