import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp } from "@/lib/csp";

/**
 * Middleware central de auth + CSP para PÁGINAS (renomeado de `middleware.ts`
 * para `proxy.ts`, convenção atual do Next.js 16). Este app não tem rotas de
 * API próprias (isso mora em apps/api) — só faz gate de acesso às páginas do
 * dashboard e monta a CSP por request.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NEXT_PUBLIC_SUPABASE_URL);

  const response = await updateSession(request, nonce);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
