// Pure calculation helpers for the "nueva factura" flow. Kept dependency-free so
// they can be unit tested in isolation (see tests/invoice-calculations.test.ts).

export const DEFAULT_TAX_RATE = 0.12;

export interface InvoiceLineInput {
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  total: number;
}

/** Rounds to 2 decimals avoiding common floating point artifacts (e.g. 0.1 + 0.2). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLineSubtotal(line: InvoiceLineInput): number {
  const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
  const unitPrice = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
  return round2(quantity * unitPrice);
}

/**
 * Computes subtotal / tax / total for a set of invoice lines.
 * Mirrors the backend calculation described in 02-prd.md (5.4): subtotal is the sum
 * of quantity*unitPrice per line, tax is `taxRate` applied on top (default 12%).
 */
export function calculateInvoiceTotals(
  lines: InvoiceLineInput[],
  taxRate: number = DEFAULT_TAX_RATE
): InvoiceTotals {
  const subtotal = round2(
    lines.reduce((sum, line) => sum + calculateLineSubtotal(line), 0)
  );
  const tax = round2(subtotal * taxRate);
  const total = round2(subtotal + tax);

  return { subtotal, tax, total };
}

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  minimumFractionDigits: 2,
});

export function formatCurrency(amount: number | string): string {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(numeric)) return "Q0.00";
  return currencyFormatter.format(numeric);
}
