// Controladores HTTP de movimientos de stock, montados bajo /products/:id/movements.
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as movementsService from "./stock-movements.service";

export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await movementsService.listMovements(req.params.id, page, pageSize);
  res.status(200).json(serialize(result));
});

// req.user!.sub es el id del usuario autenticado (requireAuth ya corrió
// antes) — queda registrado en el movimiento quién lo hizo, para la
// auditoría.
export const createMovement = asyncHandler(async (req: Request, res: Response) => {
  const movement = await movementsService.createMovement(req.params.id, req.user!.sub, req.user!.role, req.body);
  res.status(201).json(serialize({ movement }));
});
