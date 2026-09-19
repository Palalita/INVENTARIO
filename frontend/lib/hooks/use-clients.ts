import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Client,
  CreateClientPayload,
  PaginatedResponse,
  UpdateClientPayload,
} from "@/lib/types";

export interface ClientFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

// Lista paginada de clientes, con búsqueda por nombre/NIT.
export function useClients(filters: ClientFilters) {
  return useQuery({
    queryKey: ["clients", filters],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Client>>("/clients", {
        params: {
          search: filters.search || undefined,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
        },
      });
      return data;
    },
    placeholderData: (previousData) => previousData,
  });
}

// Crea un cliente nuevo.
export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateClientPayload) => {
      const { data } = await api.post<{ client: Client }>("/clients", payload);
      return data.client;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

// Actualiza los datos de un cliente existente.
export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateClientPayload }) => {
      const { data } = await api.patch<{ client: Client }>(`/clients/${id}`, payload);
      return data.client;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

// Elimina un cliente.
export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clients/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}
