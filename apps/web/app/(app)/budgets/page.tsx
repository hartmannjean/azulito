import Link from "next/link";
import { CATEGORIES } from "@azulito/shared";
import { fetchBudgetsProgress } from "@/lib/api-client";
import { requireAccess } from "@/lib/access";
import { resolveMonth } from "@/lib/month";
import { BudgetForm } from "@/components/budget-form";
import { RemoveBudgetButton } from "@/components/remove-budget-button";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { formatCurrency, formatMonthLabel, shiftMonth } from "@/lib/format";
import type { BudgetsProgress } from "@azulito/shared";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const access = await requireAccess();
  const month = await resolveMonth(access.jwt, monthParam);

  let progress: BudgetsProgress | null = null;
  let loadError = false;
  try {
    progress = await fetchBudgetsProgress(access.jwt, month);
  } catch (err) {
    console.error("Falha ao carregar orçamentos:", err);
    loadError = true;
  }

  const options = CATEGORIES.filter((category) => category !== "Income").map((value) => ({
    value,
    label: `${getCategoryIcon(value) ?? ""} ${translateCategory(value, locale) ?? value}`.trim(),
  }));

  const total = progress && progress.totalLimit > 0 ? (progress.totalSpent / progress.totalLimit) * 100 : 0;

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.budgets}</h1>
          <p className="page-subtitle">{dict.budgetsPage.heading}</p>
        </div>
        <div className="month-nav inline">
          <Link
            href={`/budgets?month=${shiftMonth(month, -1)}`}
            className="month-nav-arrow"
            aria-label={dict.dashboard.previousMonth}
          >
            ‹
          </Link>
          <h2>{formatMonthLabel(month, locale)}</h2>
          <Link
            href={`/budgets?month=${shiftMonth(month, 1)}`}
            className="month-nav-arrow"
            aria-label={dict.dashboard.nextMonth}
          >
            ›
          </Link>
        </div>
      </header>

      {loadError || !progress ? (
        <p role="alert" className="form-error">
          {dict.dashboard.loadError}
        </p>
      ) : (
        <div className="grid-side">
          <div className="stack">
            {progress.budgets.length > 0 ? (
              <section className="chart-card">
                <h2 className="chart-heading">{dict.budgetsPage.totalHeading}</h2>
                <p className="card-highlight">
                  {dict.budgetsPage.spent(
                    formatCurrency(progress.totalSpent, locale),
                    formatCurrency(progress.totalLimit, locale),
                  )}
                </p>
                <div className="progress-track large">
                  <div
                    className={`progress-fill ${total >= 100 ? "over" : total >= 80 ? "warn" : ""}`}
                    style={{ width: `${Math.min(100, total)}%` }}
                  />
                </div>
              </section>
            ) : null}

            {progress.budgets.length === 0 ? (
              <p className="empty-state">{dict.budgetsPage.empty}</p>
            ) : (
              <div className="budget-grid">
                {progress.budgets.map((budget) => {
                  const state = budget.percentage >= 100 ? "over" : budget.percentage >= 80 ? "warn" : "ok";
                  const diff = Math.abs(budget.limit - budget.spent);
                  return (
                    <section key={budget.category} className={`chart-card budget-card ${state}`}>
                      <div className="budget-card-top">
                        <h3>
                          {getCategoryIcon(budget.category)} {translateCategory(budget.category, locale)}
                        </h3>
                        <span className={`chip status-${state}`}>
                          {state === "over"
                            ? dict.budgetsPage.statusOver
                            : state === "warn"
                              ? dict.budgetsPage.statusWarn
                              : dict.budgetsPage.statusOk}
                        </span>
                      </div>
                      <p className="card-highlight">
                        {dict.budgetsPage.spent(
                          formatCurrency(budget.spent, locale),
                          formatCurrency(budget.limit, locale),
                        )}
                      </p>
                      <div className="progress-track large">
                        <div
                          className={`progress-fill ${state === "ok" ? "" : state}`}
                          style={{ width: `${Math.min(100, budget.percentage)}%` }}
                        />
                      </div>
                      <div className="budget-card-bottom">
                        <span className="muted-cell">
                          {budget.spent > budget.limit
                            ? dict.budgetsPage.over(formatCurrency(diff, locale))
                            : dict.budgetsPage.left(formatCurrency(diff, locale))}
                        </span>
                        <RemoveBudgetButton category={budget.category} label={dict.budgetsPage.remove} />
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="chart-card form-card">
            <h2 className="chart-heading">{dict.budgetsPage.formHeading}</h2>
            <BudgetForm
              options={options}
              labels={{
                category: dict.budgetsPage.category,
                limit: dict.budgetsPage.limit,
                save: dict.budgetsPage.save,
              }}
            />
          </aside>
        </div>
      )}
    </main>
  );
}
