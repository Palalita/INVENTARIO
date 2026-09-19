import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, SalesReportRow } from "@/lib/types";

// KPIs del dashboard: ventas de hoy/mes, facturas del mes, productos con
// stock bajo y top 5 productos más vendidos. Se refresca solo cada 5 min
// para que los números no queden desactualizados si el usuario deja la
// pestaña abierta mucho tiempo.
export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const { data } = await api.get<DashboardSummary>("/dashboard/summary");
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

// Serie de ventas por día en un rango de fechas — alimenta el gráfico de
// barras "Ventas — últimos 14 días" del dashboard.
export function useSalesReport(from: string, to: string) {
  return useQuery({
    queryKey: ["sales-report", from, to],
    queryFn: async () => {
      const { data } = await api.get<{ data: SalesReportRow[] }>("/dashboard/sales-report", {
        params: { from, to, format: "json" },
      });
      return data.data;
    },
  });
}
