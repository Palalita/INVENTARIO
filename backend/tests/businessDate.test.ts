import { describe, expect, it } from "vitest";
import { formatBusinessDateTime } from "../src/utils/businessDate";

describe("formatBusinessDateTime", () => {
  it("muestra el día de calendario de Guatemala, no el de UTC, para una venta de noche", () => {
    // 2026-09-23T02:30:00Z son las 20:30 del 22 de septiembre en Guatemala
    // (UTC-6). Un toISOString() crudo mostraría "23" — el bug real que este
    // helper corrige en el PDF de factura y el CSV de reporte de ventas.
    const lateNightUtc = new Date("2026-09-23T02:30:00.000Z");

    const formatted = formatBusinessDateTime(lateNightUtc);

    expect(formatted).toContain("22/09/2026");
    expect(formatted).not.toContain("23/09/2026");
  });

  it("no se desfasa para una hora que ya cae del mismo lado en ambas zonas", () => {
    // 2026-01-15T15:00:00Z son las 09:00 del 15 de enero en Guatemala —
    // mismo día de calendario en UTC y en hora de Guatemala, así que sirve
    // como control de que el helper no introduce un desfase en el otro
    // sentido.
    const morningUtc = new Date("2026-01-15T15:00:00.000Z");

    expect(formatBusinessDateTime(morningUtc)).toContain("15/01/2026");
  });
});
