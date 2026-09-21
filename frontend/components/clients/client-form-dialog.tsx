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
import { getApiErrorMessage } from "@/lib/api";
import { useCreateClient, useUpdateClient } from "@/lib/hooks/use-clients";
import { clientSchema, type ClientFormValues } from "@/lib/schemas/client";
import type { Client } from "@/lib/types";

interface ClientFormDialogProps {
  client?: Client;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: (client: Client) => void;
  hideTrigger?: boolean;
  initialName?: string;
}

// Modal de crear/editar cliente. Puede usarse "standalone" (con su propio
// trigger y estado open interno) o controlado desde afuera (`open`/
// `onOpenChange`, como hace el combobox de cliente al crear uno al vuelo
// dentro del flujo de nueva factura — ver client-combobox.tsx).
export function ClientFormDialog({
  client,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSuccess,
  hideTrigger,
  initialName,
}: ClientFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const isEdit = Boolean(client);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", nit: "", email: "", phone: "", address: "" },
  });

  // Al abrir el modal, carga los datos del cliente a editar (o los valores
  // por defecto/`initialName` si es uno nuevo). Las dependencias se limitan
  // a `open` a propósito: este dialog puede abrirse de forma controlada
  // desde afuera (ver client-combobox.tsx), así que si el efecto también
  // reaccionara a `client`/`initialName`, una revalidación en segundo plano
  // de la lista de clientes mientras el modal sigue abierto dispararía un
  // reset y borraría lo que el usuario esté escribiendo.
  useEffect(() => {
    if (open) {
      reset({
        name: client?.name ?? initialName ?? "",
        nit: client?.nit ?? "",
        email: client?.email ?? "",
        phone: client?.phone ?? "",
        address: client?.address ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isSubmitting = createClient.isPending || updateClient.isPending;

  // Crea o actualiza el cliente según `isEdit`, cierra el modal, y en modo
  // creación avisa al padre (`onSuccess`) con el cliente recién creado —
  // usado para autoseleccionarlo en el combobox de factura nueva.
  async function onSubmit(values: ClientFormValues) {
    const payload = {
      name: values.name,
      nit: values.nit || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: values.address || undefined,
    };

    try {
      if (isEdit && client) {
        await updateClient.mutateAsync({ id: client.id, payload });
        toast.success("Cliente actualizado");
        setOpen(false);
      } else {
        const created = await createClient.mutateAsync(payload);
        toast.success("Cliente creado");
        setOpen(false);
        onSuccess?.(created);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar el cliente"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button size="sm">
                <Plus className="size-4" />
                Nuevo cliente
              </Button>
            )
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nit">NIT</Label>
              <Input id="nit" placeholder="CF" {...register("nit")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" {...register("phone")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Dirección</Label>
            <Input id="address" {...register("address")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
