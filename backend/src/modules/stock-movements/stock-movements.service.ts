// Historial auditable de cambios de stock (entradas, salidas, ajustes). Es
// el único camino "oficial" para cambiar `Product.stock` con trazabilidad:
// a diferencia de un PATCH directo al producto, aquí queda registrado qué
// pasó, cuánto, por qué (`reason`) y quién lo hizo.
import { MovementType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { CreateMovementInput } from "./stock-movements.schemas";

// Historial paginado de movimientos de UN producto específico, más
// recientes primero. 404 si el producto no existe (evita devolver
// silenciosamente una lista vacía para un id inválido).
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
//
// Registra el movimiento Y actualiza `Product.stock` dentro de una misma
// transacción de base de datos (`prisma.$transaction`): si algo falla a
// mitad de camino, Postgres revierte ambos cambios juntos — nunca queda un
// movimiento registrado sin que el stock realmente haya cambiado, ni
// viceversa.
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
      // `increment`/`decrement` de Prisma se traducen a un UPDATE atómico en
      // SQL (`stock = stock + delta`), no a "leer, sumar en memoria, y
      // escribir" — evita condiciones de carrera si dos requests tocan el
      // mismo producto casi al mismo tiempo.
      tx.product.update({ where: { id: productId }, data: { stock: { increment: delta } } })
    ]);

    return movement;
  });
}
