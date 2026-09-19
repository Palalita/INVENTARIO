"use client";

import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/layout/app-shell";

// Layout de TODAS las rutas autenticadas (dashboard, productos, clientes,
// facturas, usuarios): exige sesión válida (AuthGuard) y las envuelve en el
// shell con sidebar/header (AppShell).
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
