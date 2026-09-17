import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { CreateUserInput, UpdateUserInput } from "./users.types";

const BCRYPT_COST = 12;

const userSafeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true
} as const;

export async function listUsers(page: number, pageSize: number) {
  const { skip, take, page: p, pageSize: ps } = getPaginationArgs({ page, pageSize });
  const [data, total] = await Promise.all([
    prisma.user.findMany({ skip, take, select: userSafeSelect, orderBy: { createdAt: "desc" } }),
    prisma.user.count()
  ]);
  return buildPaginatedResponse(data, total, p, ps);
}

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

export async function updateUser(id: string, input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Usuario no encontrado");
  }
  const user = await prisma.user.update({ where: { id }, data: input, select: userSafeSelect });
  return user;
}
