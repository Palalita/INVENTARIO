import { proxyAuthRequest } from "../_proxy";

// Nunca cachear ni prerenderizar: cada login es una petición nueva con su
// propio resultado.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyAuthRequest(request, "/auth/login");
}
