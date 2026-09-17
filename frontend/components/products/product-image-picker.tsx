"use client";

import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { ImageOff, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface ProductImagePickerProps {
  file: File | null;
  onChange: (file: File | null) => void;
}

// Selector de imagen para productos que todavía no existen (no hay id al que
// subir el archivo). Guarda el File en memoria; quien use este componente
// decide cuándo subirlo de verdad (después de crear el producto).
export function ProductImagePicker({ file, onChange }: ProductImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      toast.error("Solo se permiten imágenes JPEG, PNG o WEBP");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error("La imagen no puede superar 5MB");
      return;
    }
    onChange(selected);
  }

  return (
    <div className="space-y-1.5">
      <Label>Imagen</Label>
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no una URL remota
            <img src={previewUrl} alt="" className="size-full object-cover" />
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
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" />
            {file ? "Cambiar" : "Seleccionar imagen"}
          </Button>
          {file && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="size-4" />
              Quitar
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG o WEBP, máximo 5MB. Se sube al guardar el producto.
      </p>
    </div>
  );
}
