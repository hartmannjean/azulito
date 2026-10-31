import { getAccounts, listTransactions } from "./pluggyClient.js";
import { getDb } from "./db.js";

type PluggyTransaction = {
  id: string;
  description: string;
  amount: number;
  currencyCode: string;
  date: string;
  category?: string;
};

// O D1 aceita lotes de statements; fatiamos para ficar longe dos limites.
const BATCH_SIZE = 50;

/**
 * TODO(pluggy): formato de retorno de `listTransactions` assumido aqui
 * (`{ results: [...] }`) — confirmar contra a doc oficial da Pluggy.
 *
 * Compartilhado entre o webhook (routes/pluggy/webhook.ts) e o polling de
 * apoio (routes/pluggy/sync.ts) para os dois caminhos gravarem transações da
 * mesma forma e com a mesma chave de idempotência.
 */
export async function syncConnectionTransactions(
  connection: { id: string; user_id: string; pluggy_item_id: string },
): Promise<number> {
  const accounts = await getAccounts(connection.pluggy_item_id);

  const transactionsByAccount = await Promise.all(
    accounts.map(
      (account) =>
        listTransactions(account.id) as Promise<{ results: PluggyTransaction[] }>,
    ),
  );

  const transactions = transactionsByAccount.flatMap((result) => result.results);

  if (transactions.length === 0) {
    return 0;
  }

  // Upsert por pluggy_transaction_id: idempotente entre webhook e polling,
  // uma mesma transação nunca é duplicada mesmo se os dois caminhos
  // processarem o mesmo dado.
  const db = getDb();
  const statements = transactions.map((tx) =>
    db
      .prepare(
        `insert into transactions
           (user_id, bank_connection_id, pluggy_transaction_id, description, amount, currency_code, transaction_date, category)
         values (?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (pluggy_transaction_id) do update set
           description = excluded.description,
           amount = excluded.amount,
           currency_code = excluded.currency_code,
           transaction_date = excluded.transaction_date,
           category = excluded.category`,
      )
      .bind(
        connection.user_id,
        connection.id,
        tx.id,
        tx.description,
        tx.amount,
        tx.currencyCode,
        tx.date,
        tx.category ?? null,
      ),
  );

  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await db.batch(statements.slice(i, i + BATCH_SIZE));
  }

  return transactions.length;
}
