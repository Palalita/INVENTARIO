"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { TableHeaderRow } from "@/components/common/table-header-row";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { getApiErrorMessage } from "@/lib/api";
import { useDeleteClient } from "@/lib/hooks/use-clients";
import type { Client } from "@/lib/types";

interface ClientTableProps {
  clients: Client[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isAdmin: boolean;
}

// Tabla de clientes con edición inline (modal) y borrado con confirmación.
// El botón de eliminar solo aparece para ADMIN (`isAdmin`); el fetch/paginado
// vive en la página que la usa (app/(dashboard)/clientes/page.tsx).
export function ClientTable({ clients, isLoading, isError, onRetry, isAdmin }: ClientTableProps) {
  const deleteClient = useDeleteClient();
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // Borra el cliente elegido en el ConfirmDialog de abajo.
  async function handleDelete(client: Client) {
    try {
      await deleteClient.mutateAsync(client.id);
      toast.success("Cliente eliminado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el cliente"));
    }
  }

  if (isError) {
    return <ErrorState message="No se pudieron cargar los clientes" onRetry={onRetry} />;
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm shadow-foreground/5 ring-1 ring-foreground/[0.06]">
      <Table>
        <TableHeaderRow
          columns={[
            { label: "Nombre" },
            { label: "NIT" },
            { label: "Correo" },
            { label: "Teléfono" },
            { label: "Acciones", className: "w-1 text-right" },
          ]}
        />
        <TableBody>
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && clients.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="p-0">
                <EmptyState title="No hay clientes" description="Crea el primer cliente para empezar a facturar." />
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {client.nit ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{client.email ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{client.phone ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <ClientFormDialog
                      client={client}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Editar cliente">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eliminar cliente"
                        onClick={() => setClientToDelete(client)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={clientToDelete !== null}
        onOpenChange={(open) => !open && setClientToDelete(null)}
        title="Eliminar cliente"
        description={
          clientToDelete ? `¿Eliminar al cliente "${clientToDelete.name}"? Esta acción no se puede deshacer.` : ""
        }
        confirmLabel="Eliminar"
        onConfirm={() => clientToDelete && handleDelete(clientToDelete)}
      />
    </div>
  );
}
