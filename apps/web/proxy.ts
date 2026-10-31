import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

/**
 * Monta a CSP por request (nonce único) para PÁGINAS (renomeado de
 * `middleware.ts` para `proxy.ts`, convenção atual do Next.js 16). O gate de
 * acesso NÃO mora aqui: quem protege o app é o Cloudflare Access na borda, e
 * cada página/Server Action verifica o JWT de novo via `getAccess()`
 * (lib/access.ts). Este app não tem rotas de API próprias (isso mora em
 * apps/api).
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
