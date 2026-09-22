// Limitadores de tasa de requests (express-rate-limit), montados como
// middleware sobre distintas rutas. apiRateLimiter se aplica en app.ts a
// toda la API EXCEPTO /auth (montada antes, ver app.ts); loginRateLimiter y
// authSessionRateLimiter se aplican en auth.routes.ts sobre /login y
// /refresh+/logout respectivamente — las tres rutas de auth necesitan una
// clave de limitación que no dependa de `req.ip`, por la razón explicada en
// el comentario de loginRateLimiter más abajo.
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { isTest } from "../config/env";

// Límite general para el resto de la API (todo menos /auth, que se monta
// antes en app.ts y por lo tanto nunca llega a este middleware): no protege
// contra un abuso dirigido y sofisticado (para eso hace falta un store
// compartido tipo Redis si el backend llega a correr en más de una
// instancia), pero sí pone un techo razonable a un cliente descontrolado o
// una cuenta comprometida. Usa `req.ip` sin ningún cuidado especial porque
// estas rutas SIEMPRE se llaman navegador -> Railway directo (un solo salto
// de proxy, el que ya contempla `trust proxy: 1`), a diferencia de /auth.
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
  // Clave compuesta (IP + email), no solo IP: /auth/login se llama a través
  // del proxy de auth del frontend (frontend/app/api/auth/_proxy.ts), así
  // que req.ip para esta ruta refleja un salto extra (Vercel -> Railway)
  // distinto al del resto de la API (navegador -> Railway directo). Aunque
  // ese proxy ya reenvía la IP real del cliente, depender solo de que
  // Express cuente los saltos de proxy exactamente bien es frágil — con
  // clave compuesta, aun si `req.ip` terminara resolviendo igual para
  // tráfico distinto, un atacante sin credenciales solo puede agotar el
  // cupo del email específico que está probando, nunca el de todo el
  // negocio a la vez (antes, 5 intentos compartidos entre absolutamente
  // todos los usuarios significaban que cualquiera podía tumbar el login
  // de todos con 5 requests anónimas).
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return `${req.ip}:${email}`;
  },
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

// Límite para /auth/refresh y /auth/logout. Antes estas dos rutas no tenían
// limiter propio y solo quedaban cubiertas por el apiRateLimiter genérico
// (600 req/15min por `req.ip`) — pero, igual que /auth/login, ambas se
// llaman a través del proxy de auth del frontend (un salto de proxy extra:
// Vercel -> Railway), así que con `trust proxy: 1` el backend ve la misma
// IP de salida de Vercel para TODO el tráfico de auth proxeado, sin
// importar el visitante real. A diferencia de login, ni refresh ni logout
// traen un email en el body para componer una clave como la de arriba — en
// su lugar se usa el hash del refresh token de la cookie, que identifica la
// sesión real sin depender de contar saltos de proxy correctamente.
//
// El frontend nunca llama a estas rutas sin la cookie presente (ver
// frontend/middleware.ts: una página protegida sin cookie redirige a
// /login del lado del servidor, antes de que el navegador cargue JS que
// pudiera llamar a /refresh), así que una request sin cookie no es un
// flujo legítimo — se agrupan todas bajo una única clave fija con el mismo
// límite, lo que en la práctica les da un cupo compartido bajo sin afectar
// a ningún usuario real.
export const authSessionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: (req) => {
    const rawToken = req.cookies?.refreshToken;
    if (typeof rawToken === "string" && rawToken.length > 0) {
      return `session:${crypto.createHash("sha256").update(rawToken).digest("hex")}`;
    }
    return "no-session";
  },
  message: {
    error: { code: "TOO_MANY_REQUESTS", message: "Demasiadas solicitudes. Intente de nuevo más tarde." }
  }
});
