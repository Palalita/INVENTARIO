import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreateUserPayload, PaginatedResponse, UpdateUserPayload, User } from "@/lib/types";

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
