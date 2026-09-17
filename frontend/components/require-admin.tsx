"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

// Protege páginas completas exclusivas de admin (a diferencia de isAdmin, que
// solo oculta botones dentro de una página compartida). Un vendedor que entre
// a la URL directo es redirigido a /dashboard en vez de ver la pantalla.
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
