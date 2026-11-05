import Link from "next/link";
import { BudgetForm } from "@/components/budget-form";
import { MonthNav } from "@/components/month-nav";
import { RemoveBudgetButton } from "@/components/remove-budget-button";
import { AiButton } from "@/components/ai-button";
import { BudgetSuggestionCard, BudgetSuggestionStrip, type SuggestionCardData } from "@/components/budget-suggestions";
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

  // Sugestões da IA por categoria: as de categoria sem orçamento viram cards
  // "fantasma" no grid; as de orçamento existente viram uma faixa no próprio card.
  const budgeted = new Set(progress?.budgets.map((b) => b.category) ?? []);
  const toData = (suggestion: BudgetSuggestions["suggestions"][number]): SuggestionCardData => ({
    category: suggestion.category,
    limit: suggestion.suggested,
    title: `${getCategoryIcon(suggestion.category) ?? ""} ${translateCategory(suggestion.category, locale) ?? suggestion.category}`.trim(),
    change:
      suggestion.current === null
        ? dict.budgetAi.create(formatCurrency(suggestion.suggested, locale))
        : dict.budgetAi.change(
            formatCurrency(suggestion.current, locale),
            formatCurrency(suggestion.suggested, locale),
          ),
    reason: suggestion.reason,
    average: dict.budgetAi.average(formatCurrency(suggestion.average, locale)),
  });
  const allSuggestions = suggestions?.suggestions ?? [];
  const suggestionByCategory = new Map(
    allSuggestions.filter((x) => budgeted.has(x.category)).map((x) => [x.category, x]),
  );
  const ghostSuggestions = allSuggestions.filter((x) => !budgeted.has(x.category));
  const suggestionLabels = {
    accept: dict.budgetAi.accept,
    dismiss: dict.budgetAi.dismiss,
    badge: dict.budgetAi.badge,
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.budgets}</h1>
          <p className="page-subtitle">{dict.budgetsPage.heading}</p>
        </div>
        <div className="page-actions">
          {demo ? (
            <button type="button" className="button secondary" disabled title={dict.demo.disabledHint}>
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
        <MonthNav
          month={month}
          basePath={basePath}
          locale={locale}
          navigable={!demo}
          labels={{
            previous: dict.dashboard.previousMonth,
            next: dict.dashboard.nextMonth,
            current: dict.dashboard.currentMonth,
            pick: dict.dashboard.pickMonth,
          }}
        />
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

            {progress.budgets.length === 0 && ghostSuggestions.length === 0 ? (
              <p className="empty-state">
                {suggestions?.created_at ? dict.budgetAi.empty : dict.budgetsPage.empty}
              </p>
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
                      {suggestionByCategory.has(budget.category) ? (
                        <BudgetSuggestionStrip
                          data={toData(suggestionByCategory.get(budget.category)!)}
                          labels={suggestionLabels}
                          disabled={demo}
                        />
                      ) : null}
                    </section>
                  );
                })}
                {ghostSuggestions.map((suggestion) => (
                  <BudgetSuggestionCard
                    key={suggestion.category}
                    data={toData(suggestion)}
                    labels={suggestionLabels}
                    disabled={demo}
                  />
                ))}
              </div>
            )}

            {progress.unbudgeted.length > 0 ? (
              <section className="chart-card unbudgeted">
                <div className="unbudgeted-head">
                  <div>
                    <h2 className="chart-heading">{dict.budgetsPage.unbudgetedHeading}</h2>
                    <p className="muted-cell">{dict.budgetsPage.unbudgetedHelp}</p>
                  </div>
                  <span className="unbudgeted-total">{formatCurrency(progress.unbudgetedTotal, locale)}</span>
                </div>
                {(() => {
                  const top = Math.max(...progress.unbudgeted.map((item) => item.spent), 1);
                  const row = (item: (typeof progress.unbudgeted)[number]) => {
                    const params = new URLSearchParams({ type: "expense", month });
                    params.set("category", item.category ?? "__none__");
                    return (
                      <li key={item.category ?? "__none__"}>
                        <Link href={`${transactionsPath}?${params.toString()}`} className="unbudgeted-row">
                          <span className="unbudgeted-label">
                            {item.category
                              ? `${getCategoryIcon(item.category) ?? ""} ${translateCategory(item.category, locale)}`.trim()
                              : dict.txPage.uncategorized}
                          </span>
                          <span className="unbudgeted-value">{formatCurrency(item.spent, locale)}</span>
                          <span className="unbudgeted-bar" aria-hidden="true">
                            <span style={{ width: `${Math.max(3, (item.spent / top) * 100)}%` }} />
                          </span>
                        </Link>
                      </li>
                    );
                  };
                  const head = progress.unbudgeted.slice(0, 6);
                  const rest = progress.unbudgeted.slice(6);
                  return (
                    <>
                      <ul className="unbudgeted-list">{head.map(row)}</ul>
                      {rest.length > 0 ? (
                        <details className="unbudgeted-more">
                          <summary>{dict.budgetsPage.unbudgetedMore(rest.length)}</summary>
                          <ul className="unbudgeted-list">{rest.map(row)}</ul>
                        </details>
                      ) : null}
                    </>
                  );
                })()}
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
