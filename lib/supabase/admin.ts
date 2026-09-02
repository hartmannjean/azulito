import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase com a service role key — IGNORA RLS.
 *
 * `import "server-only"` faz o build falhar se este módulo for importado,
 * direta ou indiretamente, por qualquer código que possa acabar no bundle do
 * client. Isso é intencional: a service role key nunca pode chegar ao browser.
 *
 * Uso permitido apenas em fluxos sem uma sessão de usuário no request (webhook
 * da Pluggy, job de sync/polling) que precisam gravar dados em nome do
 * usuário dono de uma `bank_connection`. Qualquer rota que atenda uma
 * requisição feita diretamente pelo usuário logado deve usar
 * `lib/supabase/server.ts`, que respeita RLS.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL não configurados.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
