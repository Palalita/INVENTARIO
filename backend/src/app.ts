import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import categoriesRoutes from "./modules/categories/categories.routes";
import productsRoutes from "./modules/products/products.routes";
import clientsRoutes from "./modules/clients/clients.routes";
import invoicesRoutes from "./modules/invoices/invoices.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

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

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", usersRoutes);
  app.use("/api/v1/categories", categoriesRoutes);
  app.use("/api/v1/products", productsRoutes);
  app.use("/api/v1/clients", clientsRoutes);
  app.use("/api/v1/invoices", invoicesRoutes);
  app.use("/api/v1/dashboard", dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
