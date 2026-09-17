"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, ImageOff, Pencil, Trash2 } from "lucide-react";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StockBadge } from "@/components/common/status-badge";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { StockMovementDialog } from "@/components/products/stock-movement-dialog";
import { getApiErrorMessage } from "@/lib/api";
import { useDeleteProduct } from "@/lib/hooks/use-products";
import { formatCurrency } from "@/lib/invoice-calculations";
import type { Product } from "@/lib/types";

interface ProductTableProps {
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isAdmin: boolean;
}

export function ProductTable({ products, isLoading, isError, onRetry, isAdmin }: ProductTableProps) {
  const deleteProduct = useDeleteProduct();
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  async function handleDelete(product: Product) {
    try {
      await deleteProduct.mutateAsync(product.id);
      toast.success("Producto desactivado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo desactivar el producto"));
    }
  }

  if (isError) {
    return <ErrorState message="No se pudieron cargar los productos" onRetry={onRetry} />;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1"></TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="w-1 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && products.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="p-0">
                <EmptyState
                  title="No hay productos"
                  description="Ajusta los filtros o crea el primer producto del catálogo."
                />
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            products.map((product) => (
              <TableRow key={product.id} className={!product.active ? "opacity-50" : undefined}>
                <TableCell>
                  <div className="flex size-9 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL externa (R2), dominio dinámico según el bucket de cada instalación
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageOff className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                <TableCell>
                  <p className="font-medium">{product.name}</p>
                  {!product.active && (
                    <p className="text-xs text-muted-foreground">Inactivo</p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {product.category?.name ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(product.price)}
                </TableCell>
                <TableCell className="text-right">
                  <StockBadge stock={product.stock} minStock={product.minStock} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <StockMovementDialog
                      product={product}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Movimiento de stock">
                          <ArrowLeftRight className="size-4" />
                        </Button>
                      }
                    />
                    {isAdmin && (
                      <>
                        <ProductFormDialog
                          product={product}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Editar producto">
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Desactivar producto"
                          onClick={() => setProductToDelete(product)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={productToDelete !== null}
        onOpenChange={(open) => !open && setProductToDelete(null)}
        title="Desactivar producto"
        description={
          productToDelete
            ? `¿Desactivar el producto "${productToDelete.name}"? Dejará de aparecer en el catálogo activo.`
            : ""
        }
        confirmLabel="Desactivar"
        onConfirm={() => productToDelete && handleDelete(productToDelete)}
      />
    </div>
  );
}
