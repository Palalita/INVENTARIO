import { z } from "zod";

// Validación del form de crear/editar cliente (client-form-dialog.tsx).
// Todos los campos salvo `name` son opcionales (o string vacío, por eso el
// `.or(z.literal(""))`: un input vacío en el form manda "", no undefined).
export const clientSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(150),
  nit: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  address: z.string().max(250).optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
