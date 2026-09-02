import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase para uso em Server Components e Server Actions. Usa a
 * chave anônima e propaga a sessão via cookies. Neste app ele só cuida de
 * autenticação (login/cadastro/logout/sessão) — dados de negócio (transações,
 * conexões bancárias) vêm de `lib/api-client.ts`, que fala com apps/api.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` chamado a partir de um Server Component: cookies não
            // podem ser escritos aqui. Seguro de ignorar porque o middleware
            // (lib/supabase/middleware.ts) já cuida de refrescar a sessão em
            // cada request.
          }
        },
      },
    },
  );
}
