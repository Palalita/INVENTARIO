import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductTable } from "@/components/products/product-table";
import type { Product } from "@/lib/types";

// Every resource hook in this app funnels through lib/api's `api` instance, so
// mocking it keeps this a pure component test with no real network calls.
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getApiErrorCode: () => undefined,
  getApiErrorDetails: () => undefined,
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sampleProduct: Product = {
  id: "1",
  sku: "SKU-1",
  name: "Producto de prueba",
  description: null,
  categoryId: null,
  category: null,
  price: "10.00",
  cost: "5.00",
  stock: 20,
  minStock: 5,
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("ProductTable", () => {
  it("renders skeleton placeholders while loading", () => {
    const { container } = renderWithProviders(
      <ProductTable products={[]} isLoading isError={false} onRetry={vi.fn()} isAdmin={false} />
    );

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText(/no hay productos/i)).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no products", () => {
    renderWithProviders(
      <ProductTable products={[]} isLoading={false} isError={false} onRetry={vi.fn()} isAdmin={false} />
    );

    expect(screen.getByText(/no hay productos/i)).toBeInTheDocument();
  });

  it("renders product rows when data is available", () => {
    renderWithProviders(
      <ProductTable
        products={[sampleProduct]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        isAdmin={false}
      />
    );

    expect(screen.getByText("Producto de prueba")).toBeInTheDocument();
    expect(screen.getByText("SKU-1")).toBeInTheDocument();
  });
});
