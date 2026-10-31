import { getAccess } from "@/lib/access";
import {
  fetchAccounts,
  fetchTransactions,
  fetchTransactionsSummary,
  fetchTransactionsCategories,
  fetchTransactionsTrend,
} from "@/lib/api-client";
import { TransactionList } from "@/components/transaction-list";
import { MonthSummary } from "@/components/month-summary";
import { TrendChart } from "@/components/trend-chart";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { ImportOfxButton } from "@/components/import-ofx-button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { currentMonth, shiftMonth } from "@/lib/format";
import type {
  Transaction,
  Account,
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
  let accounts: Account[] = [];
  let summary: TransactionsSummary | null = null;
  let previousSummary: TransactionsSummary | null = null;
  let categories: CategoriesSummary | null = null;
  let trend: MonthlyTrendPoint[] = [];
  let loadError = false;

  try {
    [transactions, accounts, summary, previousSummary, categories, { trend }] = await Promise.all([
      fetchTransactions(access.jwt, month),
      fetchAccounts(access.jwt),
      fetchTransactionsSummary(access.jwt, month),
      fetchTransactionsSummary(access.jwt, previousMonth),
      fetchTransactionsCategories(access.jwt, month),
      fetchTransactionsTrend(access.jwt, 6),
    ]);
  } catch (err) {
    console.error("Falha ao carregar dashboard:", err);
    loadError = true;
  }

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
          {accounts.length > 0 ? (
            <>
              <span className="connection-dot" aria-hidden="true" />
              <span>{dict.dashboard.accountsImported(accounts.length)}</span>
            </>
          ) : (
            <span className="muted">{dict.dashboard.noAccounts}</span>
          )}
        </div>
        <ImportOfxButton
          importLabel={dict.dashboard.importButton}
          importingLabel={dict.dashboard.importing}
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
