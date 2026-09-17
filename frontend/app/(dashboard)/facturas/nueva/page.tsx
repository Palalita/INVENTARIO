"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ClientCombobox } from "@/components/invoices/client-combobox";
import { ProductAutocomplete } from "@/components/invoices/product-autocomplete";
import { InvoiceLineItems, type InvoiceLine } from "@/components/invoices/invoice-line-items";
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from "@/lib/api";
import { useCreateInvoice } from "@/lib/hooks/use-invoices";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoice-calculations";
import type { Client, Product } from "@/lib/types";

export default function NuevaFacturaPage() {
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [insufficientStockIds, setInsufficientStockIds] = useState<Set<string>>(new Set());

  const createInvoice = useCreateInvoice();

  const totals = useMemo(
    () => calculateInvoiceTotals(lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice }))),
    [lines]
  );

  function handleAddProduct(product: Product) {
    setInsufficientStockIds(new Set());
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: Math.min(l.quantity + 1, product.stock) }
            : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: Number(product.price),
          availableStock: product.stock,
          quantity: 1,
        },
      ];
    });
  }

  function handleQuantityChange(productId: string, quantity: number) {
    setInsufficientStockIds(new Set());
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)));
  }

  function handleRemove(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
    setInsufficientStockIds((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  }

  async function handleSubmit() {
    if (!client || lines.length === 0) return;

    try {
      const invoice = await createInvoice.mutateAsync({
        clientId: client.id,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      });
      toast.success(`Factura #${invoice.number} creada`);
      router.push(`/facturas/${invoice.id}`);
    } catch (error) {
      const code = getApiErrorCode(error);
      if (code === "INSUFFICIENT_STOCK") {
        const details = getApiErrorDetails(error) ?? [];
        setInsufficientStockIds(new Set(details.map((d) => d.productId)));
        toast.error(
          "Stock insuficiente: " +
            details
              .map((d) => {
                const line = lines.find((l) => l.productId === d.productId);
                return `${line?.name ?? d.productId} (disponible: ${d.available}, solicitado: ${d.requested})`;
              })
              .join("; ")
        );
      } else {
        toast.error(getApiErrorMessage(error, "No se pudo crear la factura"));
      }
    }
  }

  const canSubmit = Boolean(client) && lines.length > 0 && !createInvoice.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva factura</h1>
        <p className="text-sm text-muted-foreground">Selecciona el cliente y agrega los productos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientCombobox value={client} onSelect={setClient} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Agregar producto</Label>
            <ProductAutocomplete
              onSelect={handleAddProduct}
              excludeIds={lines.map((l) => l.productId)}
            />
          </div>

          <InvoiceLineItems
            lines={lines}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemove}
            insufficientStockIds={insufficientStockIds}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Impuesto (12%)</span>
            <span className="tabular-nums">{formatCurrency(totals.tax)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(totals.total)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/facturas")}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {createInvoice.isPending && <Loader2 className="size-4 animate-spin" />}
          Crear factura
        </Button>
      </div>
    </div>
  );
}
