"use client";

import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/invoice-calculations";
import { cn } from "@/lib/utils";

// Forma de una línea de factura EN EDICIÓN (antes de guardarla) — no es el
// mismo tipo que InvoiceItem de lib/types.ts, que es cómo la devuelve la API
// una vez creada la factura.
export interface InvoiceLine {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  availableStock: number;
  quantity: number;
}

interface InvoiceLineItemsProps {
  lines: InvoiceLine[];
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  insufficientStockIds?: Set<string>;
}

// Tabla editable de líneas de la factura que se está armando (pantalla
// "nueva factura"): cantidad editable por fila, subtotal calculado al vuelo,
// y resaltado en rojo si `insufficientStockIds` marca esa línea sin stock
// suficiente (se calcula en la página, comparando contra el stock disponible).
export function InvoiceLineItems({
  lines,
  onQuantityChange,
  onRemove,
  insufficientStockIds,
}: InvoiceLineItemsProps) {
  if (lines.length === 0) {
    return (
      <EmptyState
        title="Sin productos agregados"
        description="Busca un producto arriba y agrégalo a la factura."
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="w-28">Cantidad</TableHead>
            <TableHead className="text-right">Precio unit.</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
            <TableHead className="w-1" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const hasIssue = insufficientStockIds?.has(line.productId);
            return (
              <TableRow key={line.productId} className={cn(hasIssue && "bg-destructive/5")}>
                <TableCell>
                  <p className="font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">{line.sku}</p>
                  {hasIssue && (
                    <p className="text-xs font-medium text-destructive">
                      Stock insuficiente (disponible: {line.availableStock})
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    max={line.availableStock}
                    value={line.quantity}
                    aria-invalid={hasIssue}
                    onChange={(e) =>
                      onQuantityChange(
                        line.productId,
                        Math.min(line.availableStock, Math.max(1, Number(e.target.value) || 1))
                      )
                    }
                    className={cn("h-8 w-20", hasIssue && "border-destructive")}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(line.unitPrice)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(line.unitPrice * line.quantity)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar producto"
                    onClick={() => onRemove(line.productId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
