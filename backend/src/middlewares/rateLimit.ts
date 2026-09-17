import rateLimit from "express-rate-limit";
import { isTest } from "../config/env";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Desactivado en tests: los tests de integración inician sesión repetidas
  // veces por diseño y no deben verse afectados por el límite productivo.
  skip: () => isTest,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Demasiados intentos de inicio de sesión. Intente de nuevo más tarde." } },
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Demasiados intentos de inicio de sesión. Intente de nuevo más tarde."
      }
    });
  }
});
