"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Ban, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import { InvoiceStatusBadge } from "@/components/common/status-badge";
import { getApiErrorMessage } from "@/lib/api";
import { useCancelInvoice, useInvoice, downloadInvoicePdf } from "@/lib/hooks/use-invoices";
import { formatCurrency } from "@/lib/invoice-calculations";
import { useAuthStore } from "@/lib/stores/auth-store";

// Ruta /facturas/[id]: detalle de solo lectura de una factura, con acciones
// de descargar PDF y (solo ADMIN, solo si sigue EMITIDA) anular.
export default function FacturaDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
  const [isDownloading, setIsDownloading] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const { data: invoice, isLoading, isError, refetch } = useInvoice(params.id);
  const cancelInvoice = useCancelInvoice();

  // Descarga el PDF de la factura (ver downloadInvoicePdf en use-invoices.ts).
  async function handleDownload() {
    if (!invoice) return;
    setIsDownloading(true);
    try {
      await downloadInvoicePdf(invoice.id, invoice.number);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo descargar el PDF"));
    } finally {
      setIsDownloading(false);
    }
  }

  // Anula la factura confirmada en el ConfirmDialog de abajo (el backend
  // repone el stock de los productos vendidos).
  async function handleCancel() {
    if (!invoice) return;
    try {
      await cancelInvoice.mutateAsync(invoice.id);
      toast.success("Factura anulada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo anular la factura"));
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !invoice) {
    return <ErrorState message="No se pudo cargar la factura" onRetry={() => refetch()} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" aria-label="Volver" onClick={() => router.push("/facturas")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Factura #{invoice.number}</h1>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(invoice.createdAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
          </p>
          {invoice.status === "ANULADA" && invoice.cancelledAt && (
            <p className="text-xs text-destructive">
              Anulada por {invoice.cancelledBy?.name ?? "—"} el{" "}
              {format(parseISO(invoice.cancelledAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
            </p>
          )}
        </div>
        <div className="ml-auto">
          <InvoiceStatusBadge status={invoice.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Nombre: </span>
            {invoice.client?.name ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">NIT: </span>
            {invoice.client?.nit ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Correo: </span>
            {invoice.client?.email ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Teléfono: </span>
            {invoice.client?.phone ?? "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.product?.name ?? "Producto eliminado"}</p>
                    <p className="text-xs text-muted-foreground">{item.product?.sku}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(item.subtotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="space-y-2 px-4 pb-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Impuesto</span>
              <span className="tabular-nums">{formatCurrency(invoice.tax)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        {isAdmin && invoice.status === "EMITIDA" && (
          <Button
            variant="destructive"
            onClick={() => setConfirmCancelOpen(true)}
            disabled={cancelInvoice.isPending}
          >
            {cancelInvoice.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Ban className="size-4" />
            )}
            Anular factura
          </Button>
        )}
        <Button variant="outline" onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Descargar PDF
        </Button>
      </div>

      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title={`¿Anular la factura #${invoice.number}?`}
        description="Esta acción repone el stock de los productos incluidos y no se puede deshacer."
        confirmLabel="Anular factura"
        onConfirm={handleCancel}
      />
    </div>
  );
}
