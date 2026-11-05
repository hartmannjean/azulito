import type { SavingsOverview } from "@azulito/shared";
import { AiSays } from "@/components/ai-bot";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/format";
import { SavingsForm } from "@/components/savings-form";
import { SavingsChart } from "@/components/savings-chart";
import { parseSavingsPlan } from "@/lib/plan";
import { SavingsInsightButton } from "@/components/savings-insight-button";
import { RemoveSavingsButton } from "@/components/remove-savings-button";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { numberFormat } from "@/lib/intl-cache";

function percent(value: number, locale: Locale): string {
  return numberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    value,
  );
}

/** Caixinhas mês a mês, previsão e análise da IA; só apresentação. `demo` desliga as ações. */
export function SavingsView({
  overview,
  currentMonth,
  locale,
  dict,
  loadError = false,
  demo = false,
}: {
  overview: SavingsOverview | null;
  currentMonth: string;
  locale: Locale;
  dict: Dictionary;
  loadError?: boolean;
  demo?: boolean;
}) {
  const t = dict.savingsPage;
  const money = (value: number) => formatCurrency(value, locale);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
  const tone = (value: number) => (value > 0 ? "positive" : value < 0 ? "negative" : "");

  const hasData = overview !== null && overview.months.some((m) => m.applied > 0 || m.withdrawn > 0 || m.closing !== null);
  const lastForecast = overview?.forecast[overview.forecast.length - 1] ?? null;
  const plan = overview?.insight ? parseSavingsPlan(overview.insight.content) : null;

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.savings}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
      </header>

      {loadError || overview === null ? (
        <p role="alert" className="form-error">
          {dict.dashboard.loadError}
        </p>
      ) : (
        <>
          <section className="tx-totals" aria-label={t.summaryLabel}>
            <div className="tx-total">
              <span className="summary-label">
                {t.currentBalance}
                {overview.current_balance_estimated ? ` (${t.estimated})` : ""}
              </span>
              <span className="tx-total-value">
                {overview.current_balance === null ? "—" : money(overview.current_balance)}
              </span>
            </div>
            <div className="tx-total">
              <span className="summary-label">{t.totalYield}</span>
              <span className={`tx-total-value ${tone(overview.total_yield)}`}>{signed(overview.total_yield)}</span>
            </div>
            <div className="tx-total">
              <span className="summary-label">{t.avgNet}</span>
              <span className={`tx-total-value ${tone(overview.assumptions?.avg_net ?? 0)}`}>
                {overview.assumptions ? signed(overview.assumptions.avg_net) : "—"}
              </span>
            </div>
            <div className="tx-total">
              <span className="summary-label">{t.forecastIn3}</span>
              <span className="tx-total-value">{lastForecast ? money(lastForecast.balance) : "—"}</span>
            </div>
          </section>

          <SavingsChart overview={overview} locale={locale} dict={dict} />

          <section className="chart-card">
            <h2 className="chart-heading">{t.formHeading}</h2>
            <p className="muted-cell block">{t.formHelp}</p>
            {demo ? (
              <p className="muted-cell block">{dict.demo.disabledHint}</p>
            ) : (
              <SavingsForm
                defaultMonth={currentMonth}
                maxMonth={currentMonth}
                labels={{ month: t.month, balance: t.balance, save: t.save, saved: t.saved }}
              />
            )}
          </section>

          <section className="chart-card flush">
            <h2 className="chart-heading padded">{t.tableHeading}</h2>
            {!hasData ? (
              <p className="empty-state">{t.empty}</p>
            ) : (
              <div className="table-scroll">
                <table className="tx-table plain-table">
                  <thead>
                    <tr>
                      <th>{t.columns.month}</th>
                      <th className="num">{t.columns.opening}</th>
                      <th className="num">{t.columns.applied}</th>
                      <th className="num">{t.columns.withdrawn}</th>
                      <th className="num">{t.columns.yield}</th>
                      <th className="num">{t.columns.closing}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.months.map((row) => (
                      <tr key={row.month}>
                        <td className="nowrap">{formatMonthLabel(row.month, locale)}</td>
                        <td className="num nowrap">{row.opening === null ? "—" : money(row.opening)}</td>
                        <td className="num nowrap">{row.applied > 0 ? money(row.applied) : "—"}</td>
                        <td className="num nowrap">{row.withdrawn > 0 ? money(row.withdrawn) : "—"}</td>
                        <td className={`num nowrap ${row.yield === null ? "" : tone(row.yield)}`}>
                          {row.yield === null ? (
                            "—"
                          ) : (
                            <>
                              {signed(row.yield)}
                              {row.yield_pct !== null ? (
                                <span className="muted-cell"> · {percent(row.yield_pct, locale)}</span>
                              ) : null}
                            </>
                          )}
                        </td>
                        <td className="num nowrap">
                          {row.closing === null ? (
                            "—"
                          ) : (
                            <>
                              {money(row.closing)}
                              {demo ? null : <RemoveSavingsButton month={row.month} label={t.remove} />}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {overview.forecast.map((point) => (
                      <tr key={point.month} className="forecast-row">
                        <td className="nowrap">
                          {formatMonthLabel(point.month, locale)} <span className="chip muted">{t.forecastTag}</span>
                        </td>
                        <td className="num">—</td>
                        <td className="num nowrap">{point.net > 0 ? money(point.net) : "—"}</td>
                        <td className="num nowrap">{point.net < 0 ? money(-point.net) : "—"}</td>
                        <td className={`num nowrap ${tone(point.yield)}`}>{signed(point.yield)}</td>
                        <td className="num nowrap">{money(point.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {overview.assumptions ? (
              <p className="tx-totals-note padded">
                {t.assumptions(signed(overview.assumptions.avg_net), percent(overview.assumptions.avg_rate, locale))}
              </p>
            ) : hasData ? (
              <p className="tx-totals-note padded">{t.needBalance}</p>
            ) : null}
          </section>

          <section className="chart-card">
            <h2 className="chart-heading">{t.aiHeading}</h2>
            <p className="muted-cell block">{t.aiHelp}</p>
            {overview.insight ? (
              <>
                <AiSays>
                  <p className="insight-text">{plan?.summary}</p>
                </AiSays>
                <p className="muted-cell block">{t.aiUpdated(formatDate(overview.insight.created_at, locale))}</p>
              </>
            ) : (
              <p className="muted-cell block">{t.aiNone}</p>
            )}
            {demo ? (
              <button type="button" className="button secondary" disabled title={dict.demo.disabledHint}>
                {t.aiButton}
              </button>
            ) : (
              <SavingsInsightButton label={t.aiButton} runningLabel={t.aiRunning} errorLabel={t.aiFailed} />
            )}
          </section>

          {plan && plan.sections.length > 0 ? (
            <>
              <h2 className="chart-heading plan-heading">{dict.plan.heading}</h2>
              <div className="plan-grid">
                {plan.sections.map((section) => (
                  <section key={section.category} className="chart-card">
                    <h3 className="plan-title">
                      {dict.plan.section(section.category, money(section.average), money(section.saving))}
                    </h3>
                    <AiSays>
                      <p className="insight-text">{section.text}</p>
                    </AiSays>
                  </section>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
