import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get<{ data: Category[] }>("/categories");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
