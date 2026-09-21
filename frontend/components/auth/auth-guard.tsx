"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { bootstrapSession } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth-store";

// Protege las páginas del panel. El middleware (ver middleware.ts) ya
// redirigió a /login en el servidor si no había cookie de sesión, así que en
// el caso normal este componente arranca sabiendo que sí hay una sesión por
// confirmar. Aun así necesita esta capa client-side: la cookie solo prueba
// que "hubo" una sesión, no que siga siendo válida (pudo revocarse, expirar
// del lado del backend, etc.), y eso solo se sabe después de intentar
// refrescarla. El router.replace("/login") de abajo es ese fallback — un
// caso raro, no el camino principal como antes de tener el middleware.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (useAuthStore.getState().user) {
        setChecking(false);
        return;
      }
      const resolvedUser = await bootstrapSession();
      if (cancelled) return;
      if (!resolvedUser) {
        router.replace("/login");
      }
      setChecking(false);
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
