import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root explicitly: the user's home directory (outside this
  // git repo) has a stray package-lock.json that would otherwise confuse
  // Turbopack's root inference.
  turbopack: {
    root: path.join(__dirname),
  },
  // helmet() en el backend protege las respuestas JSON de la API, pero no
  // el HTML que sirve Next.js en Vercel (login, dashboard, facturas, etc.).
  // Sin estos headers, la app es embebible en un <iframe> de un sitio
  // malicioso (clickjacking/UI-redress — ej. superponer una capa
  // transparente sobre "Anular factura" para engañar a un admin logueado).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
