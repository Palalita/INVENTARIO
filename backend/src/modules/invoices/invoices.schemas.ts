import { z } from "zod";
import { InvoiceStatus } from "@prisma/client";
import { calendarDateSchema } from "../../utils/businessDate";

export const listInvoicesQuerySchema = z.object({
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

// Deliberadamente NO se acepta un precio por línea aquí: el cliente solo
// manda qué producto y cuánta cantidad quiere. El precio unitario lo decide
// el servidor (leyéndolo del producto en ese momento, ver
// invoices.service.ts) — así nadie puede facturar a un precio distinto al
// real manipulando el request.
// max(200)/max(100000): topes generosos para el tamaño real del negocio,
// no una regla de negocio estricta — sin ellos, un body enorme (miles de
// líneas, o una cantidad absurdamente grande) generaba una transacción larga
// o un overflow silencioso contra el Decimal(12,2) de la base, con un 500
// genérico en vez de un 400 de validación claro.
export const createInvoiceSchema = z.object({
  clientId: z.string().uuid("clientId inválido"),
  items: z
    .array(
      z.object({
        productId: z.string().uuid("productId inválido"),
        quantity: z.coerce.number().int().positive("La cantidad debe ser mayor a 0").max(100000, "Cantidad demasiado grande")
      })
    )
    .min(1, "La factura debe tener al menos un producto")
    .max(200, "Demasiados productos en una sola factura")
});

export const idParamSchema = z.object({
  id: z.string().uuid("Id inválido")
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
