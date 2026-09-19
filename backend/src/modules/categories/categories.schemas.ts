// Esquemas de validación + tipos del módulo categories, todo en un solo
// archivo porque el módulo es pequeño (a diferencia de users, que separa
// tipos en users.types.ts).
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido")
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional()
});

export const idParamSchema = z.object({
  id: z.string().uuid("Id inválido")
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
