"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { MovementTypeBadge } from "@/components/common/status-badge";
import { getApiErrorMessage } from "@/lib/api";
import { useCreateStockMovement, useStockMovements } from "@/lib/hooks/use-products";
import { stockMovementSchema, type StockMovementFormValues } from "@/lib/schemas/product";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Product } from "@/lib/types";

interface StockMovementDialogProps {
  product: Product;
  trigger?: React.ReactElement;
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
};

export function StockMovementDialog({ product, trigger }: StockMovementDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("movimiento");
  const [page, setPage] = useState(1);
  const role = useAuthStore((state) => state.user?.role);

  const history = useStockMovements(open ? product.id : undefined, page);
  const createMovement = useCreateStockMovement(product.id);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StockMovementFormValues>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: { type: "ENTRADA", quantity: 1, reason: "" },
  });

  async function onSubmit(values: StockMovementFormValues) {
    try {
      await createMovement.mutateAsync({
        type: values.type,
        quantity: values.quantity,
        reason: values.reason || undefined,
      });
      toast.success("Movimiento registrado");
      reset({ type: "ENTRADA", quantity: 1, reason: "" });
      setTab("historial");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el movimiento"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setTab("movimiento");
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <ArrowLeftRight className="size-4" />
              Stock
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Movimientos de stock — {product.name}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="movimiento" className="flex-1">
              Registrar movimiento
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex-1">
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="movimiento" className="space-y-4 pt-2">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={watch("type")}
                  onValueChange={(value) =>
                    setValue("type", value as StockMovementFormValues["type"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => MOVEMENT_TYPE_LABELS[value] ?? value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTRADA">Entrada</SelectItem>
                    <SelectItem value="SALIDA">Salida</SelectItem>
                    {role === "ADMIN" && <SelectItem value="AJUSTE">Ajuste</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quantity">Cantidad</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  aria-invalid={Boolean(errors.quantity)}
                  {...register("quantity")}
                />
                {errors.quantity && (
                  <p className="text-sm text-destructive">{errors.quantity.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">Motivo (opcional)</Label>
                <Textarea id="reason" rows={2} {...register("reason")} />
              </div>

              <p className="text-xs text-muted-foreground">
                Stock actual: <span className="font-medium text-foreground">{product.stock}</span>
              </p>

              <Button type="submit" className="w-full" disabled={createMovement.isPending}>
                {createMovement.isPending && <Loader2 className="size-4 animate-spin" />}
                Registrar movimiento
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="historial" className="pt-2">
            {history.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-9 w-full animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : history.isError ? (
              <ErrorState onRetry={() => history.refetch()} />
            ) : !history.data || history.data.data.length === 0 ? (
              <EmptyState title="Sin movimientos registrados" />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.data.data.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {format(parseISO(movement.createdAt), "d MMM yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <MovementTypeBadge type={movement.type} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{movement.quantity}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                          {movement.reason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationBar
                  page={history.data.page}
                  pageSize={history.data.pageSize}
                  total={history.data.total}
                  onPageChange={setPage}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
