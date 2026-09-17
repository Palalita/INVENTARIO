"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Boxes className="size-6" />
        </div>
        <CardTitle className="text-xl">Inventario y Facturación</CardTitle>
        <CardDescription>Ingresa con tus credenciales para continuar</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </CardContent>
    </Card>
  );
}
