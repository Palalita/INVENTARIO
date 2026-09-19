import { z } from "zod";

// Validación del form de crear/editar usuario (user-form-dialog.tsx, solo ADMIN).
export const userFormSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(150),
  email: z.string().email("Correo inválido"),
  // Solo obligatoria al crear; en edición no se muestra el campo y se ignora.
  password: z.string().min(8, "Mínimo 8 caracteres").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "VENDEDOR"]),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
