import { describe, expect, it } from "vitest";
import {
  calculateInvoiceTotals,
  calculateLineSubtotal,
  round2,
} from "@/lib/invoice-calculations";

describe("round2", () => {
  it("avoids common floating point artifacts", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(19.99 * 3)).toBe(59.97);
  });
});

describe("calculateLineSubtotal", () => {
  it("multiplies quantity by unit price", () => {
    expect(calculateLineSubtotal({ quantity: 3, unitPrice: 10.5 })).toBe(31.5);
  });

  it("treats non-finite inputs as zero", () => {
    expect(calculateLineSubtotal({ quantity: NaN, unitPrice: 10 })).toBe(0);
  });
});

describe("calculateInvoiceTotals", () => {
  it("computes subtotal, tax (default 12%) and total for multiple lines", () => {
    const totals = calculateInvoiceTotals([
      { quantity: 2, unitPrice: 50 }, // 100
      { quantity: 1, unitPrice: 25.5 }, // 25.5
    ]);

    expect(totals.subtotal).toBe(125.5);
    expect(totals.tax).toBe(15.06);
    expect(totals.total).toBe(140.56);
  });

  it("returns zeros for an empty invoice", () => {
    expect(calculateInvoiceTotals([])).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });

  it("supports a custom tax rate", () => {
    const totals = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], 0.05);
    expect(totals).toEqual({ subtotal: 100, tax: 5, total: 105 });
  });
});
