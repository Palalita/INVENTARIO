"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationBar } from "@/components/common/pagination-bar";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { useInvoices, type InvoiceFilters } from "@/lib/hooks/use-invoices";

const PAGE_SIZE = 10;
const STATUS_LABELS: Record<string, string> = {
  TODAS: "Todas",
  EMITIDA: "Emitida",
  ANULADA: "Anulada",
};

export default function FacturasPage() {
  const [filters, setFilters] = useState<InvoiceFilters>({ status: "TODAS" });
  const [page, setPage] = useState(1);

  const invoices = useInvoices({ ...filters, page, pageSize: PAGE_SIZE });

  function updateFilter<K extends keyof InvoiceFilters>(key: K, value: InvoiceFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
          <p className="text-sm text-muted-foreground">Historial de facturación</p>
        </div>
        <Button render={<Link href="/facturas/nueva" />} nativeButton={false}>
          <Plus className="size-4" />
          Nueva factura
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="from">Desde</Label>
          <Input
            id="from"
            type="date"
            className="w-40"
            onChange={(e) => updateFilter("from", e.target.value || undefined)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">Hasta</Label>
          <Input
            id="to"
            type="date"
            className="w-40"
            onChange={(e) => updateFilter("to", e.target.value || undefined)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => updateFilter("status", (value as InvoiceFilters["status"]) ?? "TODAS")}
          >
            <SelectTrigger className="w-40">
              <SelectValue>{(value: string) => STATUS_LABELS[value] ?? "Todas"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="EMITIDA">Emitida</SelectItem>
              <SelectItem value="ANULADA">Anulada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <InvoiceTable
        invoices={invoices.data?.data ?? []}
        isLoading={invoices.isLoading}
        isError={invoices.isError}
        onRetry={() => invoices.refetch()}
      />

      {invoices.data && (
        <PaginationBar
          page={invoices.data.page}
          pageSize={invoices.data.pageSize}
          total={invoices.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
