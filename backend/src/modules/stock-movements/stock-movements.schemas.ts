import { z } from "zod";
import { MovementType } from "@prisma/client";

export const listMovementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

// `type` viene del enum de Prisma (ENTRADA/SALIDA/AJUSTE, ver
// schema.prisma). `quantity` siempre positiva: la dirección del movimiento
// (sumar o restar del stock) la decide `type`, no el signo del número.
export const createMovementSchema = z.object({
  type: z.nativeEnum(MovementType),
  // max(100000): mismo tope generoso que createInvoiceSchema, por la misma
  // razón (evitar un overflow silencioso contra el Decimal/Int de la base).
  quantity: z.coerce.number().int().positive("La cantidad debe ser mayor a 0").max(100000, "Cantidad demasiado grande"),
  reason: z.string().optional()
});

export const productIdParamSchema = z.object({
  id: z.string().uuid("Id de producto inválido")
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
