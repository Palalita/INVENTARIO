import { InvoiceStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { SalesReportQuery } from "./dashboard.schemas";

interface RequestingUser {
  id: string;
  role: Role;
}

// El negocio opera en hora de Guatemala (UTC-6, sin horario de verano), pero
// el servidor (Railway) corre en UTC. Si "hoy"/"este mes" se calculan con la
// hora local del proceso, las facturas hechas de 6pm a medianoche (hora GT)
// caen en el día UTC siguiente y desaparecen de los reportes/gráficas del día
// que el usuario espera. Se fija el offset del negocio en vez de depender de
// la zona horaria del contenedor.
const BUSINESS_UTC_OFFSET_MS = -6 * 60 * 60 * 1000;

function startOfToday(): Date {
  const shifted = new Date(Date.now() + BUSINESS_UTC_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - BUSINESS_UTC_OFFSET_MS);
}

function startOfMonth(): Date {
  const shifted = new Date(Date.now() + BUSINESS_UTC_OFFSET_MS);
  const firstOfMonth = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1));
  return new Date(firstOfMonth.getTime() - BUSINESS_UTC_OFFSET_MS);
}

function userScopeWhere(requester: RequestingUser): Prisma.InvoiceWhereInput {
  return requester.role === Role.VENDEDOR ? { userId: requester.id } : {};
}

// Convierte una fecha de calendario "YYYY-MM-DD" (tal como la ve el usuario
// en Guatemala) a su medianoche real en UTC, igual que startOfToday().
function startOfLocalDay(dateStr: string, addDays = 0): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const midnightAsUtc = new Date(Date.UTC(year, month - 1, day + addDays));
  return new Date(midnightAsUtc.getTime() - BUSINESS_UTC_OFFSET_MS);
}

export async function getSummary(requester: RequestingUser) {
  const scope = userScopeWhere(requester);

  const [salesTodayAgg, salesMonthAgg, invoiceCountMonth, lowStockProducts, topProductsRaw] = await Promise.all([
    prisma.invoice.aggregate({
      where: { ...scope, status: InvoiceStatus.EMITIDA, createdAt: { gte: startOfToday() } },
      _sum: { total: true }
    }),
    prisma.invoice.aggregate({
      where: { ...scope, status: InvoiceStatus.EMITIDA, createdAt: { gte: startOfMonth() } },
      _sum: { total: true }
    }),
    prisma.invoice.count({
      where: { ...scope, status: InvoiceStatus.EMITIDA, createdAt: { gte: startOfMonth() } }
    }),
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Product" WHERE active = true AND stock <= "minStock" ORDER BY stock ASC LIMIT 100
    `.then(async (rows) => {
      const ids = rows.map((r) => r.id);
      if (ids.length === 0) return [];
      return prisma.product.findMany({ where: { id: { in: ids } }, orderBy: { stock: "asc" } });
    }),
    prisma.invoiceItem.groupBy({
      by: ["productId"],
      where: { invoice: { ...scope, status: InvoiceStatus.EMITIDA } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5
    })
  ]);

  const productIds = topProductsRaw.map((t) => t.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productsById = new Map(products.map((p) => [p.id, p]));

  const topProducts = topProductsRaw
    .map((t) => {
      const product = productsById.get(t.productId);
      if (!product) return null;
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantitySold: t._sum.quantity ?? 0,
        totalSold: t._sum.subtotal ?? new Prisma.Decimal(0)
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  return {
    salesToday: salesTodayAgg._sum.total ?? new Prisma.Decimal(0),
    salesMonth: salesMonthAgg._sum.total ?? new Prisma.Decimal(0),
    invoiceCountMonth,
    lowStockProducts,
    topProducts
  };
}

export async function getSalesReport(query: SalesReportQuery, requester: RequestingUser) {
  const where: Prisma.InvoiceWhereInput = { ...userScopeWhere(requester), status: InvoiceStatus.EMITIDA };

  if (query.from || query.to) {
    where.createdAt = {};
    // "from"/"to" llegan como fechas de calendario ("YYYY-MM-DD") sin hora.
    // new Date("YYYY-MM-DD") las interpreta como medianoche UTC, no medianoche
    // local, lo que corta ventas del día (sobre todo las de la tarde/noche)
    // en cualquier zona horaria detrás de UTC. Se parsean como fecha local,
    // igual que startOfToday()/startOfMonth() más arriba, y "to" se vuelve un
    // límite exclusivo al día siguiente para incluir el día completo.
    if (query.from) where.createdAt.gte = startOfLocalDay(query.from);
    if (query.to) where.createdAt.lt = startOfLocalDay(query.to, 1);
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true, items: true },
    orderBy: { createdAt: "asc" }
  });

  return invoices.map((inv) => ({
    number: inv.number,
    date: inv.createdAt,
    client: inv.client.name,
    itemCount: inv.items.length,
    subtotal: inv.subtotal,
    tax: inv.tax,
    total: inv.total
  }));
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "number,date,client,itemCount,subtotal,tax,total\n";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const value = row[h];
          const str = value instanceof Date ? value.toISOString() : String(value);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
  }
  return lines.join("\n");
}
