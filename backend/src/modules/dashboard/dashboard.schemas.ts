import { z } from "zod";

export const salesReportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(["json", "csv"]).default("json")
});

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;
