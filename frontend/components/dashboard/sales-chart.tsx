"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/invoice-calculations";
import type { SalesReportRow } from "@/lib/types";

interface SalesChartProps {
  data: SalesReportRow[] | undefined;
  isLoading: boolean;
}

interface TooltipPayloadItem {
  value: number;
  payload: { label: string; total: number; invoiceCount: number };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-popover-foreground">{point.label}</p>
      <p className="text-muted-foreground">{formatCurrency(point.total)}</p>
      <p className="text-xs text-muted-foreground">
        {point.invoiceCount} {point.invoiceCount === 1 ? "factura" : "facturas"}
      </p>
    </div>
  );
}

export function SalesChart({ data, isLoading }: SalesChartProps) {
  const chartData = (data ?? []).map((row) => ({
    label: format(parseISO(row.date), "d MMM", { locale: es }),
    total: Number(row.total),
    invoiceCount: row.invoiceCount,
  }));

  const hasData = chartData.some((row) => row.total > 0);

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle>Ventas — últimos 14 días</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : !hasData ? (
          <EmptyState title="Sin ventas en este período" description="Cuando registres facturas verás la tendencia aquí." />
        ) : (
          <ResponsiveContainer width="100%" height={288}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                tickFormatter={(value: number) =>
                  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`
                }
              />
              <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
              <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
