import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware central de auth. Toda página e toda rota de API (exceto as
 * listadas como públicas dentro de `updateSession`/PUBLIC_PATHS e o webhook
 * da Pluggy, que é autenticado por assinatura, não por sessão) passa por
 * aqui antes de qualquer handler rodar. Isso evita que cada API route tenha
 * que reimplementar sua própria checagem de sessão de forma inconsistente.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, exceto assets estáticos do Next — esses nunca precisam
     * de checagem de sessão e rodar o middleware neles só adiciona latência.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
