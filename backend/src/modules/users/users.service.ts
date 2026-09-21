// Gestión de usuarios/trabajadores del sistema (solo accesible por ADMIN,
// ver users.routes.ts). No incluye login — eso vive en el módulo auth.
import bcrypt from "bcrypt";
import { Prisma, Role } from "@prisma/client";
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
  // El chequeo de "último admin" (contar cuántos quedan) y el update en sí
  // corren dentro de una transacción SERIALIZABLE: sin esto, dos PATCH
  // concurrentes degradando/desactivando a los dos únicos admins activos
  // podrían cada uno leer "todavía queda 1 admin más" (contando al otro,
  // que aún no terminó su propia escritura) y dejar el sistema sin ningún
  // admin. Bajo aislamiento serializable, Postgres detecta ese conflicto de
  // lectura/escritura solapado y aborta una de las dos transacciones con
  // P2034 (ver errorHandler.ts) en vez de dejar pasar ambas.
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing) {
        throw AppError.notFound("Usuario no encontrado");
      }

      // Si este cambio desactivaría o le quitaría el rol ADMIN al único
      // admin activo que queda, el sistema entero se quedaría sin nadie que
      // pueda gestionar usuarios, productos o anular facturas — sin ruta de
      // recuperación salvo entrar directo a la base de datos. Se bloquea
      // antes de escribir nada.
      const losesAdminAccess =
        existing.role === Role.ADMIN &&
        existing.active &&
        (input.active === false || (input.role !== undefined && input.role !== Role.ADMIN));

      if (losesAdminAccess) {
        const otherActiveAdmins = await tx.user.count({
          where: { role: Role.ADMIN, active: true, id: { not: id } }
        });
        if (otherActiveAdmins === 0) {
          throw AppError.conflict(
            "No se puede desactivar ni quitarle el rol de administrador al único admin activo",
            "LAST_ADMIN"
          );
        }
      }

      return tx.user.update({ where: { id }, data: input, select: userSafeSelect });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
