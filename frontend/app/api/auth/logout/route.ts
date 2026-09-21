import { proxyAuthRequest } from "../_proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyAuthRequest(request, "/auth/logout");
}
