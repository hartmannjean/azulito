import { getAccess } from "@/lib/access";
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
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { currentMonth, shiftMonth } from "@/lib/format";
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
  const locale = await getLocale();
  const dict = getDictionary(locale);

  // O Cloudflare Access barra quem não está logado antes de chegar aqui; a
  // verificação abaixo é defesa em profundidade (acesso que contorne o Access).
  const access = await getAccess();
  if (!access) {
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
      fetchTransactions(access.jwt, month),
      fetchBankConnections(access.jwt),
      fetchTransactionsSummary(access.jwt, month),
      fetchTransactionsSummary(access.jwt, previousMonth),
      fetchTransactionsCategories(access.jwt, month),
      fetchTransactionsTrend(access.jwt, 6),
    ]);
  } catch (err) {
    console.error("Falha ao carregar dashboard:", err);
    loadError = true;
  }

  const activeConnection = connections[0];
  const firstName = access.email?.split("@")[0] ?? "";

  return (
    <main className="dashboard">
      <div className="dashboard-header">
        <Logo />
        <div className="header-actions">
          <LanguageToggle
            locale={locale}
            switchToEnglishLabel={dict.common.switchToEnglish}
            switchToPortugueseLabel={dict.common.switchToPortuguese}
          />
          <ThemeToggle label={dict.common.toggleTheme} />
          <a href="/cdn-cgi/access/logout" className="button secondary">
            {dict.dashboard.logout}
          </a>
        </div>
      </div>

      <p className="dashboard-greeting">{dict.dashboard.greeting(firstName)}</p>

      <div className="toolbar">
        <div className="connection-status">
          {activeConnection ? (
            <>
              <span className="connection-dot" aria-hidden="true" />
              <span>{dict.dashboard.connected(activeConnection.institution_name)}</span>
            </>
          ) : (
            <span className="muted">{dict.dashboard.noConnection}</span>
          )}
        </div>
        <ConnectBankButton
          hasConnection={connections.length > 0}
          connectLabel={dict.dashboard.connectButton}
          reconnectLabel={dict.dashboard.reconnectButton}
          connectingLabel={dict.dashboard.connecting}
          errorLabel={dict.auth.errors.connectFailed}
        />
      </div>

      {loadError ? (
        <p role="alert" className="form-error">
          {dict.dashboard.loadError}
        </p>
      ) : (
        <>
          {summary ? (
            <MonthSummary summary={summary} previous={previousSummary} trend={trend} locale={locale} dict={dict} />
          ) : null}

          <div className="dashboard-grid">
            <TrendChart trend={trend} locale={locale} dict={dict} />
            {categories ? (
              <CategoryBreakdown categories={categories.categories} locale={locale} dict={dict.categories} />
            ) : null}
          </div>

          <section className="transactions-card">
            <h2 className="transactions-heading">{dict.dashboard.transactionsHeading}</h2>
            <TransactionList transactions={transactions} locale={locale} dict={dict.transactions} />
          </section>
        </>
      )}
    </main>
  );
}
