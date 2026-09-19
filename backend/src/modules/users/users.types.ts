// Tipos TypeScript derivados de los esquemas Zod, en un archivo aparte para
// que users.service.ts pueda importarlos sin depender directamente de los
// esquemas de validación (separa "forma de los datos" de "cómo se validan").
import { z } from "zod";
import { createUserSchema, updateUserSchema } from "./users.schemas";

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
