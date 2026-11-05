import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

/**
 * Monta a CSP por request (nonce único) para PÁGINAS (renomeado de
 * `middleware.ts` para `proxy.ts`, convenção atual do Next.js 16).
 *
 * Também faz uma checagem OTIMISTA de login: /dash/* sem cookie de sessão vai
 * direto para /login (só UX, evita renderizar à toa). Isto NÃO é a barreira de
 * segurança — o cookie aqui nem é validado. A validação real acontece na
 * apps/api (via `getSession()` no layout e em toda chamada de dados), e cada
 * Server Action revalida a sessão.
 */
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?azulito\.session_token=/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    (pathname === "/dash" || pathname.startsWith("/dash/")) &&
    !SESSION_COOKIE.test(request.headers.get("cookie") ?? "")
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", buildCsp(nonce, { turnstile: pathname === "/login" || pathname === "/cadastro" }));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
