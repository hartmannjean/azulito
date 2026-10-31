import { Router } from "express";
import { getDb } from "../../lib/db.js";
import { syncConnectionTransactions } from "../../lib/pluggySync.js";

export const pluggySyncRouter = Router();

/**
 * GET /pluggy/sync — fallback de polling para quando o webhook falha,
 * atrasa, ou ainda não está configurado. Pensado para rodar periodicamente
 * via Cron Trigger do Worker (ver wrangler.jsonc e src/worker.ts).
 *
 * Rota PÚBLICA por natureza (montada em src/app.ts SEM `requireAuth`) —
 * autenticada por `CRON_SECRET` (header Authorization) em vez de sessão de
 * usuário, porque quem chama é o Cron Trigger, não um usuário logado.
 */
pluggySyncRouter.get("/", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  let connections: { id: string; user_id: string; pluggy_item_id: string }[];
  try {
    const result = await getDb()
      .prepare("select id, user_id, pluggy_item_id from bank_connections where status = 'connected'")
      .all<{ id: string; user_id: string; pluggy_item_id: string }>();
    connections = result.results;
  } catch (error) {
    console.error("Falha ao listar conexões:", error);
    return res.status(500).json({ error: "Falha ao listar conexões." });
  }

  let syncedTransactions = 0;
  let failedConnections = 0;

  for (const connection of connections) {
    try {
      syncedTransactions += await syncConnectionTransactions(connection);
    } catch {
      // Uma conexão com falha (ex: token expirado na Pluggy) não deve
      // interromper a sincronização das demais.
      failedConnections += 1;
    }
  }

  res.json({ syncedTransactions, failedConnections });
});
