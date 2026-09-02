import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp } from "@/lib/csp";

/**
 * Middleware central de auth + CSP. Toda página e toda rota de API (exceto
 * as listadas como públicas dentro de `updateSession`/PUBLIC_PATHS) passa
 * por aqui antes de qualquer handler rodar. Isso evita que cada API route
 * reimplemente sua própria checagem de sessão de forma inconsistente.
 *
 * A CSP é montada aqui (não em next.config.js) porque depende de um nonce
 * gerado por requisição — é a forma de ter `script-src`/`style-src`
 * restritos sem precisar de `'unsafe-inline'`. Os demais headers de
 * segurança (que não variam por request) ficam em next.config.js.
 */
export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NEXT_PUBLIC_SUPABASE_URL);

  const response = await updateSession(request, nonce);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, exceto assets estáticos do Next — esses nunca precisam
     * de checagem de sessão/CSP dinâmica e rodar o middleware neles só
     * adiciona latência.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
