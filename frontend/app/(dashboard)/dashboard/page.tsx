"use client";

import dynamic from "next/dynamic";
import { AlertTriangle, DollarSign, Package, Receipt } from "lucide-react";
import { subDays, format } from "date-fns";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TopProductsTable } from "@/components/dashboard/top-products-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StockBadge } from "@/components/common/status-badge";
import { useDashboardSummary, useSalesReport } from "@/lib/hooks/use-dashboard";
import { formatCurrency } from "@/lib/invoice-calculations";

// recharts arrastra su propio bundle (D3 debajo); se carga solo cuando el
// dashboard se monta en el cliente, en vez de sumarse al bundle inicial.
const SalesChart = dynamic(
  () => import("@/components/dashboard/sales-chart").then((m) => m.SalesChart),
  { ssr: false, loading: () => <Skeleton className="col-span-full h-96 lg:col-span-2" /> }
);

export default function DashboardPage() {
  const summary = useDashboardSummary();

  const to = format(new Date(), "yyyy-MM-dd");
  const from = format(subDays(new Date(), 13), "yyyy-MM-dd");
  const salesReport = useSalesReport(from, to);

  if (summary.isError) {
    return (
      <ErrorState
        message="No se pudo cargar el dashboard"
        onRetry={() => summary.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen general del negocio</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas hoy"
          value={formatCurrency(summary.data?.salesToday ?? 0)}
          icon={DollarSign}
          isLoading={summary.isLoading}
        />
        <KpiCard
          label="Ventas del mes"
          value={formatCurrency(summary.data?.salesMonth ?? 0)}
          icon={DollarSign}
          isLoading={summary.isLoading}
        />
        <KpiCard
          label="Facturas del mes"
          value={String(summary.data?.invoiceCountMonth ?? 0)}
          icon={Receipt}
          isLoading={summary.isLoading}
        />
        <KpiCard
          label="Productos con stock bajo"
          value={String(summary.data?.lowStockProducts.length ?? 0)}
          icon={Package}
          tone={summary.data && summary.data.lowStockProducts.length > 0 ? "warning" : "default"}
          isLoading={summary.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SalesChart data={salesReport.data} isLoading={salesReport.isLoading} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Stock bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-9 w-full animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : !summary.data || summary.data.lowStockProducts.length === 0 ? (
              <EmptyState title="Todo en orden" description="Ningún producto está por debajo de su stock mínimo." />
            ) : (
              <ul className="space-y-3">
                {summary.data.lowStockProducts.slice(0, 6).map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <StockBadge stock={product.stock} minStock={product.minStock} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <TopProductsTable products={summary.data?.topProducts} isLoading={summary.isLoading} />
    </div>
  );
}
