import { createClient } from "@/lib/supabase/server";
import { fetchBankConnections, fetchTransactions, fetchTransactionsSummary } from "@/lib/api-client";
import { TransactionList } from "@/components/transaction-list";
import { MonthSummary } from "@/components/month-summary";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { currentMonth } from "@/lib/format";
import { logout } from "./actions";
import type { Transaction, BankConnection, TransactionsSummary } from "@azulito/shared";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = monthParam ?? currentMonth();

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
  let summary: TransactionsSummary | null = null;
  let loadError = false;

  try {
    [transactions, connections, summary] = await Promise.all([
      fetchTransactions(session.access_token, month),
      fetchBankConnections(session.access_token),
      fetchTransactionsSummary(session.access_token, month),
    ]);
  } catch {
    loadError = true;
  }

  const activeConnection = connections[0];

  return (
    <main className="dashboard">
      <div className="dashboard-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span className="brand-name">Azulito</span>
        </div>
        <form action={logout}>
          <button type="submit" className="button secondary">
            Sair
          </button>
        </form>
      </div>

      <div className="toolbar">
        <div className="connection-status">
          {activeConnection ? (
            <>
              <span className="connection-dot" aria-hidden="true" />
              <span>
                {activeConnection.institution_name} conectado
              </span>
            </>
          ) : (
            <span className="muted">Nenhuma conta conectada</span>
          )}
        </div>
        <ConnectBankButton hasConnection={connections.length > 0} />
      </div>

      {loadError ? (
        <p role="alert" className="form-error">
          Não foi possível carregar seus dados agora. Tente novamente em
          instantes.
        </p>
      ) : (
        <>
          {summary ? <MonthSummary summary={summary} /> : null}
          <section className="transactions-card">
            <h2 className="transactions-heading">Transações</h2>
            <TransactionList transactions={transactions} />
          </section>
        </>
      )}
    </main>
  );
}
