import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CreateInvoicePayload,
  Invoice,
  InvoiceStatus,
  PaginatedResponse,
} from "@/lib/types";

export interface InvoiceFilters {
  from?: string;
  to?: string;
  status?: InvoiceStatus | "TODAS";
  page?: number;
  pageSize?: number;
}

// Lista paginada de facturas, filtrable por rango de fechas y estado
// (EMITIDA/ANULADA/TODAS).
export function useInvoices(filters: InvoiceFilters) {
  return useQuery({
    queryKey: ["invoices", filters],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Invoice>>("/invoices", {
        params: {
          from: filters.from || undefined,
          to: filters.to || undefined,
          status: filters.status && filters.status !== "TODAS" ? filters.status : undefined,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 10,
        },
      });
      return data;
    },
    placeholderData: (previousData) => previousData,
  });
}

// Detalle de una factura puntual (usado en la pantalla de ver factura).
export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data } = await api.get<{ invoice: Invoice }>(`/invoices/${id}`);
      return data.invoice;
    },
    enabled: Boolean(id),
  });
}

// Crea una factura (el backend descuenta stock y calcula subtotal/impuesto/
// total). Invalida facturas, productos (cambió el stock) y el resumen del
// dashboard (cambian las ventas del día/mes).
export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateInvoicePayload) => {
      const { data } = await api.post<{ invoice: Invoice }>("/invoices", payload);
      return data.invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

// Anula una factura (el backend repone el stock de los productos vendidos).
export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<{ invoice: Invoice }>(`/invoices/${id}/cancel`);
      return data.invoice;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

// Descarga el PDF de una factura: pide el binario a la API (responseType
// "blob"), arma un link temporal con un Object URL, lo "clickea" desde JS
// para que el navegador dispare la descarga, y limpia todo después.
export async function downloadInvoicePdf(id: string, invoiceNumber: number) {
  const response = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `factura-${invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
