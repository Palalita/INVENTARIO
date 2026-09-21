// Historial auditable de cambios de stock (entradas, salidas, ajustes). Es
// el único camino "oficial" para cambiar `Product.stock` con trazabilidad:
// a diferencia de un PATCH directo al producto, aquí queda registrado qué
// pasó, cuánto, por qué (`reason`) y quién lo hizo.
import { MovementType, Role } from "@prisma/client";
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
// El frontend ya oculta la opción "Ajuste" a quien no sea ADMIN
// (stock-movement-dialog.tsx), pero eso es solo UX — sin este chequeo, un
// VENDEDOR podía llamar el endpoint directo con type: "AJUSTE" y mover
// inventario sin que exista una venta o compra real detrás (el PRD reserva
// los ajustes a ADMIN; ENTRADA/SALIDA manuales sí las puede hacer cualquiera).
export async function createMovement(
  productId: string,
  userId: string,
  requesterRole: Role,
  input: CreateMovementInput
) {
  if (input.type === MovementType.AJUSTE && requesterRole !== Role.ADMIN) {
    throw AppError.forbidden("Solo un administrador puede registrar ajustes de inventario");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw AppError.notFound("Producto no encontrado");
    }

    if (input.type === MovementType.SALIDA) {
      // El decremento va condicionado al stock actual en el propio UPDATE
      // (`gte: input.quantity`), no "leer stock, validar en código, y luego
      // decrementar por separado": dos SALIDA concurrentes del mismo
      // producto podrían pasar la validación contra el mismo stock ya
      // desactualizado y dejarlo en negativo. `updateMany` con esa condición
      // es atómico a nivel de fila en Postgres — si `count` da 0, alguien
      // más ganó la carrera.
      const result = await tx.product.updateMany({
        where: { id: productId, stock: { gte: input.quantity } },
        data: { stock: { decrement: input.quantity } }
      });
      if (result.count === 0) {
        const current = await tx.product.findUnique({ where: { id: productId } });
        throw AppError.conflict("Stock insuficiente para realizar la salida", "INSUFFICIENT_STOCK", [
          { productId, available: current?.stock ?? 0, requested: input.quantity }
        ]);
      }
    } else {
      // ENTRADA/AJUSTE solo suman stock, no hay piso que pueda romperse por
      // una carrera — un update normal basta.
      await tx.product.update({ where: { id: productId }, data: { stock: { increment: input.quantity } } });
    }

    return tx.stockMovement.create({
      data: {
        productId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        userId
      }
    });
  });
}
