"use client";

import { useState } from "react";
import { RequireAdmin } from "@/components/require-admin";
import { PaginationBar } from "@/components/common/pagination-bar";
import { UserTable } from "@/components/users/user-table";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { useUsers } from "@/lib/hooks/use-users";
import { useAuthStore } from "@/lib/stores/auth-store";

const PAGE_SIZE = 10;

// Ruta /usuarios: gestión de cuentas del sistema, envuelta en RequireAdmin
// (un VENDEDOR que entre directo a esta URL es redirigido a /dashboard).
export default function UsuariosPage() {
  const [page, setPage] = useState(1);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const users = useUsers({ page, pageSize: PAGE_SIZE });

  return (
    <RequireAdmin>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
            <p className="text-sm text-muted-foreground">
              Administradores y vendedores con acceso al sistema
            </p>
          </div>
          <UserFormDialog />
        </div>

        <UserTable
          users={users.data?.data ?? []}
          isLoading={users.isLoading}
          isError={users.isError}
          onRetry={() => users.refetch()}
          currentUserId={currentUserId}
        />

        {users.data && (
          <PaginationBar
            page={users.data.page}
            pageSize={users.data.pageSize}
            total={users.data.total}
            onPageChange={setPage}
          />
        )}
      </div>
    </RequireAdmin>
  );
}
