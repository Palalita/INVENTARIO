"use client";

import { Pencil } from "lucide-react";
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
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ActiveBadge, RoleBadge } from "@/components/common/status-badge";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import type { User } from "@/lib/types";

interface UserTableProps {
  users: User[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  currentUserId?: string;
}

export function UserTable({ users, isLoading, isError, onRetry, currentUserId }: UserTableProps) {
  if (isError) {
    return <ErrorState message="No se pudieron cargar los usuarios" onRetry={onRetry} />;
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm shadow-foreground/5 ring-1 ring-foreground/[0.06]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-1 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="p-0">
                <EmptyState
                  title="No hay usuarios"
                  description="Crea el primer usuario para tu equipo."
                />
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            users.map((user) => (
              <TableRow key={user.id} className={!user.active ? "opacity-50" : undefined}>
                <TableCell className="font-medium">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(tú)</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <ActiveBadge active={user.active} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <UserFormDialog
                      user={user}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Editar usuario">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
