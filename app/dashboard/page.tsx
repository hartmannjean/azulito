import { createClient } from "@/lib/supabase/server";
import { TransactionList } from "@/components/transaction-list";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { logout } from "./actions";
import type { BankConnection, Transaction } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware garante que `user` existe aqui; checagem abaixo é só para o
  // TypeScript e como última linha de defesa.
  if (!user) {
    return null;
  }

  const [{ data: transactions, error: transactionsError }, { data: connections }] =
    await Promise.all([
      supabase
        .from("transactions")
        // RLS já restringe a linhas do próprio usuário; o filtro explícito
        // é defesa em profundidade, não a única barreira.
        .select("id, description, amount, currency_code, transaction_date, category")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false })
        .limit(50),
      supabase
        .from("bank_connections")
        .select("id, institution_name, status")
        .eq("user_id", user.id),
    ]);

  return (
    <main className="dashboard">
      <div className="dashboard-header">
        <h1>Suas transações</h1>
        <form action={logout}>
          <button type="submit" className="button secondary">
            Sair
          </button>
        </form>
      </div>

      <ConnectBankButton hasConnection={Boolean(connections && connections.length > 0)} />

      {transactionsError ? (
        <p role="alert" className="form-error">
          Não foi possível carregar as transações.
        </p>
      ) : (
        <TransactionList transactions={(transactions ?? []) as Transaction[]} />
      )}

      {connections && connections.length > 0 ? (
        <section>
          <h2>Contas conectadas</h2>
          <ul>
            {(connections as BankConnection[]).map((connection) => (
              <li key={connection.id}>
                {connection.institution_name} — {connection.status}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
