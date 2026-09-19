import { z } from "zod";

export const listClientsQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

// Todos los campos salvo `name` son opcionales: hay clientes que facturan
// sin dar NIT/email/teléfono (ej. "Consumidor Final").
export const createClientSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  nit: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional()
});

// A diferencia de createClientSchema, aquí los campos aceptan `null`
// explícito además de `undefined`: `undefined` significa "no tocar este
// campo" (actualización parcial), `null` significa "borrar el valor que
// tenía" (ej. quitarle el NIT a un cliente).
export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  nit: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable()
});

export const idParamSchema = z.object({
  id: z.string().uuid("Id inválido")
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
