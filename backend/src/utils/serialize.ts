import { Prisma } from "@prisma/client";

const SENSITIVE_KEYS = new Set(["passwordHash", "tokenHash"]);

/**
 * Recorre recursivamente un valor (objeto Prisma, array, etc.) y:
 * - Convierte instancias de Prisma.Decimal a string con 2 decimales
 *   (evita floating point en montos, según api-contract.md).
 * - Elimina campos sensibles (passwordHash, tokenHash) para que nunca
 *   se filtren en las respuestas HTTP.
 */
export function serialize<T>(value: T): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Prisma.Decimal) {
    return value.toFixed(2);
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serialize(item));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) continue;
      out[key] = serialize(val);
    }
    return out;
  }

  return value;
}
