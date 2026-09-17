import PDFDocument from "pdfkit";
import { Response } from "express";
import { Prisma } from "@prisma/client";

interface InvoiceForPdf {
  number: number;
  status: string;
  createdAt: Date;
  subtotal: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
  client: { name: string; documentId: string | null; email: string | null; phone: string | null };
  user: { name: string; email: string };
  items: Array<{
    quantity: number;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    product: { name: string; sku: string };
  }>;
}

export function streamInvoicePdf(invoice: InvoiceForPdf, res: Response): void {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=factura-${invoice.number}.pdf`);

  doc.pipe(res);

  doc.fontSize(20).text("Factura", { align: "right" });
  doc.fontSize(10).text(`N° ${invoice.number}`, { align: "right" });
  doc.text(`Estado: ${invoice.status}`, { align: "right" });
  doc.text(`Fecha: ${invoice.createdAt.toISOString()}`, { align: "right" });
  doc.moveDown();

  doc.fontSize(12).text("Cliente:");
  doc.fontSize(10).text(invoice.client.name);
  if (invoice.client.documentId) doc.text(`Documento: ${invoice.client.documentId}`);
  if (invoice.client.email) doc.text(`Email: ${invoice.client.email}`);
  if (invoice.client.phone) doc.text(`Teléfono: ${invoice.client.phone}`);
  doc.moveDown();

  doc.fontSize(10).text(`Vendedor: ${invoice.user.name} (${invoice.user.email})`);
  doc.moveDown();

  doc.fontSize(12).text("Detalle:");
  doc.moveDown(0.5);

  const tableTop = doc.y;
  doc.fontSize(10);
  doc.text("Producto", 50, tableTop);
  doc.text("SKU", 220, tableTop);
  doc.text("Cant.", 300, tableTop);
  doc.text("P. Unit.", 360, tableTop);
  doc.text("Subtotal", 440, tableTop);
  doc.moveDown();

  invoice.items.forEach((item) => {
    const y = doc.y;
    doc.text(item.product.name, 50, y);
    doc.text(item.product.sku, 220, y);
    doc.text(String(item.quantity), 300, y);
    doc.text(item.unitPrice.toFixed(2), 360, y);
    doc.text(item.subtotal.toFixed(2), 440, y);
    doc.moveDown();
  });

  doc.moveDown();
  doc.fontSize(11).text(`Subtotal: ${invoice.subtotal.toFixed(2)}`, { align: "right" });
  doc.text(`Impuesto: ${invoice.tax.toFixed(2)}`, { align: "right" });
  doc.fontSize(13).text(`Total: ${invoice.total.toFixed(2)}`, { align: "right" });

  doc.end();
}
