import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as categoriesService from "./categories.service";

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoriesService.listCategories();
  res.status(200).json(serialize({ data: categories }));
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoriesService.createCategory(req.body);
  res.status(201).json(serialize({ category }));
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoriesService.updateCategory(req.params.id, req.body);
  res.status(200).json(serialize({ category }));
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await categoriesService.deleteCategory(req.params.id);
  res.status(204).send();
});
