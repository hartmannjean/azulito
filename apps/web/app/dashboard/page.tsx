import { createClient } from "@/lib/supabase/server";
import {
  fetchBankConnections,
  fetchTransactions,
  fetchTransactionsSummary,
  fetchTransactionsCategories,
  fetchTransactionsTrend,
} from "@/lib/api-client";
import { TransactionList } from "@/components/transaction-list";
import { MonthSummary } from "@/components/month-summary";
import { TrendChart } from "@/components/trend-chart";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { currentMonth, shiftMonth } from "@/lib/format";
import { logout } from "./actions";
import type {
  Transaction,
  BankConnection,
  TransactionsSummary,
  CategoriesSummary,
  MonthlyTrendPoint,
} from "@azulito/shared";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = monthParam ?? currentMonth();
  const previousMonth = shiftMonth(month, -1);

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
  let previousSummary: TransactionsSummary | null = null;
  let categories: CategoriesSummary | null = null;
  let trend: MonthlyTrendPoint[] = [];
  let loadError = false;

  try {
    [transactions, connections, summary, previousSummary, categories, { trend }] = await Promise.all([
      fetchTransactions(session.access_token, month),
      fetchBankConnections(session.access_token),
      fetchTransactionsSummary(session.access_token, month),
      fetchTransactionsSummary(session.access_token, previousMonth),
      fetchTransactionsCategories(session.access_token, month),
      fetchTransactionsTrend(session.access_token, 6),
    ]);
  } catch (err) {
    console.error("Falha ao carregar dashboard:", err);
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
          {summary ? <MonthSummary summary={summary} previous={previousSummary} /> : null}

          <div className="dashboard-grid">
            <TrendChart trend={trend} />
            {categories ? <CategoryBreakdown categories={categories.categories} /> : null}
          </div>

          <section className="transactions-card">
            <h2 className="transactions-heading">Transações</h2>
            <TransactionList transactions={transactions} />
          </section>
        </>
      )}
    </main>
  );
}
