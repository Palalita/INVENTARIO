// Limitadores de tasa de requests (express-rate-limit), montados como
// middleware sobre distintas rutas. apiRateLimiter se aplica globalmente en
// app.ts; loginRateLimiter se aplica solo en auth.routes.ts sobre el
// endpoint de login, más estricto porque es el objetivo típico de un ataque
// de fuerza bruta de contraseñas.
import rateLimit from "express-rate-limit";
import { isTest } from "../config/env";

// Límite general para toda la API: no protege contra un abuso dirigido y
// sofisticado (para eso hace falta un store compartido tipo Redis si el
// backend llega a correr en más de una instancia), pero sí pone un techo
// razonable a un cliente descontrolado o una cuenta comprometida.
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: { code: "TOO_MANY_REQUESTS", message: "Demasiadas solicitudes. Intente de nuevo más tarde." }
  }
});

// Límite específico y mucho más estricto (5 intentos / 15 min) solo para el
// endpoint de login: dificulta adivinar contraseñas por fuerza bruta sin
// afectar el uso normal del resto de la API.
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
