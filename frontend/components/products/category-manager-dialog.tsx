"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, FolderCog, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/lib/hooks/use-categories";
import type { Category } from "@/lib/types";

// Modal de administración de categorías: crear, renombrar inline (edición
// en la misma fila) y eliminar. Es autocontenido — no recibe props, hace su
// propio fetch de categorías vía useCategories(). Se abre desde la página
// de Productos con el botón "Categorías".
export function CategoryManagerDialog() {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const categories = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  // Crea la categoría escrita en el input de arriba (o no hace nada si está vacío).
  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createCategory.mutateAsync(name);
      setNewName("");
      toast.success("Categoría creada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear la categoría"));
    }
  }

  // Activa el modo edición inline para una categoría (reemplaza su texto por un input).
  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditingName(category.name);
  }

  // Guarda el nuevo nombre de la categoría en edición.
  async function saveEdit() {
    const name = editingName.trim();
    if (!editingId || !name) return;
    try {
      await updateCategory.mutateAsync({ id: editingId, name });
      toast.success("Categoría actualizada");
      setEditingId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar la categoría"));
    }
  }

  // Elimina la categoría confirmada en el ConfirmDialog de abajo.
  async function handleDelete(category: Category) {
    try {
      await deleteCategory.mutateAsync(category.id);
      toast.success("Categoría eliminada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar la categoría"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <FolderCog className="size-4" />
            Categorías
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestionar categorías</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Nombre de la categoría..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <Button
            onClick={handleCreate}
            disabled={createCategory.isPending || !newName.trim()}
          >
            {createCategory.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Agregar
          </Button>
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border p-1">
          {categories.isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}

          {!categories.isLoading && (categories.data ?? []).length === 0 && (
            <EmptyState title="Sin categorías" description="Agrega la primera arriba." />
          )}

          {!categories.isLoading &&
            (categories.data ?? []).map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                {editingId === category.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-8"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Guardar"
                      onClick={saveEdit}
                      disabled={updateCategory.isPending}
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Cancelar"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{category.name}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar categoría"
                      onClick={() => startEdit(category)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar categoría"
                      onClick={() => setCategoryToDelete(category)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={categoryToDelete !== null}
        onOpenChange={(value) => !value && setCategoryToDelete(null)}
        title="Eliminar categoría"
        description={
          categoryToDelete
            ? `¿Eliminar "${categoryToDelete.name}"? Los productos que la usan quedarán sin categoría.`
            : ""
        }
        confirmLabel="Eliminar"
        onConfirm={() => categoryToDelete && handleDelete(categoryToDelete)}
      />
    </Dialog>
  );
}
