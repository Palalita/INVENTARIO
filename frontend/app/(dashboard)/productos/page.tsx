"use client";

import { useState } from "react";
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ProductTable } from "@/components/products/product-table";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { useCategories } from "@/lib/hooks/use-categories";
import { useProducts } from "@/lib/hooks/use-products";
import { useAuthStore } from "@/lib/stores/auth-store";

const PAGE_SIZE = 10;
const ALL_CATEGORIES = "TODAS";

export default function ProductosPage() {
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);

  const categories = useCategories();
  const products = useProducts({
    search,
    categoryId: categoryId === ALL_CATEGORIES ? undefined : categoryId,
    lowStock,
    page,
    pageSize: PAGE_SIZE,
  });

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, 350);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">Catálogo e inventario</p>
        </div>
        {isAdmin && <ProductFormDialog />}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o SKU..."
            className="pl-8"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>

        <Select
          value={categoryId}
          onValueChange={(value) => {
            setCategoryId(value ?? ALL_CATEGORIES);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoría">
              {(value: string) =>
                value === ALL_CATEGORIES
                  ? "Todas las categorías"
                  : (categories.data ?? []).find((c) => c.id === value)?.name ?? "Categoría"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
            {(categories.data ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={lowStock ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setLowStock((prev) => !prev);
            setPage(1);
          }}
        >
          Solo stock bajo
        </Button>
      </div>

      <ProductTable
        products={products.data?.data ?? []}
        isLoading={products.isLoading}
        isError={products.isError}
        onRetry={() => products.refetch()}
        isAdmin={isAdmin}
      />

      {products.data && (
        <PaginationBar
          page={products.data.page}
          pageSize={products.data.pageSize}
          total={products.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
