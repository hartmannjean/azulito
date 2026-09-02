import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncConnectionTransactions } from "@/lib/pluggy/sync";

/**
 * GET /api/pluggy/sync — fallback de polling para quando o webhook falha,
 * atrasa, ou ainda não está configurado (ex: desenvolvimento local, onde a
 * Pluggy não consegue chamar `localhost`). Pensado para rodar periodicamente
 * via Vercel Cron (ver `vercel.json`).
 *
 * Autenticado por `CRON_SECRET` (header Authorization), NÃO por sessão do
 * Supabase — por isso esta rota está na lista de exceções do middleware
 * central de auth (`lib/supabase/middleware.ts`). Nunca remover essa
 * checagem de CRON_SECRET achando que o middleware "já cuida disso".
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: connections, error } = await admin
    .from("bank_connections")
    .select("id, user_id, pluggy_item_id")
    .eq("status", "connected");

  if (error) {
    return NextResponse.json({ error: "Falha ao listar conexões." }, { status: 500 });
  }

  let syncedTransactions = 0;
  let failedConnections = 0;

  for (const connection of connections ?? []) {
    try {
      syncedTransactions += await syncConnectionTransactions(admin, connection);
    } catch {
      // Uma conexão com falha (ex: token expirado na Pluggy) não deve
      // interromper a sincronização das demais.
      failedConnections += 1;
    }
  }

  return NextResponse.json({ syncedTransactions, failedConnections });
}
