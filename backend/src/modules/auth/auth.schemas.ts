// Esquemas Zod de validación para el body de las rutas de auth, conectados
// vía el middleware `validate()` en auth.routes.ts.
import { z } from "zod";

// No valida la fortaleza de la contraseña aquí a propósito: es el body del
// LOGIN, no del registro — solo se comprueba que no venga vacía; la
// comparación real contra el hash guardado la hace auth.service.ts.
// trim + lowercase: el email se guarda normalizado así en users.schemas.ts,
// y el lookup en auth.service.ts es un match exacto — sin esto, un usuario
// que teclea su email con mayúsculas distintas a como se creó la cuenta (ej.
// el teclado de un celular capitalizando la primera letra) no podría iniciar
// sesión aunque la contraseña sea correcta.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida")
});

// Tipo TypeScript derivado automáticamente del esquema Zod — así el tipo y
// la validación en runtime nunca se desincronizan.
export type LoginInput = z.infer<typeof loginSchema>;
