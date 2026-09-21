import { z } from "zod";
import { calendarDateSchema } from "../../utils/businessDate";

// `from`/`to` se dejan como string (no z.string().date() ni z.coerce.date())
// a propósito: dashboard.service.ts los parsea a mano con startOfLocalDay()
// para interpretarlos en la zona horaria del negocio, no en UTC — ver el
// comentario detallado en utils/businessDate.ts.
export const salesReportQuerySchema = z.object({
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
  format: z.enum(["json", "csv"]).default("json")
});

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;
