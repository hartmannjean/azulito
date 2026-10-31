import Link from "next/link";
import { TransactionList } from "@/components/transaction-list";
import { MonthSummary } from "@/components/month-summary";
import { TrendChart } from "@/components/trend-chart";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { ImportOfxButton } from "@/components/import-ofx-button";
import { CategorizeButton } from "@/components/categorize-button";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import { formatCurrency } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import type {
  Account,
  BudgetsProgress,
  CategoriesSummary,
  MonthlyTrendPoint,
  RecurringSummary,
  Transaction,
  TransactionsSummary,
} from "@azulito/shared";

export type DashboardData = {
  firstName: string;
  month: string;
  accounts: Account[];
  summary: TransactionsSummary | null;
  previousSummary: TransactionsSummary | null;
  categories: CategoriesSummary | null;
  trend: MonthlyTrendPoint[];
  budgets: BudgetsProgress | null;
  recurring: RecurringSummary | null;
  recent: Transaction[];
  uncategorized: number;
  loadError: boolean;
};

/** Visão geral — só apresentação; os dados chegam prontos (ver dashboard/page.tsx). */
export function DashboardView({
  data,
  locale,
  dict,
  demo = false,
}: {
  data: DashboardData;
  locale: Locale;
  dict: Dictionary;
  demo?: boolean;
}) {
  const base = demo ? "/demo" : "";
  const { accounts, summary, previousSummary, categories, trend, budgets, recurring, recent, uncategorized } = data;

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.overview}</h1>
          <p className="page-subtitle">{dict.dashboard.greeting(data.firstName)}</p>
        </div>
        {demo ? (
          <button type="button" className="button secondary" disabled title={dict.demo.disabledHint}>
            {dict.dashboard.importButton}
          </button>
        ) : (
          <ImportOfxButton
            importLabel={dict.dashboard.importButton}
            importingLabel={dict.dashboard.importing}
          />
        )}
      </header>

      {data.loadError ? (
        <p role="alert" className="form-error">
          {dict.dashboard.loadError}
        </p>
      ) : accounts.length === 0 ? (
        <p className="empty-state">{dict.overview.emptyState}</p>
      ) : (
        <>
          {!demo && uncategorized > 0 ? (
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
            <MonthSummary
              summary={summary}
              previous={previousSummary}
              trend={trend}
              locale={locale}
              dict={dict}
              basePath={demo ? "/demo" : "/dashboard"}
              navigable={!demo}
            />
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
              <Link href={`${base}/budgets`} className="card-link">
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
              <Link href={`${base}/recurring`} className="card-link">
                {dict.nav.recurring} →
              </Link>
            </section>

            <section className="chart-card">
              <h2 className="chart-heading">{dict.overview.recentHeading}</h2>
              <TransactionList transactions={recent} locale={locale} dict={dict.transactions} />
              <Link href={`${base}/transactions?month=${data.month}`} className="card-link">
                {dict.overview.viewAll} →
              </Link>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
