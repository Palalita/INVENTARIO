import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { apiRateLimiter } from "./middlewares/rateLimit";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import categoriesRoutes from "./modules/categories/categories.routes";
import productsRoutes from "./modules/products/products.routes";
import clientsRoutes from "./modules/clients/clients.routes";
import invoicesRoutes from "./modules/invoices/invoices.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";

// Construye y configura la app de Express (middlewares + rutas), pero no la
// arranca (eso lo hace server.ts). Estar separada en una función permite que
// los tests de supertest (backend/tests/*) importen la app sin abrir un
// puerto real.
export function createApp(): Express {
  const app = express();

  // Railway pone la app detrás de un proxy: sin esto, Express no confía en
  // X-Forwarded-For y `req.ip` resuelve siempre a la IP del proxy (la misma
  // para todos los usuarios), no la del cliente real. Eso rompe el rate
  // limiter de /auth/login (comparte el mismo cupo entre todo el mundo) y
  // puede tanto bloquear a todo el negocio con un solo intento fallido como
  // dejar de frenar fuerza bruta dirigida a una cuenta. `1` = confiar en un
  // solo hop de proxy (el de Railway).
  app.set("trust proxy", 1);

  // Oculta el header "X-Powered-By: Express" que delataría la tecnología
  // usada, para no facilitarle reconocimiento a un atacante.
  app.disable("x-powered-by");

  // Logging estructurado de cada request/response (pino-http). Cada request
  // recibe un id de correlación (x-request-id) que se reusa si el cliente ya
  // mandó uno, o se genera con randomUUID() si no. El endpoint de health
  // check se excluye del log automático para no ensuciarlo con pings.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = req.headers["x-request-id"];
        const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      autoLogging: {
        ignore: (req) => req.url === "/health"
      }
    })
  );

  // helmet: agrega varios headers HTTP de seguridad por defecto (protección
  // contra sniffing de MIME type, clickjacking, etc.).
  app.use(helmet());
  // CORS: solo el origen configurado en FRONTEND_URL puede llamar a esta API
  // desde un navegador, y se permiten credenciales (cookies) en esas
  // llamadas — necesario para que la cookie de refresh token viaje.
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true
    })
  );
  // Parsea el body de las requests como JSON (req.body) y las cookies
  // entrantes (req.cookies), respectivamente.
  app.use(express.json());
  app.use(cookieParser());

  // Endpoint de salud sin autenticación: lo usan Railway y monitoreos
  // externos para saber si el proceso sigue vivo.
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  // Toda la API sirve datos autenticados (facturas, usuarios, reportes...)
  // que un proxy/CDN intermedio no debería cachear nunca — el cliente ya
  // los pide siempre por fetch/axios con header Authorization, nunca por una
  // URL navegable, pero esto cierra el caso de un proxy corporativo
  // guardando una respuesta con datos de facturación de todas formas.
  app.use("/api/v1", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // /auth se monta ANTES del rate limiter general: sus tres rutas
  // (login/refresh/logout) ya traen su propio limiter, con una clave que no
  // depende de `req.ip` sin más (ver middlewares/rateLimit.ts) — se llaman
  // a través del proxy de auth del frontend, que agrega un salto de proxy
  // que `trust proxy: 1` no contempla, y aplicarles también el
  // apiRateLimiter genérico (keyeado por `req.ip`) colapsaría el tráfico de
  // auth de todo el negocio en un solo cupo compartido.
  app.use("/api/v1/auth", authRoutes);

  // Rate limiting aplicado al resto de la API (no a /health ni a /auth) para
  // frenar abuso o fuerza bruta contra cualquier otro endpoint.
  app.use("/api/v1", apiRateLimiter);

  // Cada módulo de negocio monta sus propias rutas bajo su prefijo REST.
  app.use("/api/v1/users", usersRoutes);
  app.use("/api/v1/categories", categoriesRoutes);
  app.use("/api/v1/products", productsRoutes);
  app.use("/api/v1/clients", clientsRoutes);
  app.use("/api/v1/invoices", invoicesRoutes);
  app.use("/api/v1/dashboard", dashboardRoutes);

  // Si ninguna ruta anterior respondió, 404 estandarizado; cualquier error
  // lanzado (o pasado a next()) por un controlador cae en errorHandler, que
  // le da forma consistente a la respuesta de error.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
