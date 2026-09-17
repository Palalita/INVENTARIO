"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { login, getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { LoginFormValues } from "@/lib/schemas/auth";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: LoginFormValues) {
    setIsSubmitting(true);
    try {
      const { user, accessToken } = await login(values.email, values.password);
      setSession(user, accessToken);
      toast.success(`Bienvenido, ${user.name}`);
      router.replace("/dashboard");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo iniciar sesión"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground lg:hidden">
          <Boxes className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventario y Facturación</h1>
          <p className="text-muted-foreground">Ingresa con tus credenciales para continuar</p>
        </div>
      </div>

      <LoginForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
