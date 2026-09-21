import { z } from "zod";

// `from`/`to` se dejan como string (no z.string().date() ni z.coerce.date())
// a propósito: dashboard.service.ts los parsea a mano con startOfLocalDay()
// para interpretarlos en la zona horaria del negocio, no en UTC — ver el
// comentario detallado en dashboard.service.ts. El regex sí valida el
// formato exacto "YYYY-MM-DD": sin esto, un valor no numérico (`?from=abc`)
// llega a `dateStr.split("-").map(Number)` como NaN y termina en un 500
// genérico de Postgres en vez de un 400 de validación claro.
const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Debe tener el formato YYYY-MM-DD");

export const salesReportQuerySchema = z.object({
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  format: z.enum(["json", "csv"]).default("json")
});

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;
