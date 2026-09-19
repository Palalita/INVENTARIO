import { Boxes } from "lucide-react";

// Layout del grupo de rutas (auth) — hoy solo /login. Panel izquierdo
// decorativo (oculto en pantallas chicas) + el formulario a la derecha.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <div className="relative hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Boxes className="size-6" />
          Inventario
        </div>

        <div className="max-w-sm space-y-3">
          <p className="text-3xl font-semibold leading-snug text-balance">
            Controla tu inventario y factura sin complicarte.
          </p>
          <p className="text-primary-foreground/75">
            Productos, clientes y facturas en un solo lugar.
          </p>
        </div>

        <p className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Inventario y Facturación
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
