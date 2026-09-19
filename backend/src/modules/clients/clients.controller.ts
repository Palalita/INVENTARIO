// Controladores HTTP del CRUD de clientes — mismo patrón fino (req → service
// → serialize) que el resto de módulos.
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as clientsService from "./clients.service";
import { ListClientsQuery } from "./clients.schemas";

export const listClients = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListClientsQuery;
  const result = await clientsService.listClients(query);
  res.status(200).json(serialize(result));
});

export const getClient = asyncHandler(async (req: Request, res: Response) => {
  const client = await clientsService.getClientById(req.params.id);
  res.status(200).json(serialize({ client }));
});

export const createClient = asyncHandler(async (req: Request, res: Response) => {
  const client = await clientsService.createClient(req.body);
  res.status(201).json(serialize({ client }));
});

export const updateClient = asyncHandler(async (req: Request, res: Response) => {
  const client = await clientsService.updateClient(req.params.id, req.body);
  res.status(200).json(serialize({ client }));
});

export const deleteClient = asyncHandler(async (req: Request, res: Response) => {
  await clientsService.deleteClient(req.params.id);
  res.status(204).send();
});
