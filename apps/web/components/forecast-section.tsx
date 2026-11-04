import type { ForecastResponse } from "@azulito/shared";
import { ScheduledForm } from "@/components/scheduled-form";
import { ScheduledActions } from "@/components/scheduled-actions";
import { buildCategoryOptions } from "@/lib/category-options";
import { translateCategory } from "@/lib/i18n/category-names";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

/**
 * Previsão de receitas e despesas + contas a pagar/receber cadastradas. O
 * cálculo vem pronto da api; aqui só se apresenta. `demo` esconde as ações.
 */
export function ForecastSection({
  forecast,
  customCategories = [],
  today,
  locale,
  dict,
  demo = false,
}: {
  forecast: ForecastResponse;
  customCategories?: string[];
  /** AAAA-MM-DD. */
  today: string;
  locale: Locale;
  dict: Dictionary;
  demo?: boolean;
}) {
  const t = dict.forecast;
  const money = (value: number) => formatCurrency(value, locale);
  const tone = (value: number) => (value > 0 ? "positive" : value < 0 ? "negative" : "");
  const options = buildCategoryOptions(locale, customCategories);
  const statusLabel = { pending: t.statusPending, paid: t.statusPaid, matched: t.statusMatched } as const;

  const line = (label: string, value: string, strong = false) => (
    <div className={strong ? "forecast-line strong" : "forecast-line"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <section className="forecast" aria-label={t.heading}>
      <h2 className="chart-heading">{t.heading}</h2>
      <p className="muted-cell block">{t.help}</p>

      <div className="forecast-grid">
        {forecast.months.map((m) => (
          <article key={m.month} className="chart-card forecast-card">
            <h3 className="forecast-month">{formatMonthLabel(m.month, locale)}</h3>

            <h4 className="forecast-sub">{t.income}</h4>
            <dl>
              {line(t.received, money(m.income.received))}
              {m.income.scheduled > 0 ? line(t.scheduledIn, money(m.income.scheduled)) : null}
              {m.income.recurring > 0 ? line(t.recurringIn, money(m.income.recurring)) : null}
              {line(t.projectedIn, money(m.income.projected), true)}
            </dl>
            <p className="muted-cell">{t.average(money(m.income.average))}</p>

            <h4 className="forecast-sub">{t.expenses}</h4>
            <dl>
              {line(t.realized, money(m.expenses.realized))}
              {m.expenses.scheduled > 0 ? line(t.scheduledOut, money(m.expenses.scheduled)) : null}
              {m.expenses.recurring > 0 ? line(t.recurringOut, money(m.expenses.recurring)) : null}
              {line(t.committed, money(m.expenses.committed))}
              {line(t.projectedOut, money(m.expenses.projected), true)}
            </dl>
            <p className="muted-cell">{t.average(money(m.expenses.average))}</p>

            <p className={`forecast-balance ${tone(m.balance)}`}>
              {t.balance}: <strong>{money(m.balance)}</strong>
            </p>
          </article>
        ))}
      </div>

      <div className="chart-card">
        <h3 className="chart-heading">{t.itemsHeading}</h3>
        <p className="muted-cell block">{t.itemsHelp}</p>

        {forecast.items.length === 0 ? (
          <p className="empty-state compact">{t.itemsEmpty}</p>
        ) : (
          <ul className="mini-list">
            {forecast.items.map((item) => (
              <li key={item.id} className={`mini-row scheduled-row${item.status === "pending" ? "" : " done"}`}>
                <span className="mini-row-label">
                  <strong>{item.description}</strong>
                  <span className="muted-cell">
                    {" "}
                    · {item.kind === "expense" ? t.kindExpense : t.kindIncome} · {formatDate(item.due_date, locale)}
                    {item.category ? ` · ${translateCategory(item.category, locale) ?? item.category}` : ""}
                  </span>{" "}
                  <span className={`chip ${item.overdue ? "status-over" : "muted"}`}>
                    {item.overdue ? t.overdue : statusLabel[item.status]}
                  </span>
                </span>
                <span className={`nowrap ${item.kind === "expense" ? "negative" : "positive"}`}>
                  {item.kind === "expense" ? "−" : "+"}
                  {money(item.amount)}
                </span>
                {demo ? null : (
                  <ScheduledActions
                    id={item.id}
                    paid={item.paid}
                    labels={{ markPaid: t.markPaid, unmark: t.unmark, remove: t.remove }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {demo ? null : (
          <>
            <h4 className="forecast-sub">{t.formHeading}</h4>
            <ScheduledForm
              options={options}
              today={today}
              labels={{
                kindExpense: t.kindExpense,
                kindIncome: t.kindIncome,
                description: t.description,
                amount: t.amount,
                dueDate: t.dueDate,
                category: t.category,
                none: t.noCategory,
                add: t.add,
                added: t.added,
              }}
            />
          </>
        )}
      </div>
    </section>
  );
}
