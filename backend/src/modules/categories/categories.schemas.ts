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
