import { z } from "zod";

// Validación del form de crear/editar producto (react-hook-form + zodResolver
// en product-form-dialog.tsx). `z.coerce.number` porque los <input type="number">
// entregan strings; Zod los convierte y valida en un solo paso.
export const productSchema = z.object({
  sku: z.string().min(1, "El SKU es obligatorio").max(50),
  name: z.string().min(1, "El nombre es obligatorio").max(150),
  description: z.string().max(500).optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  price: z.coerce.number({ message: "Precio inválido" }).nonnegative("Debe ser mayor o igual a 0"),
  stock: z.coerce.number({ message: "Stock inválido" }).int("Debe ser un número entero").min(0),
  minStock: z.coerce
    .number({ message: "Stock mínimo inválido" })
    .int("Debe ser un número entero")
    .min(0),
});

export type ProductFormValues = z.infer<typeof productSchema>;

// Validación del form de registrar un movimiento de stock manual
// (stock-movement-dialog.tsx).
export const stockMovementSchema = z.object({
  type: z.enum(["ENTRADA", "SALIDA", "AJUSTE"]),
  quantity: z.coerce.number({ message: "Cantidad inválida" }).int("Debe ser un número entero").positive("Debe ser mayor a 0"),
  reason: z.string().max(250).optional().or(z.literal("")),
});

export type StockMovementFormValues = z.infer<typeof stockMovementSchema>;
