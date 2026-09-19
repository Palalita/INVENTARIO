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

// Lista paginada de productos, con búsqueda/filtro por categoría/stock bajo.
// `placeholderData` mantiene la página anterior visible mientras carga la
// nueva (evita el parpadeo al cambiar de página o escribir en el buscador).
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

// Crea un producto. Al terminar, invalida la caché de "products" para que
// la tabla se refresque sola con el nuevo producto incluido.
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

// Actualiza campos de un producto existente (nombre, precio, categoría, etc).
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

// Borra (soft-delete en el backend, marca `active: false`) un producto.
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

// Sube la imagen de un producto ya existente (multipart/form-data). El
// backend la guarda en Cloudflare R2 y devuelve el producto con `imageUrl`.
export function useUploadProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await api.post<{ product: Product }>(`/products/${id}/image`, formData);
      return data.product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// Quita la imagen de un producto (borra el archivo en R2 del lado del backend).
export function useDeleteProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<{ product: Product }>(`/products/${id}/image`);
      return data.product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// Historial paginado de movimientos de stock (entradas/salidas/ajustes) de
// un producto. `enabled` evita disparar la query si aún no hay productId.
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

// Registra un movimiento de stock manual (ENTRADA/SALIDA/AJUSTE). Invalida
// tanto el historial de movimientos como la lista de productos, porque esto
// cambia el `stock` mostrado en la tabla.
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
