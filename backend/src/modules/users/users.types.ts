import { z } from "zod";
import { createUserSchema, updateUserSchema } from "./users.schemas";

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
