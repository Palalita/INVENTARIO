import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { serialize } from "../../utils/serialize";
import * as dashboardService from "./dashboard.service";
import { SalesReportQuery } from "./dashboard.schemas";

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await dashboardService.getSummary({ id: req.user!.sub, role: req.user!.role });
  res.status(200).json(serialize(summary));
});

export const getSalesReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as SalesReportQuery;
  const rows = await dashboardService.getSalesReport(query, { id: req.user!.sub, role: req.user!.role });

  if (query.format === "csv") {
    const serialized = serialize(rows) as Array<Record<string, unknown>>;
    const csv = dashboardService.toCsv(serialized);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=reporte-ventas.csv");
    res.status(200).send(csv);
    return;
  }

  res.status(200).json(serialize({ data: rows }));
});
