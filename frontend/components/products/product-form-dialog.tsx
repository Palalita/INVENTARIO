"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductImageField } from "@/components/products/product-image-field";
import { useCategories } from "@/lib/hooks/use-categories";
import { useCreateProduct, useUpdateProduct } from "@/lib/hooks/use-products";
import { getApiErrorMessage } from "@/lib/api";
import { productSchema, type ProductFormValues } from "@/lib/schemas/product";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductFormDialogProps {
  product?: Product;
  trigger?: React.ReactElement;
}

const NO_CATEGORY = "__sin_categoria__";

export function ProductFormDialog({ product, trigger }: ProductFormDialogProps) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(product);
  const categories = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      categoryId: "",
      price: 0,
      stock: 0,
      minStock: 0,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        sku: product?.sku ?? "",
        name: product?.name ?? "",
        description: product?.description ?? "",
        categoryId: product?.categoryId ?? "",
        price: product ? Number(product.price) : 0,
        stock: product?.stock ?? 0,
        minStock: product?.minStock ?? 0,
      });
    }
  }, [open, product, reset]);

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  async function onSubmit(values: ProductFormValues) {
    const basePayload = {
      sku: values.sku,
      name: values.name,
      description: values.description || undefined,
      categoryId: values.categoryId || null,
      price: values.price,
      minStock: values.minStock,
    };

    try {
      if (isEdit && product) {
        await updateProduct.mutateAsync({ id: product.id, payload: basePayload });
        toast.success("Producto actualizado");
      } else {
        await createProduct.mutateAsync({ ...basePayload, stock: values.stock });
        toast.success("Producto creado");
      }
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar el producto"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="size-4" />
              Nuevo producto
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>

        {isEdit && product ? (
          <ProductImageField product={product} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Podrás agregar una imagen después de crear el producto.
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" aria-invalid={Boolean(errors.sku)} {...register("sku")} />
              {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select
              value={watch("categoryId") || NO_CATEGORY}
              onValueChange={(value) =>
                setValue("categoryId", !value || value === NO_CATEGORY ? "" : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin categoría">
                  {(value: string) =>
                    value === NO_CATEGORY
                      ? "Sin categoría"
                      : (categories.data ?? []).find((c) => c.id === value)?.name ?? "Sin categoría"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                {(categories.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="price">Precio</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              aria-invalid={Boolean(errors.price)}
              className={cn(errors.price && "border-destructive")}
              {...register("price")}
            />
            {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stock">Stock inicial</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                disabled={isEdit}
                aria-invalid={Boolean(errors.stock)}
                className={cn(errors.stock && "border-destructive")}
                {...register("stock")}
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  Usa &quot;Movimiento de stock&quot; para ajustar existencias.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minStock">Stock mínimo</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                aria-invalid={Boolean(errors.minStock)}
                className={cn(errors.minStock && "border-destructive")}
                {...register("minStock")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
