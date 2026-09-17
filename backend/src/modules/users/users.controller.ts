import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as usersService from "./users.service";

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await usersService.listUsers(page, pageSize);
  res.status(200).json(serialize(result));
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.createUser(req.body);
  res.status(201).json(serialize({ user }));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.updateUser(req.params.id, req.body);
  res.status(200).json(serialize({ user }));
});
