"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Boxes,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  UserCog,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout as apiLogout } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/productos", label: "Productos", icon: Package, adminOnly: false },
  { href: "/clientes", label: "Clientes", icon: Users, adminOnly: false },
  { href: "/facturas", label: "Facturas", icon: Receipt, adminOnly: false },
  { href: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
];

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: typeof NAV_ITEMS;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function getCurrentNavItem(pathname: string) {
  return (
    NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ??
    NAV_ITEMS[0]
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.role === "ADMIN";
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const currentNavItem = getCurrentNavItem(pathname);
  const CurrentIcon = currentNavItem.icon;

  async function handleLogout() {
    await apiLogout();
    clearSession();
    toast.success("Sesión cerrada");
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <Boxes className="size-5 text-primary" />
          Inventario
        </div>
        <NavLinks items={visibleNavItems} pathname={pathname} />
        <div className="border-t p-3 text-xs text-muted-foreground">
          <p className="truncate font-medium text-foreground">{user?.name}</p>
          <p className="truncate">{user?.role === "ADMIN" ? "Administrador" : "Vendedor"}</p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú" />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0">
              <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
                <Boxes className="size-5 text-primary" />
                Inventario
              </div>
              <NavLinks
                items={visibleNavItems}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 font-medium">
            <CurrentIcon className="size-4 text-primary" />
            {currentNavItem.label}
          </div>

          <div className="flex-1" />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar size="sm">
                    <AvatarFallback>{user ? initials(user.name) : "?"}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate sm:inline">{user?.name}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <p className="truncate font-medium text-foreground">{user?.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {user?.role === "ADMIN" ? "Administrador" : "Vendedor"} · {user?.email}
                  </p>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="size-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
