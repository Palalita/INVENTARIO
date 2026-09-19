// Middleware genérico de validación de requests con esquemas Zod. Cada
// módulo define sus propios esquemas (*.schemas.ts) y los conecta a su ruta
// con `validate({ body: miEsquema })` — así el controlador puede confiar en
// que req.body/query/params ya tienen la forma y los tipos esperados.
import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError } from "zod";
import { AppError } from "../utils/AppError";

interface ValidationSchemas {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

// Convierte los issues de Zod (formato interno de la librería) a una lista
// plana `{ path, message }` más simple de consumir por el frontend.
function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));
}

// Fábrica de middleware: valida cada parte de la request que tenga un
// esquema definido. `schema.parse(...)` no solo valida — también transforma
// (coerciona tipos, aplica defaults), por eso el resultado se reasigna de
// vuelta a req.body/query/params en vez de solo comprobar y seguir.
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(AppError.badRequest("Datos de entrada inválidos", "VALIDATION_ERROR", formatZodError(err)));
        return;
      }
      next(err);
    }
  };
}
