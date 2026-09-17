"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { getApiErrorMessage } from "@/lib/api";
import { useDeleteProductImage, useUploadProductImage } from "@/lib/hooks/use-products";
import type { Product } from "@/lib/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface ProductImageFieldProps {
  product: Product;
}

export function ProductImageField({ product }: ProductImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const uploadImage = useUploadProductImage();
  const deleteImage = useDeleteProductImage();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Solo se permiten imágenes JPEG, PNG o WEBP");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("La imagen no puede superar 5MB");
      return;
    }

    uploadImage.mutate(
      { id: product.id, file },
      {
        onSuccess: () => toast.success("Imagen actualizada"),
        onError: (error) => toast.error(getApiErrorMessage(error, "No se pudo subir la imagen")),
      }
    );
  }

  async function handleRemove() {
    try {
      await deleteImage.mutateAsync(product.id);
      toast.success("Imagen eliminada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar la imagen"));
    }
  }

  const isBusy = uploadImage.isPending || deleteImage.isPending;

  return (
    <div className="space-y-1.5">
      <Label>Imagen</Label>
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa (R2), dominio dinámico según el bucket de cada instalación
            <img src={product.imageUrl} alt={product.name} className="size-full object-cover" />
          ) : (
            <ImageOff className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
          >
            {uploadImage.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {product.imageUrl ? "Cambiar" : "Subir imagen"}
          </Button>
          {product.imageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              onClick={() => setConfirmRemoveOpen(true)}
            >
              <Trash2 className="size-4" />
              Quitar
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">JPEG, PNG o WEBP, máximo 5MB.</p>

      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title="Quitar imagen"
        description={`¿Quitar la imagen de "${product.name}"?`}
        confirmLabel="Quitar"
        onConfirm={handleRemove}
      />
    </div>
  );
}
