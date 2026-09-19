// Controladores HTTP del módulo users. Traducen req/res a llamadas al
// service; la validación de permisos (solo ADMIN) ya ocurrió en las rutas
// (requireRole), y la validación de forma del body ya ocurrió en el
// middleware `validate` — aquí ya se puede confiar en los datos.
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as usersService from "./users.service";

// GET /users?page=&pageSize= — el cast de req.query es seguro porque el
// middleware validate() ya coerció esos strings de query string a números
// según el esquema (ver users.schemas.ts).
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await usersService.listUsers(page, pageSize);
  res.status(200).json(serialize(result));
});

// POST /users — crea un nuevo usuario/trabajador.
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.createUser(req.body);
  res.status(201).json(serialize({ user }));
});

// PATCH /users/:id — actualiza campos parciales de un usuario (ej. cambiar
// rol, activar/desactivar).
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.updateUser(req.params.id, req.body);
  res.status(200).json(serialize({ user }));
});
