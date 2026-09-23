import { z } from "zod";

// `lowStock` llega como el string "true"/"false" en la query (nunca un
// boolean real en una URL), por eso se acepta ese literal exacto y se
// transforma a boolean real para el resto del código.
export const listProductsQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  lowStock: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

// `cost` (costo de compra, para calcular margen) y `stock`/`minStock` tienen
// default 0: se puede dar de alta un producto sin existencias todavía y
// ajustarlas después vía stock-movements.
//
// max(9_999_999_999.99) en price/cost: mismo tratamiento que ya se le dio a
// `quantity` en createInvoiceSchema/createMovementSchema — las columnas son
// Decimal(12,2) (ver schema.prisma), así que un valor fuera de ese rango
// (ej. un typo con un dígito de más) no cae en ningún código de Prisma que
// errorHandler.ts clasifique y terminaba en un 500 genérico en vez de un
// 400 de validación claro.
export const createProductSchema = z.object({
  sku: z.string().min(1, "El SKU es requerido"),
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  price: z.coerce.number().nonnegative().max(9_999_999_999.99, "Precio demasiado grande"),
  cost: z.coerce.number().nonnegative().max(9_999_999_999.99, "Costo demasiado grande").default(0),
  stock: z.coerce.number().int().nonnegative().default(0),
  minStock: z.coerce.number().int().nonnegative().default(0)
});

// `stock` NO está aquí a propósito (a diferencia de createProductSchema, que
// sí lo acepta como saldo inicial de un producto nuevo): stock-movements.ts
// es "el único camino oficial para cambiar Product.stock con trazabilidad"
// (ver su comentario de cabecera), y antes este PATCH permitía sobrescribir
// el stock de un producto YA EXISTENTE como un valor absoluto, sin crear
// ningún StockMovement ni usar el patrón atómico (increment/decrement
// condicionado) que el resto del código usa religiosamente para tocar
// stock. Eso rompía la trazabilidad auditable ("el número cambió pero no
// hay ninguna fila que explique por qué") y, al ser una escritura absoluta
// en vez de condicional, podía pisar una venta concurrente (lost update).
export const updateProductSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  price: z.coerce.number().nonnegative().max(9_999_999_999.99, "Precio demasiado grande").optional(),
  cost: z.coerce.number().nonnegative().max(9_999_999_999.99, "Costo demasiado grande").optional(),
  minStock: z.coerce.number().int().nonnegative().optional(),
  active: z.boolean().optional()
});

export const idParamSchema = z.object({
  id: z.string().uuid("Id inválido")
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
