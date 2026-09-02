import type { SupabaseClient } from "@supabase/supabase-js";
import { listTransactions } from "./pluggyClient.js";

type PluggyTransaction = {
  id: string;
  description: string;
  amount: number;
  currencyCode: string;
  date: string;
  category?: string;
};

/**
 * TODO(pluggy): formato de retorno de `listTransactions` assumido aqui
 * (`{ results: [...] }`) — confirmar contra a doc oficial da Pluggy.
 *
 * Compartilhado entre o webhook (routes/pluggy/webhook.ts) e o polling de
 * apoio (routes/pluggy/sync.ts) para os dois caminhos gravarem transações da
 * mesma forma e com a mesma chave de idempotência.
 */
export async function syncConnectionTransactions(
  admin: SupabaseClient,
  connection: { id: string; user_id: string; pluggy_item_id: string },
): Promise<number> {
  const result = (await listTransactions(connection.pluggy_item_id)) as {
    results: PluggyTransaction[];
  };

  const rows = result.results.map((tx) => ({
    user_id: connection.user_id,
    bank_connection_id: connection.id,
    pluggy_transaction_id: tx.id,
    description: tx.description,
    amount: tx.amount,
    currency_code: tx.currencyCode,
    transaction_date: tx.date,
    category: tx.category ?? null,
  }));

  if (rows.length === 0) {
    return 0;
  }

  // Upsert por pluggy_transaction_id: idempotente entre webhook e polling,
  // uma mesma transação nunca é duplicada mesmo se os dois caminhos
  // processarem o mesmo dado.
  const { error } = await admin
    .from("transactions")
    .upsert(rows, { onConflict: "pluggy_transaction_id" });

  if (error) {
    throw error;
  }

  return rows.length;
}
