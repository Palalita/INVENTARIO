// Types matching /Users/edgar/INVENTARIO/docs/api-contract.md and the Prisma schema
// documented in 03-architecture.md. Monetary amounts travel over the wire as decimal
// strings (e.g. "150.00") to avoid floating point issues, per the API contract.

export type Role = "ADMIN" | "VENDEDOR";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  price: string;
  cost: string;
  stock: number;
  minStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = "ENTRADA" | "SALIDA" | "AJUSTE";

export interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reason?: string | null;
  userId: string;
  user?: Pick<User, "id" | "name"> | null;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  nit?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
}

export type InvoiceStatus = "EMITIDA" | "ANULADA";

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  product?: Product | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export interface Invoice {
  id: string;
  number: number;
  clientId: string;
  client?: Client | null;
  userId: string;
  user?: Pick<User, "id" | "name"> | null;
  status: InvoiceStatus;
  subtotal: string;
  tax: string;
  total: string;
  createdAt: string;
  items: InvoiceItem[];
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ productId: string; available: number; requested: number }>;
  };
}

export interface DashboardTopProduct {
  productId: string;
  name: string;
  sku: string;
  quantitySold: number;
  totalSold: string;
}

export interface DashboardSummary {
  salesToday: string;
  salesMonth: string;
  invoiceCountMonth: number;
  lowStockProducts: Product[];
  topProducts: DashboardTopProduct[];
}

export interface SalesReportRow {
  date: string;
  invoiceCount: number;
  total: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
}

export interface CreateProductPayload {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  price: number;
  stock: number;
  minStock: number;
}

export type UpdateProductPayload = Partial<CreateProductPayload> & {
  active?: boolean;
};

export interface CreateStockMovementPayload {
  type: MovementType;
  quantity: number;
  reason?: string;
}

export interface CreateClientPayload {
  name: string;
  nit?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export type UpdateClientPayload = Partial<CreateClientPayload>;

export interface CreateInvoicePayload {
  clientId: string;
  items: Array<{ productId: string; quantity: number }>;
}
