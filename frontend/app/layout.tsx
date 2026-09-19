import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inventario y Facturación",
  description: "Sistema de inventario y facturación",
};

// Layout raíz de toda la app (envuelve absolutamente todas las rutas). Carga
// las fuentes y monta <Providers> (React Query, tema, toasts) una sola vez.
// `suppressHydrationWarning` es necesario porque next-themes ajusta la clase
// `dark`/`light` del <html> en el cliente antes de la hidratación.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
