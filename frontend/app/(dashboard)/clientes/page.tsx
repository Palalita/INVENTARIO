"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ClientTable } from "@/components/clients/client-table";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback";
import { useClients } from "@/lib/hooks/use-clients";
import { useAuthStore } from "@/lib/stores/auth-store";

const PAGE_SIZE = 10;

export default function ClientesPage() {
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const clients = useClients({ search, page, pageSize: PAGE_SIZE });

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, 350);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Directorio de clientes</p>
        </div>
        <ClientFormDialog />
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o documento..."
          className="pl-8"
          onChange={(e) => debouncedSearch(e.target.value)}
        />
      </div>

      <ClientTable
        clients={clients.data?.data ?? []}
        isLoading={clients.isLoading}
        isError={clients.isError}
        onRetry={() => clients.refetch()}
        isAdmin={isAdmin}
      />

      {clients.data && (
        <PaginationBar
          page={clients.data.page}
          pageSize={clients.data.pageSize}
          total={clients.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
