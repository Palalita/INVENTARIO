import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(150),
  nit: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  address: z.string().max(250).optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
