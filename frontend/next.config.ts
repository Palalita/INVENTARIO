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
    // Además de frame-ancestors (clickjacking), se restringen script-src/
    // object-src/base-uri como defensa en profundidad: hoy no hay ningún
    // XSS conocido en el código (sin dangerouslySetInnerHTML/eval/innerHTML
    // en todo el frontend), pero si alguna vez apareciera uno, esta política
    // limita qué puede hacer un script inyectado. 'unsafe-inline' en
    // script-src es necesario porque Next.js App Router inyecta scripts
    // inline pequeños para hidratar/bootstrapear la página — sin esto la
    // app no carga en absoluto. connect-src incluye el backend de Railway
    // (las llamadas a la API no pasan por next.config, van directo desde
    // el navegador).
    const backendOrigin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(
      /\/api\/v1\/?$/,
      ""
    );
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      `connect-src 'self' ${backendOrigin}`,
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'"
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
