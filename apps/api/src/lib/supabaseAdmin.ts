import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase com a service role key — IGNORA RLS.
 *
 * Uso permitido apenas em fluxos sem uma sessão de usuário no request
 * (webhook da Pluggy, job de sync/polling) que precisam gravar dados em nome
 * do usuário dono de uma `bank_connection`. Qualquer rota que atenda uma
 * requisição feita diretamente pelo usuário logado deve usar
 * `createUserScopedClient` (lib/supabaseForUser.ts), que respeita RLS.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL não configurados.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
