import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InvoiceStatus, MovementType, Role } from "@/lib/types";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const isCancelled = status === "ANULADA";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        isCancelled
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      )}
    >
      {isCancelled ? "Anulada" : "Emitida"}
    </Badge>
  );
}

export function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  const isLow = stock <= minStock;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium tabular-nums",
        isLow
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-border bg-muted text-foreground"
      )}
    >
      {stock} {isLow && "· stock bajo"}
    </Badge>
  );
}

const MOVEMENT_LABELS: Record<MovementType, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
};

export function MovementTypeBadge({ type }: { type: MovementType }) {
  const styles: Record<MovementType, string> = {
    ENTRADA: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    SALIDA: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    AJUSTE: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", styles[type])}>
      {MOVEMENT_LABELS[type]}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const isAdmin = role === "ADMIN";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        isAdmin
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted text-foreground"
      )}
    >
      {isAdmin ? "Administrador" : "Vendedor"}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {active ? "Activo" : "Inactivo"}
    </Badge>
  );
}
