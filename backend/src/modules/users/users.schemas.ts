import { z } from "zod";
import { Role } from "@prisma/client";

// Query string de GET /users?page=&pageSize=. `z.coerce.number()` convierte
// el string que llega en la URL a número antes de validar (query params
// siempre llegan como string).
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

// Body de POST /users. A diferencia del login, aquí sí se exige contraseña
// de al menos 8 caracteres (es la que va a usar el trabajador para
// iniciar sesión, no un intento de login). `role` por defecto VENDEDOR: un
// admin tiene que elegir explícitamente crear a otro admin.
export const createUserSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  // trim + lowercase: la restricción @unique de email en Postgres es
  // sensible a mayúsculas — sin normalizar aquí, "Admin@empresa.com" y
  // "admin@empresa.com" pasarían como dos cuentas distintas.
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.nativeEnum(Role).default(Role.VENDEDOR)
});

// Body de PATCH /users/:id — todos los campos opcionales porque es una
// actualización parcial (solo se manda lo que se quiere cambiar). No incluye
// `email` ni `password` a propósito: cambiar esos campos no está soportado
// por este endpoint.
export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  active: z.boolean().optional()
});

// Valida que el `:id` de la URL sea un UUID real, para responder 400 en vez
// de que Prisma falle con un error críptico si alguien manda un id con
// formato inválido.
export const idParamSchema = z.object({
  id: z.string().uuid("Id inválido")
});
