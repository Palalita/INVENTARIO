// Controladores HTTP del CRUD de productos y su imagen.
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as productsService from "./products.service";
import { ListProductsQuery } from "./products.schemas";

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListProductsQuery;
  const result = await productsService.listProducts(query);
  res.status(200).json(serialize(result));
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsService.getProductById(req.params.id);
  res.status(200).json(serialize({ product }));
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsService.createProduct(req.body);
  res.status(201).json(serialize({ product }));
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsService.updateProduct(req.params.id, req.body);
  res.status(200).json(serialize({ product }));
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productsService.deleteProduct(req.params.id);
  res.status(204).send();
});

// `req.file` lo llena el middleware uploadImage("image") (multer) antes de
// llegar aquí — ya viene validado en tamaño/tipo declarado; la validación
// del contenido real ocurre dentro del service.
export const uploadProductImage = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsService.uploadProductImage(req.params.id, req.file as Express.Multer.File);
  res.status(200).json(serialize({ product }));
});

export const deleteProductImage = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsService.deleteProductImage(req.params.id);
  res.status(200).json(serialize({ product }));
});
