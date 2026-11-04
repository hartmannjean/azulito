import Link from "next/link";
import { BudgetForm } from "@/components/budget-form";
import { RemoveBudgetButton } from "@/components/remove-budget-button";
import { AiButton } from "@/components/ai-button";
import { BudgetSuggestionCard } from "@/components/budget-suggestions";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import { formatCurrency, formatMonthLabel, shiftMonth } from "@/lib/format";
import { buildCategoryOptions } from "@/lib/category-options";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import type { BudgetSuggestions, BudgetsProgress } from "@azulito/shared";

/** Orçamentos por categoria; só apresentação. `demo` desliga o formulário e a remoção. */
export function BudgetsView({
  progress,
  month,
  basePath,
  locale,
  dict,
  loadError = false,
  demo = false,
  customCategories = [],
  suggestions = null,
}: {
  progress: BudgetsProgress | null;
  /** Sugestões da IA (só no app real). */
  suggestions?: BudgetSuggestions | null;
  customCategories?: string[];
  month: string;
  /** "/dash/budgets" ou "/demo/budgets". */
  basePath: string;
  locale: Locale;
  dict: Dictionary;
  loadError?: boolean;
  demo?: boolean;
}) {
  const options = buildCategoryOptions(locale, customCategories, {
    includeIncome: false,
  });

  const transactionsPath = basePath.replace(/\/budgets$/, "/transactions");
  const total =
    progress && progress.totalLimit > 0
      ? (progress.totalSpent / progress.totalLimit) * 100
      : 0;

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.budgets}</h1>
          <p className="page-subtitle">{dict.budgetsPage.heading}</p>
        </div>
        <div className="month-nav inline">
          <Link
            href={`${basePath}?month=${shiftMonth(month, -1)}`}
            className={`month-nav-arrow${demo ? " disabled" : ""}`}
            aria-label={dict.dashboard.previousMonth}
          >
            ‹
          </Link>
          <h2>{formatMonthLabel(month, locale)}</h2>
          <Link
            href={`${basePath}?month=${shiftMonth(month, 1)}`}
            className={`month-nav-arrow${demo ? " disabled" : ""}`}
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
            <section className="chart-card">
              <h2 className="chart-heading">{dict.budgetAi.heading}</h2>
              <p className="muted-cell block">{dict.budgetAi.help}</p>
              {suggestions && suggestions.suggestions.length > 0 ? (
                <div className="suggestion-list">
                  {suggestions.suggestions.map((suggestion) => {
                    const name =
                      `${getCategoryIcon(suggestion.category) ?? ""} ${translateCategory(suggestion.category, locale) ?? suggestion.category}`.trim();
                    return (
                      <BudgetSuggestionCard
                        key={suggestion.category}
                        data={{
                          category: suggestion.category,
                          limit: suggestion.suggested,
                          title: name,
                          change:
                            suggestion.current === null
                              ? dict.budgetAi.create(
                                  formatCurrency(suggestion.suggested, locale),
                                )
                              : dict.budgetAi.change(
                                  formatCurrency(suggestion.current, locale),
                                  formatCurrency(suggestion.suggested, locale),
                                ),
                          reason: suggestion.reason,
                          average: dict.budgetAi.average(
                            formatCurrency(suggestion.average, locale),
                          ),
                        }}
                        labels={{
                          accept: dict.budgetAi.accept,
                          dismiss: dict.budgetAi.dismiss,
                        }}
                        disabled={demo}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="muted-cell block">
                  {suggestions?.created_at
                    ? dict.budgetAi.empty
                    : dict.budgetAi.none}
                </p>
              )}
              {demo ? (
                <button
                  type="button"
                  className="button secondary"
                  disabled
                  title={dict.demo.disabledHint}
                >
                  {dict.budgetAi.button}
                </button>
              ) : (
                <AiButton
                  kind="budget"
                  label={dict.budgetAi.button}
                  runningLabel={dict.budgetAi.running}
                  errorLabel={dict.budgetAi.failed}
                  className="button secondary"
                />
              )}
            </section>
            {progress.budgets.length > 0 ? (
              <section className="chart-card">
                <h2 className="chart-heading">
                  {dict.budgetsPage.totalHeading}
                </h2>
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
                  const state =
                    budget.percentage >= 100
                      ? "over"
                      : budget.percentage >= 80
                        ? "warn"
                        : "ok";
                  const diff = Math.abs(budget.limit - budget.spent);
                  return (
                    <section
                      key={budget.category}
                      className={`chart-card budget-card ${state}`}
                    >
                      <div className="budget-card-top">
                        <h3>
                          {getCategoryIcon(budget.category)}{" "}
                          {translateCategory(budget.category, locale)}
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
                          style={{
                            width: `${Math.min(100, budget.percentage)}%`,
                          }}
                        />
                      </div>
                      <div className="budget-card-bottom">
                        <span className="muted-cell">
                          {budget.spent > budget.limit
                            ? dict.budgetsPage.over(
                                formatCurrency(diff, locale),
                              )
                            : dict.budgetsPage.left(
                                formatCurrency(diff, locale),
                              )}
                        </span>
                        {demo ? null : (
                          <RemoveBudgetButton
                            category={budget.category}
                            label={dict.budgetsPage.remove}
                          />
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {progress.unbudgeted.length > 0 ? (
              <section className="chart-card">
                <div className="budget-card-top">
                  <h2 className="chart-heading">
                    {dict.budgetsPage.unbudgetedHeading}
                  </h2>
                  <span className="card-highlight">
                    {formatCurrency(progress.unbudgetedTotal, locale)}
                  </span>
                </div>
                <p className="muted-cell">{dict.budgetsPage.unbudgetedHelp}</p>
                <ul className="mini-list">
                  {progress.unbudgeted.map((item) => {
                    const params = new URLSearchParams({
                      type: "expense",
                      month,
                    });
                    params.set("category", item.category ?? "__none__");
                    return (
                      <li
                        key={item.category ?? "__none__"}
                        className="mini-row"
                      >
                        <Link
                          href={`${transactionsPath}?${params.toString()}`}
                          className="mini-row-label"
                        >
                          {item.category
                            ? `${getCategoryIcon(item.category) ?? ""} ${translateCategory(item.category, locale)}`.trim()
                            : dict.txPage.uncategorized}
                        </Link>
                        <span className="muted-cell">
                          {formatCurrency(item.spent, locale)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="chart-card form-card">
            <h2 className="chart-heading">{dict.budgetsPage.formHeading}</h2>
            {demo ? (
              <p className="muted-cell block">{dict.demo.disabledHint}</p>
            ) : (
              <BudgetForm
                options={options}
                labels={{
                  category: dict.budgetsPage.category,
                  limit: dict.budgetsPage.limit,
                  save: dict.budgetsPage.save,
                }}
              />
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
