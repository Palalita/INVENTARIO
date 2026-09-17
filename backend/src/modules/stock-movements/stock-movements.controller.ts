import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as movementsService from "./stock-movements.service";

export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await movementsService.listMovements(req.params.id, page, pageSize);
  res.status(200).json(serialize(result));
});

export const createMovement = asyncHandler(async (req: Request, res: Response) => {
  const movement = await movementsService.createMovement(req.params.id, req.user!.sub, req.body);
  res.status(201).json(serialize({ movement }));
});
