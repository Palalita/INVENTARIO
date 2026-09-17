import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as invoicesService from "./invoices.service";
import { streamInvoicePdf } from "./invoices.pdf";
import { ListInvoicesQuery } from "./invoices.schemas";

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListInvoicesQuery;
  const result = await invoicesService.listInvoices(query, { id: req.user!.sub, role: req.user!.role });
  res.status(200).json(serialize(result));
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoicesService.getInvoiceById(req.params.id);
  res.status(200).json(serialize({ invoice }));
});

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoicesService.createInvoice(req.user!.sub, req.body);
  res.status(201).json(serialize({ invoice }));
});

export const cancelInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoicesService.cancelInvoice(req.params.id, req.user!.sub);
  res.status(200).json(serialize({ invoice }));
});

export const getInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoicesService.getInvoiceById(req.params.id);
  streamInvoicePdf(invoice, res);
});
