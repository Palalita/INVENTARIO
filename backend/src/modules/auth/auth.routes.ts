import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import { loginRateLimiter } from "../../middlewares/rateLimit";
import { loginSchema } from "./auth.schemas";
import * as authController from "./auth.controller";

// Rutas montadas en /api/v1/auth (ver app.ts). Ninguna requiere requireAuth
// salvo /me, ya que login/refresh/logout son justamente cómo se obtiene o se
// cierra una sesión.
const router = Router();

// login: limitado por loginRateLimiter (protección contra fuerza bruta) y
// valida el body contra loginSchema antes de llegar al controlador.
router.post("/login", loginRateLimiter, validate({ body: loginSchema }), authController.login);
// refresh/logout no necesitan requireAuth: se identifican por la cookie de
// refresh token, no por un access token en el header.
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
// me: sí requiere estar autenticado (access token válido en el header).
router.get("/me", requireAuth, authController.me);

export default router;
