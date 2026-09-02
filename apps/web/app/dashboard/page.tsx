import { createClient } from "@/lib/supabase/server";
import { fetchBankConnections, fetchTransactions } from "@/lib/api-client";
import { TransactionList } from "@/components/transaction-list";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { logout } from "./actions";
import type { Transaction, BankConnection } from "@azulito/shared";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Middleware garante que existe sessão aqui; checagem abaixo é defesa em
  // profundidade e satisfaz o TypeScript.
  if (!session) {
    return null;
  }

  let transactions: Transaction[] = [];
  let connections: BankConnection[] = [];
  let loadError = false;

  try {
    [transactions, connections] = await Promise.all([
      fetchTransactions(session.access_token),
      fetchBankConnections(session.access_token),
    ]);
  } catch {
    loadError = true;
  }

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

      <ConnectBankButton hasConnection={connections.length > 0} />

      {loadError ? (
        <p role="alert" className="form-error">
          Não foi possível carregar seus dados agora. Tente novamente em
          instantes.
        </p>
      ) : (
        <TransactionList transactions={transactions} />
      )}

      {connections.length > 0 ? (
        <section>
          <h2>Contas conectadas</h2>
          <ul>
            {connections.map((connection) => (
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
