import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase para uso em Client Components. Usa apenas a URL pública e
 * a chave anônima. Hoje nenhum componente client-side faz uma chamada direta
 * a ele (login/cadastro são Server Actions, dados vêm de apps/api) — existe
 * como a metade "browser" do padrão oficial `@supabase/ssr`, pronta para o
 * dia em que algo precisar rodar autenticado direto no client (ex: uma
 * subscription de Realtime).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
