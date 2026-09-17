import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` }
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.headers["x-request-id"];

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
    } else {
      logger.warn({ code: err.code, requestId }, err.message);
    }
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Datos de entrada inválidos",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
      }
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        error: { code: "DUPLICATE_ENTRY", message: "El registro ya existe (violación de unicidad)." }
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Recurso no encontrado." } });
      return;
    }
  }

  logger.error({ err, requestId }, "Error no controlado");
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Ocurrió un error interno del servidor." }
  });
}
