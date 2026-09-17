import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CreateProductPayload,
  CreateStockMovementPayload,
  PaginatedResponse,
  Product,
  StockMovement,
  UpdateProductPayload,
} from "@/lib/types";

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Product>>("/products", {
        params: {
          search: filters.search || undefined,
          categoryId: filters.categoryId || undefined,
          lowStock: filters.lowStock || undefined,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
        },
      });
      return data;
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateProductPayload) => {
      const { data } = await api.post<{ product: Product }>("/products", payload);
      return data.product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateProductPayload }) => {
      const { data } = await api.patch<{ product: Product }>(`/products/${id}`, payload);
      return data.product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useStockMovements(productId: string | undefined, page: number) {
  return useQuery({
    queryKey: ["stock-movements", productId, page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<StockMovement>>(
        `/products/${productId}/movements`,
        { params: { page } }
      );
      return data;
    },
    enabled: Boolean(productId),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateStockMovement(productId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateStockMovementPayload) => {
      const { data } = await api.post<{ movement: StockMovement }>(
        `/products/${productId}/movements`,
        payload
      );
      return data.movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
