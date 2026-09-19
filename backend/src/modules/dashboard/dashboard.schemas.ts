import { z } from "zod";

// `from`/`to` se dejan como string simple (no z.string().date() ni
// z.coerce.date()) a propósito: dashboard.service.ts los parsea a mano con
// startOfLocalDay() para interpretarlos en la zona horaria del negocio, no
// en UTC — ver el comentario detallado en dashboard.service.ts.
export const salesReportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(["json", "csv"]).default("json")
});

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;
