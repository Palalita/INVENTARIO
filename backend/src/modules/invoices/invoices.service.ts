import { InvoiceStatus, MovementType, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { CreateInvoiceInput, ListInvoicesQuery } from "./invoices.schemas";

const invoiceInclude = {
  client: true,
  user: { select: { id: true, name: true, email: true, role: true } },
  cancelledBy: { select: { id: true, name: true, email: true, role: true } },
  items: { include: { product: true } }
} as const;

interface RequestingUser {
  id: string;
  role: Role;
}

export async function listInvoices(query: ListInvoicesQuery, requester: RequestingUser) {
  const { skip, take, page, pageSize } = getPaginationArgs(query);

  const where: Prisma.InvoiceWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }

  // Un vendedor solo ve sus propias ventas (PRD 3: "Ver dashboard/reportes: Ventas propias").
  if (requester.role === Role.VENDEDOR) {
    where.userId = requester.id;
  }

  const [data, total] = await Promise.all([
    prisma.invoice.findMany({ where, skip, take, include: invoiceInclude, orderBy: { createdAt: "desc" } }),
    prisma.invoice.count({ where })
  ]);

  return buildPaginatedResponse(data, total, page, pageSize);
}

export async function getInvoiceById(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) {
    throw AppError.notFound("Factura no encontrada");
  }
  return invoice;
}

export async function createInvoice(userId: string, input: CreateInvoiceInput) {
  return prisma.$transaction(async (tx) => {
    // Consolida cantidades si el mismo producto aparece más de una vez.
    const quantitiesByProduct = new Map<string, number>();
    for (const item of input.items) {
      quantitiesByProduct.set(item.productId, (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const products = await tx.product.findMany({
      where: { id: { in: [...quantitiesByProduct.keys()] } }
    });

    const productsById = new Map(products.map((p) => [p.id, p]));

    const insufficient: Array<{ productId: string; available: number; requested: number }> = [];
    const notFound: string[] = [];

    for (const [productId, requested] of quantitiesByProduct.entries()) {
      const product = productsById.get(productId);
      if (!product || !product.active) {
        notFound.push(productId);
        continue;
      }
      if (product.stock < requested) {
        insufficient.push({ productId, available: product.stock, requested });
      }
    }

    if (notFound.length > 0) {
      throw AppError.badRequest(
        `Producto(s) no encontrado(s): ${notFound.join(", ")}`,
        "PRODUCT_NOT_FOUND"
      );
    }

    if (insufficient.length > 0) {
      throw AppError.conflict("Stock insuficiente para uno o más productos", "INSUFFICIENT_STOCK", insufficient);
    }

    const client = await tx.client.findUnique({ where: { id: input.clientId } });
    if (!client) {
      throw AppError.badRequest("Cliente no encontrado", "CLIENT_NOT_FOUND");
    }

    let subtotal = new Prisma.Decimal(0);
    const itemsData = input.items.map((item) => {
      const product = productsById.get(item.productId)!;
      const lineSubtotal = product.price.mul(item.quantity);
      subtotal = subtotal.add(lineSubtotal);
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: lineSubtotal
      };
    });

    const tax = subtotal.mul(env.TAX_RATE);
    const total = subtotal.add(tax);

    const invoice = await tx.invoice.create({
      data: {
        clientId: input.clientId,
        userId,
        status: InvoiceStatus.EMITIDA,
        subtotal,
        tax,
        total,
        items: { create: itemsData }
      },
      include: invoiceInclude
    });

    for (const [productId, requested] of quantitiesByProduct.entries()) {
      await tx.product.update({ where: { id: productId }, data: { stock: { decrement: requested } } });
      await tx.stockMovement.create({
        data: {
          productId,
          type: MovementType.SALIDA,
          quantity: requested,
          reason: `Venta - Factura #${invoice.number}`,
          userId
        }
      });
    }

    return invoice;
  });
}

export async function cancelInvoice(id: string, cancelledByUserId: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!invoice) {
      throw AppError.notFound("Factura no encontrada");
    }
    if (invoice.status === InvoiceStatus.ANULADA) {
      throw AppError.conflict("La factura ya se encuentra anulada", "INVOICE_ALREADY_CANCELLED");
    }

    for (const item of invoice.items) {
      await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: MovementType.ENTRADA,
          quantity: item.quantity,
          reason: `Anulación factura #${invoice.number}`,
          // Quien registra el movimiento de reversa es quien anula, no
          // necesariamente quien emitió la factura originalmente.
          userId: cancelledByUserId
        }
      });
    }

    return tx.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.ANULADA, cancelledAt: new Date(), cancelledByUserId },
      include: invoiceInclude
    });
  });
}
