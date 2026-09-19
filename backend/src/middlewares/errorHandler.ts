// Manejo centralizado de errores: todos los controladores usan
// asyncHandler() (ver utils/asyncHandler.ts) para reenviar cualquier
// excepción a este middleware vía next(err), en vez de repetir try/catch en
// cada endpoint. Así el formato de respuesta de error es siempre el mismo:
// `{ error: { code, message, details? } }`.
import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";

// Se monta al final de todas las rutas en app.ts: si ninguna ruta coincidió
// con el método+path de la request, cae aquí y responde 404.
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` }
  });
}

// Middleware de error de Express (se reconoce por tener 4 parámetros). Da
// forma a la respuesta según el tipo de error:
// - AppError (lanzado a propósito por el código de negocio, ver
//   utils/AppError.ts): usa su propio statusCode/code/message. Solo se
//   loguea como "error" si es 5xx; los 4xx (validación, permisos) se logean
//   como "warn" porque son esperables y no indican un bug.
// - ZodError (validación de esquema): 400 con el detalle de qué campo falló.
// - Errores conocidos de Prisma: P2002 (violación de unicidad, ej. SKU
//   duplicado) se traduce a 409; P2025 (registro no encontrado al
//   actualizar/borrar) a 404.
// - Cualquier otro error no anticipado: 500 genérico, pero sí se loguea
//   completo para poder investigarlo después.
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
