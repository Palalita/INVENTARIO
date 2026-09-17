import { z } from "zod";
import { Role } from "@prisma/client";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().default(20)
});

export const createUserSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.nativeEnum(Role).default(Role.VENDEDOR)
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  active: z.boolean().optional()
});

export const idParamSchema = z.object({
  id: z.string().uuid("Id inválido")
});
