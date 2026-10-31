import Link from "next/link";
import {
  fetchAccounts,
  fetchBudgetsProgress,
  fetchRecurring,
  fetchTransactionsCategories,
  fetchTransactionsPage,
  fetchTransactionsSummary,
  fetchTransactionsTrend,
} from "@/lib/api-client";
import { requireAccess } from "@/lib/access";
import { resolveMonth } from "@/lib/month";
import { TransactionList } from "@/components/transaction-list";
import { MonthSummary } from "@/components/month-summary";
import { TrendChart } from "@/components/trend-chart";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { ImportOfxButton } from "@/components/import-ofx-button";
import { CategorizeButton } from "@/components/categorize-button";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { formatCurrency, shiftMonth } from "@/lib/format";
import type {
  Account,
  BudgetsProgress,
  CategoriesSummary,
  RecurringSummary,
  Transaction,
  TransactionsSummary,
  MonthlyTrendPoint,
} from "@azulito/shared";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const access = await requireAccess();

  const month = await resolveMonth(access.jwt, monthParam);
  const previousMonth = shiftMonth(month, -1);

  let accounts: Account[] = [];
  let summary: TransactionsSummary | null = null;
  let previousSummary: TransactionsSummary | null = null;
  let categories: CategoriesSummary | null = null;
  let trend: MonthlyTrendPoint[] = [];
  let budgets: BudgetsProgress | null = null;
  let recurring: RecurringSummary | null = null;
  let recent: Transaction[] = [];
  let uncategorized = 0;
  let loadError = false;

  try {
    const jwt = access.jwt;
    const [accountsResult, summaryResult, previousResult, categoriesResult, trendResult, budgetsResult, recurringResult, recentResult, noneResult] =
      await Promise.all([
        fetchAccounts(jwt),
        fetchTransactionsSummary(jwt, month),
        fetchTransactionsSummary(jwt, previousMonth),
        fetchTransactionsCategories(jwt, month),
        fetchTransactionsTrend(jwt, 6),
        fetchBudgetsProgress(jwt, month),
        fetchRecurring(jwt),
        fetchTransactionsPage(jwt, { month, limit: 8 }),
        fetchTransactionsPage(jwt, { category: "__none__", limit: 1 }),
      ]);
    accounts = accountsResult;
    summary = summaryResult;
    previousSummary = previousResult;
    categories = categoriesResult;
    trend = trendResult.trend;
    budgets = budgetsResult;
    recurring = recurringResult;
    recent = recentResult.transactions;
    uncategorized = noneResult.total;
  } catch (err) {
    console.error("Falha ao carregar dashboard:", err);
    loadError = true;
  }

  const firstName = access.email?.split("@")[0] ?? "";

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.overview}</h1>
          <p className="page-subtitle">{dict.dashboard.greeting(firstName)}</p>
        </div>
        <ImportOfxButton
          importLabel={dict.dashboard.importButton}
          importingLabel={dict.dashboard.importing}
        />
      </header>

      {loadError ? (
        <p role="alert" className="form-error">
          {dict.dashboard.loadError}
        </p>
      ) : accounts.length === 0 ? (
        <p className="empty-state">{dict.overview.emptyState}</p>
      ) : (
        <>
          {uncategorized > 0 ? (
            <div className="banner">
              <span>{dict.overview.uncategorizedAlert(uncategorized)}</span>
              <CategorizeButton
                label={dict.overview.uncategorizedCta}
                runningLabel={dict.accountsPage.aiRunning}
                className="button small"
              />
            </div>
          ) : null}

          {summary ? (
            <MonthSummary summary={summary} previous={previousSummary} trend={trend} locale={locale} dict={dict} />
          ) : null}

          <div className="grid-main">
            <TrendChart trend={trend} locale={locale} dict={dict} />
            {categories ? (
              <CategoryBreakdown categories={categories.categories} locale={locale} dict={dict.categories} />
            ) : null}
          </div>

          <div className="grid-three">
            <section className="chart-card">
              <h2 className="chart-heading">{dict.overview.budgetsHeading}</h2>
              {budgets && budgets.budgets.length > 0 ? (
                <ul className="mini-list">
                  {budgets.budgets.slice(0, 5).map((budget) => (
                    <li key={budget.category} className="mini-budget">
                      <div className="mini-budget-top">
                        <span>
                          {getCategoryIcon(budget.category)} {translateCategory(budget.category, locale)}
                        </span>
                        <span className="muted-cell">{budget.percentage.toLocaleString(locale)}%</span>
                      </div>
                      <div className="progress-track">
                        <div
                          className={`progress-fill ${budget.percentage >= 100 ? "over" : budget.percentage >= 80 ? "warn" : ""}`}
                          style={{ width: `${Math.min(100, budget.percentage)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state compact">{dict.overview.budgetsEmpty}</p>
              )}
              <Link href="/budgets" className="card-link">
                {dict.overview.budgetsCta} →
              </Link>
            </section>

            <section className="chart-card">
              <h2 className="chart-heading">{dict.overview.recurringHeading}</h2>
              {recurring && recurring.items.length > 0 ? (
                <>
                  <p className="card-highlight">
                    {dict.overview.recurringPending(formatCurrency(recurring.pending_total, locale))}
                  </p>
                  <ul className="mini-list">
                    {recurring.items.slice(0, 5).map((item) => (
                      <li key={item.merchant} className="mini-row">
                        <span className="mini-row-label">{item.merchant}</span>
                        <span className="muted-cell">{formatCurrency(item.amount, locale)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="empty-state compact">{dict.overview.recurringEmpty}</p>
              )}
              <Link href="/recurring" className="card-link">
                {dict.nav.recurring} →
              </Link>
            </section>

            <section className="chart-card">
              <h2 className="chart-heading">{dict.overview.recentHeading}</h2>
              <TransactionList transactions={recent} locale={locale} dict={dict.transactions} />
              <Link href={`/transactions?month=${month}`} className="card-link">
                {dict.overview.viewAll} →
              </Link>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
