import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccounts, getBills, listTransactions } from "./pluggyClient.js";

type PluggyTransaction = {
  id: string;
  description: string;
  amount: number;
  currencyCode: string;
  date: string;
  category?: string;
  // TODO(pluggy): confirmar contra a doc oficial atual — "Id of the bill
  // associated with the transaction. Only available on Open Finance
  // connectors" (não vem em toda transação de cartão, só quando a fatura já
  // foi fechada e associada pela Pluggy).
  billId?: string;
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
  const accounts = await getAccounts(connection.pluggy_item_id);

  const transactionsByAccount = await Promise.all(
    accounts.map(async (account) => ({
      account,
      result: (await listTransactions(account.id)) as { results: PluggyTransaction[] },
    })),
  );

  const rows = transactionsByAccount.flatMap(({ account, result }) =>
    result.results.map((tx) => ({
      user_id: connection.user_id,
      bank_connection_id: connection.id,
      pluggy_transaction_id: tx.id,
      pluggy_account_id: account.id,
      pluggy_bill_id: tx.billId ?? null,
      description: tx.description,
      amount: tx.amount,
      currency_code: tx.currencyCode,
      transaction_date: tx.date,
      category: tx.category ?? null,
    })),
  );

  if (rows.length > 0) {
    // Upsert por pluggy_transaction_id: idempotente entre webhook e polling,
    // uma mesma transação nunca é duplicada mesmo se os dois caminhos
    // processarem o mesmo dado.
    const { error } = await admin
      .from("transactions")
      .upsert(rows, { onConflict: "pluggy_transaction_id" });

    if (error) {
      throw error;
    }
  }

  await syncCreditCardBills(admin, connection, accounts);

  return rows.length;
}

/**
 * Sincroniza as faturas das contas de cartão de crédito do Item — usadas
 * pelo resumo mensal (GET /transactions/summary etc.) pra contar a fatura
 * como uma despesa única no mês do vencimento em vez de cada compra solta no
 * mês em que foi feita. Uma conta sem fatura disponível (conta não é cartão,
 * ou a instituição não retorna esse dado) não deve travar a sincronização
 * das transações — por isso roda depois e por conta, isolado com try/catch.
 */
async function syncCreditCardBills(
  admin: SupabaseClient,
  connection: { id: string; user_id: string },
  accounts: { id: string; type?: string }[],
): Promise<void> {
  const creditAccounts = accounts.filter((account) => account.type === "CREDIT");

  for (const account of creditAccounts) {
    try {
      const bills = await getBills(account.id);
      if (bills.length === 0) continue;

      const rows = bills.map((bill) => ({
        user_id: connection.user_id,
        bank_connection_id: connection.id,
        pluggy_bill_id: bill.id,
        pluggy_account_id: account.id,
        due_date: bill.dueDate.slice(0, 10),
        total_amount: bill.totalAmount,
        currency_code: bill.totalAmountCurrencyCode ?? "BRL",
      }));

      const { error } = await admin
        .from("credit_card_bills")
        .upsert(rows, { onConflict: "pluggy_bill_id" });

      if (error) throw error;
    } catch (err) {
      console.error(`Falha ao sincronizar faturas da conta ${account.id}:`, err);
    }
  }
}
