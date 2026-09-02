import { Router } from "express";
import { createAdminClient } from "../../lib/supabaseAdmin.js";
import { syncConnectionTransactions } from "../../lib/pluggySync.js";

export const pluggySyncRouter = Router();

/**
 * GET /pluggy/sync — fallback de polling para quando o webhook falha,
 * atrasa, ou ainda não está configurado. Pensado para rodar periodicamente
 * via Vercel Cron (ver vercel.json).
 *
 * Rota PÚBLICA por natureza (montada em src/app.ts SEM `requireAuth`) —
 * autenticada por `CRON_SECRET` (header Authorization) em vez de sessão de
 * usuário, porque quem chama é o Vercel Cron, não um usuário logado.
 */
pluggySyncRouter.get("/", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  const admin = createAdminClient();

  const { data: connections, error } = await admin
    .from("bank_connections")
    .select("id, user_id, pluggy_item_id")
    .eq("status", "connected");

  if (error) {
    return res.status(500).json({ error: "Falha ao listar conexões." });
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

  res.json({ syncedTransactions, failedConnections });
});
