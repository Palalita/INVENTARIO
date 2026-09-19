// Middlewares de autenticación (¿quién eres?) y autorización (¿qué puedes
// hacer?), usados en las rutas de cada módulo (ver *.routes.ts).
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

// Datos que viajan dentro del access token (JWT) firmado por el backend.
// `sub` (subject) es el id del usuario, siguiendo la convención estándar de JWT.
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

// Extiende el tipo `Request` de Express para poder guardar el usuario
// autenticado en `req.user` (lo llena requireAuth) y que TypeScript lo
// reconozca en cualquier controlador sin necesidad de castear.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

// Middleware de autenticación: exige un header `Authorization: Bearer
// <token>`, verifica la firma del JWT con el secreto del servidor y, si es
// válido, deja el payload decodificado en `req.user` para que el resto de la
// cadena de middlewares/controlador sepa quién hizo la request. Se aplica al
// inicio de las rutas de cada módulo protegido.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next(AppError.unauthorized("Token de acceso requerido", "NO_TOKEN"));
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    req.user = payload;
    next();
  } catch {
    // Cualquier falla de jwt.verify (firma inválida, token expirado,
    // formato corrupto) se trata igual: 401 genérico, sin revelar el motivo
    // exacto.
    next(AppError.unauthorized("Token de acceso inválido o expirado", "INVALID_TOKEN"));
  }
}

// Middleware de autorización por rol: se coloca DESPUÉS de requireAuth en
// una ruta (ej. `router.post("/", requireAuth, requireRole("ADMIN"), ...)`)
// y solo deja pasar si `req.user.role` está entre los roles permitidos.
// Devuelve 403 (no 401) porque en este punto ya sabemos quién es el usuario;
// simplemente no tiene permiso para esta acción.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden("No tiene permisos para realizar esta acción", "FORBIDDEN_ROLE"));
      return;
    }
    next();
  };
}
