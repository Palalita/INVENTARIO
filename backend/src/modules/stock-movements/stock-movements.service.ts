import { MovementType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { CreateMovementInput } from "./stock-movements.schemas";

export async function listMovements(productId: string, page: number, pageSize: number) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw AppError.notFound("Producto no encontrado");
  }

  const { skip, take, page: p, pageSize: ps } = getPaginationArgs({ page, pageSize });
  const [data, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { productId },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    }),
    prisma.stockMovement.count({ where: { productId } })
  ]);
  return buildPaginatedResponse(data, total, p, ps);
}

// Convención: ENTRADA y AJUSTE incrementan el stock; SALIDA lo decrementa
// (falla con 409 INSUFFICIENT_STOCK si no hay suficiente stock disponible).
export async function createMovement(productId: string, userId: string, input: CreateMovementInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw AppError.notFound("Producto no encontrado");
    }

    if (input.type === MovementType.SALIDA && product.stock < input.quantity) {
      throw AppError.conflict("Stock insuficiente para realizar la salida", "INSUFFICIENT_STOCK", [
        { productId, available: product.stock, requested: input.quantity }
      ]);
    }

    const delta = input.type === MovementType.SALIDA ? -input.quantity : input.quantity;

    const [movement] = await Promise.all([
      tx.stockMovement.create({
        data: {
          productId,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason,
          userId
        }
      }),
      tx.product.update({ where: { id: productId }, data: { stock: { increment: delta } } })
    ]);

    return movement;
  });
}
