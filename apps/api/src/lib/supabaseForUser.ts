import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase escopado ao usuário autenticado: usa a chave ANÔNIMA (não
 * a service role) e anexa o access token do usuário — validado em
 * `requireAuth` (middleware/auth.ts) — no header Authorization de toda
 * chamada ao PostgREST. Isso faz o Supabase aplicar RLS normalmente, como se
 * a query tivesse vindo de um client autenticado comum.
 *
 * Esta é a peça que preserva o RLS mesmo com backend e frontend separados:
 * NUNCA usar o client admin (service role, que ignora RLS) para atender uma
 * requisição feita diretamente por um usuário logado — só para os fluxos
 * sem sessão (webhook/sync da Pluggy), que usam `createAdminClient`.
 */
export function createUserScopedClient(accessToken: string) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL ou SUPABASE_ANON_KEY não configurados.");
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
