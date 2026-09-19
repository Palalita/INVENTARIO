// Gestión de usuarios/trabajadores del sistema (solo accesible por ADMIN,
// ver users.routes.ts). No incluye login — eso vive en el módulo auth.
import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { CreateUserInput, UpdateUserInput } from "./users.types";

// Factor de costo de bcrypt: cuántas rondas de hashing aplica. 12 es un
// valor estándar razonable en 2026 (más alto = más lento de calcular, más
// resistente a fuerza bruta, pero también más lento de verificar en cada
// login).
const BCRYPT_COST = 12;

// Igual que en auth.service.ts: nunca se selecciona passwordHash.
const userSafeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true
} as const;

// Lista paginada de usuarios, más recientes primero.
export async function listUsers(page: number, pageSize: number) {
  const { skip, take, page: p, pageSize: ps } = getPaginationArgs({ page, pageSize });
  const [data, total] = await Promise.all([
    prisma.user.findMany({ skip, take, select: userSafeSelect, orderBy: { createdAt: "desc" } }),
    prisma.user.count()
  ]);
  return buildPaginatedResponse(data, total, p, ps);
}

// Crea un usuario nuevo (ADMIN o VENDEDOR). Rechaza emails duplicados antes
// de intentar el insert (mensaje más claro que dejar que la restricción
// única de la base de datos lo rechace con un error genérico), y nunca
// guarda la contraseña en texto plano — solo su hash de bcrypt.
export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict("Ya existe un usuario con ese email", "DUPLICATE_EMAIL");
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, role: input.role },
    select: userSafeSelect
  });
  return user;
}

// Actualiza campos de un usuario existente (nombre, rol, o `active` para
// desactivarlo). No permite cambiar contraseña por esta vía — eso sería otro
// endpoint/flujo, no cubierto por UpdateUserInput.
export async function updateUser(id: string, input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Usuario no encontrado");
  }
  const user = await prisma.user.update({ where: { id }, data: input, select: userSafeSelect });
  return user;
}
