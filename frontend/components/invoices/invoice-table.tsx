"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { InvoiceStatusBadge } from "@/components/common/status-badge";
import { formatCurrency } from "@/lib/invoice-calculations";
import type { Invoice } from "@/lib/types";

interface InvoiceTableProps {
  invoices: Invoice[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function InvoiceTable({ invoices, isLoading, isError, onRetry }: InvoiceTableProps) {
  if (isError) {
    return <ErrorState message="No se pudieron cargar las facturas" onRetry={onRetry} />;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N°</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-1 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && invoices.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="p-0">
                <EmptyState title="No hay facturas" description="Ajusta los filtros o crea una nueva factura." />
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-mono text-sm">#{invoice.number}</TableCell>
                <TableCell>{invoice.client?.name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(parseISO(invoice.createdAt), "d MMM yyyy", { locale: es })}
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={invoice.status} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" aria-label="Ver factura" render={<Link href={`/facturas/${invoice.id}`} />}>
                    <Eye className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
