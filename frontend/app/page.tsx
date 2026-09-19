"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Ruta raíz ("/"): no muestra nada, solo redirige a /dashboard. Ver la
// explicación de por qué esto es client-side (no server-side) en auth-guard.tsx.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
}
