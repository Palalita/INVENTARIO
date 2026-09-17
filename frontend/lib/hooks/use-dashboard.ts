import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, SalesReportRow } from "@/lib/types";

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
