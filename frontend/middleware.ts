import { NextRequest, NextResponse } from "next/server";

// Nombre exacto de la cookie que pone el backend (ver
// backend/src/modules/auth/auth.controller.ts). Ahora que login/refresh
// pasan por app/api/auth/* (mismo dominio que este middleware), el
// navegador sí la manda aquí — antes vivía en el dominio de Railway y este
// middleware nunca la veía.
const SESSION_COOKIE_NAME = "refreshToken";

const PROTECTED_PREFIXES = ["/dashboard", "/productos", "/clientes", "/facturas", "/usuarios"];

// Redirige en el servidor, antes de mandar cualquier HTML/JS al navegador:
// evita el parpadeo de "cargando" que había antes con router.replace() en
// un useEffect. Es un chequeo de PRESENCIA de la cookie, no de validez — el
// refresh token es un string opaco, no un JWT, así que no se puede decodificar
// aquí sin llamar al backend. Si la cookie existe pero ya no es válida
// (revocada, expirada), AuthGuard lo detecta client-side al intentar
// refrescar la sesión y redirige como último recurso — ese caso sí sigue
// siendo client-side a propósito, porque solo se puede saber después de la
// llamada de red.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/dashboard" : "/login", request.url));
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/productos/:path*",
    "/clientes/:path*",
    "/facturas/:path*",
    "/usuarios/:path*"
  ]
};
