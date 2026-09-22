// CRUD de clientes (a quienes se les factura). Estructura muy parecida a
// products/categories: paginación, búsqueda, y unicidad de un campo de
// negocio (aquí el NIT, allá el SKU).
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { CreateClientInput, ListClientsQuery, UpdateClientInput } from "./clients.schemas";

// Lista paginada de clientes, con búsqueda opcional por nombre, NIT o email
// (coincidencia parcial, insensible a mayúsculas). Si no hay `search`, trae
// todos los clientes paginados normalmente.
export async function listClients(query: ListClientsQuery) {
  const { skip, take, page, pageSize } = getPaginationArgs(query);

  const where: Prisma.ClientWhereInput = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { nit: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } }
        ]
      }
    : {};

  const [data, total] = await Promise.all([
    prisma.client.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.client.count({ where })
  ]);

  return buildPaginatedResponse(data, total, page, pageSize);
}

export async function getClientById(id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    throw AppError.notFound("Cliente no encontrado");
  }
  return client;
}

// El NIT es opcional (algunos clientes facturan como "Consumidor Final" sin
// NIT), pero si viene, debe ser único — se valida explícitamente porque
// varios clientes sin NIT (todos `null`) sí deben poder coexistir.
export async function createClient(input: CreateClientInput) {
  if (input.nit) {
    const existing = await prisma.client.findUnique({ where: { nit: input.nit } });
    if (existing) {
      throw AppError.conflict("Ya existe un cliente con ese NIT", "DUPLICATE_NIT");
    }
  }
  return prisma.client.create({ data: input });
}

// Si viene un NIT nuevo distinto al actual, revalida que no choque con el
// de otro cliente (igual que createClient) — antes de este chequeo, ese
// caso caía en el manejador genérico de P2002 (sigue siendo un 409, no un
// 500, pero con un mensaje/código menos específico que DUPLICATE_NIT).
export async function updateClient(id: string, input: UpdateClientInput) {
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Cliente no encontrado");
  }

  if (input.nit && input.nit !== existing.nit) {
    const nitTaken = await prisma.client.findUnique({ where: { nit: input.nit } });
    if (nitTaken) {
      throw AppError.conflict("Ya existe un cliente con ese NIT", "DUPLICATE_NIT");
    }
  }

  return prisma.client.update({ where: { id }, data: input });
}

// Borrado físico. `Invoice.clientId` es una relación requerida (no
// opcional), así que si el cliente ya tiene facturas, Postgres rechaza el
// delete por la restricción de clave foránea antes de que llegue aquí un
// resultado — en la práctica, no se puede borrar un cliente con historial
// de facturación.
export async function deleteClient(id: string) {
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Cliente no encontrado");
  }
  await prisma.client.delete({ where: { id } });
}
