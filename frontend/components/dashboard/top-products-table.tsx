import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/invoice-calculations";
import type { DashboardTopProduct } from "@/lib/types";

interface TopProductsTableProps {
  products: DashboardTopProduct[] | undefined;
  isLoading: boolean;
}

export function TopProductsTable({ products, isLoading }: TopProductsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 productos más vendidos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !products || products.length === 0 ? (
          <EmptyState title="Sin datos aún" description="Aparecerán los productos más vendidos del mes." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.productId}>
                  <TableCell>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{product.quantitySold}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(product.totalSold)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
