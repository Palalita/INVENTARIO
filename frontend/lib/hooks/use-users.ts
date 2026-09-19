import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreateUserPayload, PaginatedResponse, UpdateUserPayload, User } from "@/lib/types";

// Hooks para /users — gestión de usuarios del sistema (empleados). Solo
// tiene sentido para ADMIN; el backend rechaza estas rutas para VENDEDOR.

// Lista paginada de usuarios.
export function useUsers(params: { page: number; pageSize?: number }) {
  return useQuery({
    queryKey: ["users", params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<User>>("/users", {
        params: { page: params.page, pageSize: params.pageSize ?? 10 },
      });
      return data;
    },
    placeholderData: (previousData) => previousData,
  });
}

// Crea un usuario nuevo (define su email, password inicial y rol).
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const { data } = await api.post<{ user: User }>("/users", payload);
      return data.user;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

// Actualiza un usuario: nombre, rol, o activarlo/desactivarlo (desactivarlo
// le impide iniciar sesión sin borrar su historial).
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateUserPayload }) => {
      const { data } = await api.patch<{ user: User }>(`/users/${id}`, payload);
      return data.user;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
