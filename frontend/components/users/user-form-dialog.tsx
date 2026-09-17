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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api";
import { useCreateUser, useUpdateUser } from "@/lib/hooks/use-users";
import { userFormSchema, type UserFormValues } from "@/lib/schemas/user";
import type { Role, User } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = { ADMIN: "Administrador", VENDEDOR: "Vendedor" };

interface UserFormDialogProps {
  user?: User;
  trigger?: React.ReactElement;
}

export function UserFormDialog({ user, trigger }: UserFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(true);
  const isEdit = Boolean(user);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: "", email: "", password: "", role: "VENDEDOR" },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: user?.name ?? "",
        email: user?.email ?? "",
        password: "",
        role: user?.role ?? "VENDEDOR",
      });
      setActive(user?.active ?? true);
    }
  }, [open, user, reset]);

  const isSubmitting = createUser.isPending || updateUser.isPending;

  async function onSubmit(values: UserFormValues) {
    if (!isEdit && !values.password) {
      toast.error("La contraseña es obligatoria");
      return;
    }

    try {
      if (isEdit && user) {
        await updateUser.mutateAsync({
          id: user.id,
          payload: { name: values.name, role: values.role, active },
        });
        toast.success("Usuario actualizado");
      } else {
        await createUser.mutateAsync({
          name: values.name,
          email: values.email,
          password: values.password as string,
          role: values.role,
        });
        toast.success("Usuario creado");
      }
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar el usuario"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="size-4" />
              Nuevo usuario
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              disabled={isEdit}
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            {isEdit && <p className="text-xs text-muted-foreground">El correo no se puede cambiar.</p>}
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          )}

          <div className={isEdit ? "grid grid-cols-2 gap-3" : undefined}>
            <div className="flex flex-col gap-1.5">
              <Label>Rol</Label>
              <Select
                value={watch("role")}
                onValueChange={(value) => setValue("role", value as Role)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => ROLE_LABELS[value as Role] ?? value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label>Estado</Label>
                <Select
                  value={active ? "true" : "false"}
                  onValueChange={(value) => setActive(value === "true")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => (value === "true" ? "Activo" : "Inactivo")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Activo</SelectItem>
                    <SelectItem value="false">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
