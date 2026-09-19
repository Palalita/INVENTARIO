// Esquemas Zod de validación para el body de las rutas de auth, conectados
// vía el middleware `validate()` en auth.routes.ts.
import { z } from "zod";

// No valida la fortaleza de la contraseña aquí a propósito: es el body del
// LOGIN, no del registro — solo se comprueba que no venga vacía; la
// comparación real contra el hash guardado la hace auth.service.ts.
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida")
});

// Tipo TypeScript derivado automáticamente del esquema Zod — así el tipo y
// la validación en runtime nunca se desincronizan.
export type LoginInput = z.infer<typeof loginSchema>;
