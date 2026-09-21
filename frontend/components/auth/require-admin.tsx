"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

// Protege páginas completas exclusivas de admin (a diferencia de isAdmin, que
// solo oculta botones dentro de una página compartida). Un vendedor que entre
// a la URL directo es redirigido a /dashboard en vez de ver la pantalla.
//
// A diferencia de auth-guard.tsx, esto se queda 100% client-side a
// propósito: el middleware solo puede ver si existe la cookie de sesión, no
// el rol del usuario (el rol vive en el access token, que solo existe en
// memoria del navegador, nunca en una cookie legible por el servidor). Se
// podría exponer el rol en una cookie extra desde el proxy de login/refresh,
// pero es un cambio de contrato con el backend que no vale la pena solo para
// evitar el parpadeo de esta pantalla — la autorización real ya la hace el
// backend en cada request, esto es únicamente UX.
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);

  useEffect(() => {
    if (role && role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [role, router]);

  if (role !== "ADMIN") {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
