// Genera el PDF de una factura "al vuelo" (streaming), sin guardar ningún
// archivo en disco ni en R2 — se arma en memoria con pdfkit y se manda
// directo a la respuesta HTTP en cuanto se pide. Cada factura se puede
// regenerar en cualquier momento porque los datos que necesita ya están en
// la base de datos.
import PDFDocument from "pdfkit";
import { Response } from "express";
import { Prisma } from "@prisma/client";
import { formatBusinessDateTime } from "../../utils/businessDate";

// Mismo formato que formatCurrency() del frontend (lib/invoice-calculations.ts):
// símbolo de moneda de Guatemala y separador de miles, en vez de un número
// crudo con .toFixed(2).
const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  minimumFractionDigits: 2
});

function formatMoney(value: Prisma.Decimal): string {
  return currencyFormatter.format(value.toNumber());
}

// Alto aproximado de una fila (fuente 10pt + el salto de doc.moveDown()).
// Antes de dibujar una fila que no cabría en lo que queda de página, se
// agrega una página nueva y se repite el encabezado — pdfkit no pagina solo
// cuando el texto se posiciona con coordenadas x/y explícitas (como esta
// "tabla" hecha a mano), así que sin este chequeo una factura con ~25-30+
// líneas terminaba con filas dibujadas fuera del área visible de la página.
const ROW_HEIGHT = 20;

function ensureSpace(doc: PDFKit.PDFDocument, minHeight: number, onNewPage?: () => void) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + minHeight > bottom) {
    doc.addPage();
    onNewPage?.();
  }
}

// Forma mínima de los datos que necesita el PDF (subconjunto de lo que
// devuelve invoices.service.ts con su `invoiceInclude`).
interface InvoiceForPdf {
  number: number;
  status: string;
  createdAt: Date;
  subtotal: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
  client: { name: string; nit: string | null; email: string | null; phone: string | null };
  user: { name: string; email: string };
  items: Array<{
    quantity: number;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    product: { name: string; sku: string };
  }>;
}

// Dibuja el PDF de la factura directamente sobre el `Response` de Express
// (`doc.pipe(res)`): el documento se va generando y enviando por streaming
// (chunk a chunk) a medida que pdfkit lo produce, en vez de armarlo entero
// en memoria y mandarlo de un golpe.
export function streamInvoicePdf(invoice: InvoiceForPdf, res: Response): void {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  // "inline" (no "attachment"): el navegador intenta mostrar el PDF en una
  // pestaña en vez de forzar la descarga.
  res.setHeader("Content-Disposition", `inline; filename=factura-${invoice.number}.pdf`);

  doc.pipe(res);

  doc.fontSize(20).text("Factura", { align: "right" });
  doc.fontSize(10).text(`N° ${invoice.number}`, { align: "right" });
  doc.text(`Estado: ${invoice.status}`, { align: "right" });
  // Hora de Guatemala, no UTC crudo: Railway corre en UTC, así que una venta
  // después de las 6pm hora local (UTC-6) mostraría la fecha del día
  // siguiente en este documento fiscal si se usara toISOString() aquí.
  doc.text(`Fecha: ${formatBusinessDateTime(invoice.createdAt)}`, { align: "right" });
  doc.moveDown();

  doc.fontSize(12).text("Cliente:");
  doc.fontSize(10).text(invoice.client.name);
  if (invoice.client.nit) doc.text(`NIT: ${invoice.client.nit}`);
  if (invoice.client.email) doc.text(`Email: ${invoice.client.email}`);
  if (invoice.client.phone) doc.text(`Teléfono: ${invoice.client.phone}`);
  doc.moveDown();

  doc.fontSize(10).text(`Vendedor: ${invoice.user.name} (${invoice.user.email})`);
  doc.moveDown();

  doc.fontSize(12).text("Detalle:");
  doc.moveDown(0.5);

  // pdfkit no tiene un sistema de tablas de alto nivel: cada columna se
  // dibuja con una coordenada X fija (50, 220, 300, 360, 440), a mano.
  function drawItemsHeader() {
    const y = doc.y;
    doc.fontSize(10);
    doc.text("Producto", 50, y);
    doc.text("SKU", 220, y);
    doc.text("Cant.", 300, y);
    doc.text("P. Unit.", 360, y);
    doc.text("Subtotal", 440, y);
    doc.moveDown();
  }

  drawItemsHeader();

  invoice.items.forEach((item) => {
    ensureSpace(doc, ROW_HEIGHT, drawItemsHeader);
    const y = doc.y;
    doc.text(item.product.name, 50, y);
    doc.text(item.product.sku, 220, y);
    doc.text(String(item.quantity), 300, y);
    doc.text(formatMoney(item.unitPrice), 360, y);
    doc.text(formatMoney(item.subtotal), 440, y);
    doc.moveDown();
  });

  // Los tres renglones de totales deben quedar juntos en la misma página.
  ensureSpace(doc, ROW_HEIGHT * 4);
  doc.moveDown();
  doc.fontSize(11).text(`Subtotal: ${formatMoney(invoice.subtotal)}`, { align: "right" });
  doc.text(`Impuesto: ${formatMoney(invoice.tax)}`, { align: "right" });
  doc.fontSize(13).text(`Total: ${formatMoney(invoice.total)}`, { align: "right" });

  doc.end();
}
