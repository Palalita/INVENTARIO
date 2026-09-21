"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { InvoiceStatusBadge } from "@/components/common/status-badge";
import { TableHeaderRow } from "@/components/common/table-header-row";
import { formatCurrency } from "@/lib/invoice-calculations";
import type { Invoice } from "@/lib/types";

interface InvoiceTableProps {
  invoices: Invoice[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

// Tabla de facturas (solo lectura, sin editar/borrar — una factura emitida
// no se modifica, se anula). El botón de ojo navega al detalle de la factura.
export function InvoiceTable({ invoices, isLoading, isError, onRetry }: InvoiceTableProps) {
  if (isError) {
    return <ErrorState message="No se pudieron cargar las facturas" onRetry={onRetry} />;
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm shadow-foreground/5 ring-1 ring-foreground/[0.06]">
      <Table>
        <TableHeaderRow
          columns={[
            { label: "N°" },
            { label: "Cliente" },
            { label: "Fecha" },
            { label: "Estado" },
            { label: "Total", className: "text-right" },
            { label: "Acciones", className: "w-1 text-right" },
          ]}
        />
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Ver factura"
                    render={<Link href={`/facturas/${invoice.id}`} />}
                    nativeButton={false}
                  >
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
