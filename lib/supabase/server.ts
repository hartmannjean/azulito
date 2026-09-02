import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase para uso em Server Components, Route Handlers e Server
 * Actions. Usa a chave anônima (respeita RLS) e propaga a sessão do usuário
 * via cookies — é este client que deve ser usado para qualquer leitura/escrita
 * feita "em nome do usuário logado".
 *
 * Não usar para operações que precisam ignorar RLS (isso é o que
 * `lib/supabase/admin.ts` existe para fazer, de forma explícita e isolada).
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
            // podem ser escritos aqui. Isso é seguro de ignorar porque o
            // middleware (lib/supabase/middleware.ts) já cuida de refrescar
            // a sessão em cada request.
          }
        },
      },
    },
  );
}
