import { InvoiceStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { SalesReportQuery } from "./dashboard.schemas";

interface RequestingUser {
  id: string;
  role: Role;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function userScopeWhere(requester: RequestingUser): Prisma.InvoiceWhereInput {
  return requester.role === Role.VENDEDOR ? { userId: requester.id } : {};
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
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5
    })
  ]);

  const productIds = topProductsRaw.map((t) => t.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productsById = new Map(products.map((p) => [p.id, p]));

  const topProducts = topProductsRaw.map((t) => ({
    product: productsById.get(t.productId) ?? null,
    quantitySold: t._sum.quantity ?? 0
  }));

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
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
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
