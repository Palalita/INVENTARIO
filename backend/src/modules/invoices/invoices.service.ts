// El módulo más sensible del backend: crear/anular una factura mueve stock
// de verdad y calcula dinero (subtotal/impuesto/total), así que ambas
// operaciones corren dentro de una transacción de Prisma — o se completa
// todo (factura + líneas + stock actualizado + movimientos registrados), o
// no se completa nada.
import { InvoiceStatus, MovementType, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { startOfBusinessLocalDay } from "../../utils/businessDate";
import { CreateInvoiceInput, ListInvoicesQuery } from "./invoices.schemas";

// Relaciones que casi siempre hacen falta al devolver una factura completa:
// el cliente, quién la emitió, quién la anuló (si aplica), y sus líneas con
// el producto de cada una. Se define una sola vez y se reusa en las tres
// funciones que devuelven facturas completas.
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

// Lista paginada de facturas, con filtro opcional por estado y rango de
// fechas. Aplica "scoping" por rol: un VENDEDOR solo ve las facturas que él
// mismo emitió, un ADMIN las ve todas — la misma regla se repite en
// dashboard.service.ts para mantener consistentes los reportes.
export async function listInvoices(query: ListInvoicesQuery, requester: RequestingUser) {
  const { skip, take, page, pageSize } = getPaginationArgs(query);

  const where: Prisma.InvoiceWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.from || query.to) {
    where.createdAt = {};
    // Igual que dashboard.service.ts: "from"/"to" son fechas de calendario
    // en hora de Guatemala, no UTC, y "to" es un límite exclusivo al día
    // siguiente para incluir el día completo (evita cortar ventas de la
    // tarde/noche que new Date(query.to) con .lte hubiera excluido).
    if (query.from) where.createdAt.gte = startOfBusinessLocalDay(query.from);
    if (query.to) where.createdAt.lt = startOfBusinessLocalDay(query.to, 1);
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

// Mismo scoping por rol que listInvoices: un VENDEDOR no puede ver ni
// descargar el PDF de una factura ajena solo porque conoce su id. Se
// devuelve 404 (no 403) para no confirmarle a un vendedor que una factura
// con ese id existe si no es suya.
export async function getInvoiceById(id: string, requester: RequestingUser) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice || (requester.role === Role.VENDEDOR && invoice.userId !== requester.id)) {
    throw AppError.notFound("Factura no encontrada");
  }
  return invoice;
}

// Crea una factura completa: valida stock, calcula montos con precisión
// decimal exacta (Prisma.Decimal, nunca `number` normal — evita errores de
// redondeo de punto flotante en dinero), descuenta el stock y deja un
// registro de movimiento por cada producto vendido. Todo en una sola
// transacción: si el stock resulta insuficiente a mitad de proceso, nada de
// esto se guarda.
export async function createInvoice(userId: string, input: CreateInvoiceInput) {
  return prisma.$transaction(async (tx) => {
    // Consolida cantidades si el mismo producto aparece más de una vez.
    const quantitiesByProduct = new Map<string, number>();
    for (const item of input.items) {
      quantitiesByProduct.set(item.productId, (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    // Una sola consulta para todos los productos involucrados (en vez de una
    // por línea de factura), para no hacer N queries si la factura tiene N
    // líneas distintas.
    const products = await tx.product.findMany({
      where: { id: { in: [...quantitiesByProduct.keys()] } }
    });

    const productsById = new Map(products.map((p) => [p.id, p]));

    const insufficient: Array<{ productId: string; available: number; requested: number }> = [];
    const notFound: string[] = [];

    // Primero se valida TODO (todos los productos existen/están activos, y
    // hay stock suficiente de cada uno) antes de escribir nada — evita dejar
    // la factura a medias si el segundo producto de la lista falla.
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

    // El precio unitario de cada línea se toma del producto EN ESTE
    // MOMENTO (no del que mande el cliente en el request) — así una factura
    // vieja no cambia de precio si el producto se reprecia después, y nadie
    // puede facturar a un precio manipulado desde el frontend.
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

    // El impuesto se calcula sobre el subtotal ya sumado, con la tasa
    // configurada en TAX_RATE (env), no una tasa fija en el código — así se
    // puede ajustar sin tocar código si cambia la ley tributaria.
    const tax = subtotal.mul(env.TAX_RATE);
    const total = subtotal.add(tax);

    // `items: { create: itemsData }` crea la factura Y sus líneas
    // (InvoiceItem) en una sola operación anidada de Prisma.
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

    // Recién aquí, con la factura ya creada, se descuenta el stock real y se
    // deja un StockMovement de tipo SALIDA por cada producto — la
    // trazabilidad de "por qué bajó el stock" queda ligada al número de
    // factura en el campo `reason`.
    //
    // El decremento usa updateMany con el stock mínimo requerido en el
    // `where`, no un update plano: la validación de arriba lee el stock (y
    // el `active`) una vez y puede quedar obsoleta si algo cambia entre esa
    // lectura y este punto — otra venta concurrente del mismo producto (dos
    // vendedores vendiendo las últimas unidades al mismo tiempo), o un ADMIN
    // desactivando el producto en ese instante. `updateMany` con `active:
    // true` y el stock mínimo requerido en el `where` es atómico a nivel de
    // fila en Postgres — si el `count` vuelve en 0, algo cambió y hay que
    // fallar aquí en vez de dejar el stock en negativo o vender un producto
    // recién discontinuado.
    for (const [productId, requested] of quantitiesByProduct.entries()) {
      const result = await tx.product.updateMany({
        where: { id: productId, active: true, stock: { gte: requested } },
        data: { stock: { decrement: requested } }
      });
      if (result.count === 0) {
        const current = await tx.product.findUnique({ where: { id: productId } });
        if (!current?.active) {
          throw AppError.badRequest(`Producto(s) no encontrado(s): ${productId}`, "PRODUCT_NOT_FOUND");
        }
        throw AppError.conflict("Stock insuficiente para uno o más productos", "INSUFFICIENT_STOCK", [
          { productId, available: current?.stock ?? 0, requested }
        ]);
      }
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

// Anula una factura: NUNCA la borra (queda como registro fiscal/histórico
// con status ANULADA), pero repone el stock de cada producto vendido y dejó
// un StockMovement de tipo ENTRADA como reversa de la venta original.
export async function cancelInvoice(id: string, cancelledByUserId: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!invoice) {
      throw AppError.notFound("Factura no encontrada");
    }

    // Reclama la transición EMITIDA -> ANULADA de forma atómica ANTES de
    // tocar el stock, en vez de solo comprobar `invoice.status` en código y
    // escribir después. Sin esto, dos PATCH .../cancel casi simultáneas
    // sobre la misma factura (dos pestañas de admin, doble clic en una
    // conexión lenta) podían ambas leer "todavía EMITIDA" antes de que la
    // primera confirmara, y ambas reponer el stock y crear su propio
    // StockMovement de reversa — duplicando el incremento sin que ninguna
    // de las dos request viera un error. Mismo patrón CAS que ya usa
    // createInvoice() para el stock, y refresh() para la rotación de
    // tokens (auth.service.ts): si `count` da 0, alguien más ya ganó esta
    // carrera.
    const claim = await tx.invoice.updateMany({
      where: { id, status: { not: InvoiceStatus.ANULADA } },
      data: { status: InvoiceStatus.ANULADA, cancelledAt: new Date(), cancelledByUserId }
    });

    if (claim.count === 0) {
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

    return tx.invoice.findUniqueOrThrow({ where: { id }, include: invoiceInclude });
  });
}
