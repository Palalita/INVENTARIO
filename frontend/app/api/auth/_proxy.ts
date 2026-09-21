import { NextResponse } from "next/server";

// Prefijo "_" excluye este archivo del ruteo de Next.js (no es un endpoint).
//
// login/refresh/logout necesitan la cookie httpOnly de refresh, y esa cookie
// vive en el dominio del backend (Railway), distinto del frontend (Vercel) —
// el navegador nunca la manda entre dominios. Estas rutas actúan de
// "pasamanos": reciben la petición del navegador en el dominio del frontend,
// la reenvían al backend por detrás (fetch servidor-a-servidor, sin CORS de
// por medio), y devuelven la respuesta tal cual, incluyendo el Set-Cookie —
// que el navegador ahora ve viniendo del propio dominio del frontend. El
// resto de la API (productos, facturas, etc.) no pasa por aquí: sigue
// llamando a Railway directo con el access token en el header Authorization,
// que no depende de cookies ni de dominios.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function proxyAuthRequest(request: Request, backendPath: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const contentLength = request.headers.get("content-length");
  const hasBody = contentLength !== null && contentLength !== "0";
  const body = hasBody ? await request.text() : undefined;

  const backendResponse = await fetch(`${BACKEND_URL}${backendPath}`, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie
    },
    body
  });

  const responseBody = await backendResponse.text();
  const response = new NextResponse(responseBody || null, {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("content-type") ?? "application/json"
    }
  });

  // Un response de fetch puede traer varios Set-Cookie; getSetCookie() los
  // separa correctamente (a diferencia de headers.get(), que los uniría en
  // un solo string inválido). Cada uno se reenvía tal cual.
  for (const setCookie of backendResponse.headers.getSetCookie()) {
    response.headers.append("set-cookie", setCookie);
  }

  return response;
}
