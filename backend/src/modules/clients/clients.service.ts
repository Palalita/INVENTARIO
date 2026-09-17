import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { CreateClientInput, ListClientsQuery, UpdateClientInput } from "./clients.schemas";

export async function listClients(query: ListClientsQuery) {
  const { skip, take, page, pageSize } = getPaginationArgs(query);

  const where: Prisma.ClientWhereInput = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { documentId: { contains: query.search, mode: "insensitive" } },
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

export async function createClient(input: CreateClientInput) {
  if (input.documentId) {
    const existing = await prisma.client.findUnique({ where: { documentId: input.documentId } });
    if (existing) {
      throw AppError.conflict("Ya existe un cliente con ese documento", "DUPLICATE_DOCUMENT");
    }
  }
  return prisma.client.create({ data: input });
}

export async function updateClient(id: string, input: UpdateClientInput) {
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Cliente no encontrado");
  }
  return prisma.client.update({ where: { id }, data: input });
}

export async function deleteClient(id: string) {
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Cliente no encontrado");
  }
  await prisma.client.delete({ where: { id } });
}
