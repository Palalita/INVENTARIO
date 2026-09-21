// Controladores HTTP de facturación: crear, listar, ver una, anularla y
// descargar su PDF.
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as invoicesService from "./invoices.service";
import { streamInvoicePdf } from "./invoices.pdf";
import { ListInvoicesQuery } from "./invoices.schemas";

// Se le pasa al service quién está pidiendo el listado (id + rol) para que
// aplique el scoping por rol (un VENDEDOR solo ve las suyas).
export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListInvoicesQuery;
  const result = await invoicesService.listInvoices(query, { id: req.user!.sub, role: req.user!.role });
  res.status(200).json(serialize(result));
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoicesService.getInvoiceById(req.params.id, { id: req.user!.sub, role: req.user!.role });
  res.status(200).json(serialize({ invoice }));
});

// req.user!.sub queda como el vendedor/usuario que emitió la factura.
export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoicesService.createInvoice(req.user!.sub, req.body);
  res.status(201).json(serialize({ invoice }));
});

// req.user!.sub aquí es quien ANULA, no necesariamente quien la emitió
// (ver el comentario en invoices.service.ts sobre cancelledByUserId).
export const cancelInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoicesService.cancelInvoice(req.params.id, req.user!.sub);
  res.status(200).json(serialize({ invoice }));
});

// No usa `serialize`/`res.json`: streamInvoicePdf escribe directo la
// respuesta binaria (el PDF) sobre `res`.
export const getInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoicesService.getInvoiceById(req.params.id, { id: req.user!.sub, role: req.user!.role });
  streamInvoicePdf(invoice, res);
});
