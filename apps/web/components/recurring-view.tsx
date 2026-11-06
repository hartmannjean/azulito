import { getCategoryIcon } from "@/lib/category-icons";
import { AiSays } from "@/components/ai-says";
import { AiHelp } from "@/components/ai-help";
import { translateCategory } from "@/lib/i18n/category-names";
import { formatCurrency, formatDate } from "@/lib/format";
import { AiButton } from "@/components/ai-button";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import type { RecurringSummary } from "@azulito/shared";

/** Gastos recorrentes; só apresentação. */
export function RecurringView({
  recurring,
  locale,
  dict,
  loadError = false,
  demo = false,
}: {
  recurring: RecurringSummary | null;
  locale: Locale;
  dict: Dictionary;
  loadError?: boolean;
  demo?: boolean;
}) {
  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.recurring}</h1>
          <p className="page-subtitle">{dict.recurringPage.help}</p>
        </div>
      </header>

      {loadError || !recurring ? (
        <p role="alert" className="form-error">
          {dict.dashboard.loadError}
        </p>
      ) : recurring.items.length === 0 ? (
        <p className="empty-state">{dict.recurringPage.empty}</p>
      ) : (
        <>
          {(() => {
            const charged = Math.max(0, recurring.monthly_total - recurring.pending_total);
            const pct = recurring.monthly_total > 0 ? Math.min(100, (charged / recurring.monthly_total) * 100) : 0;
            return (
              <section className="chart-card rec-hero">
                <div className="rec-hero-main">
                  <span className="summary-label">{dict.recurringPage.monthlyTotal}</span>
                  <span className="rec-hero-total">{formatCurrency(recurring.monthly_total, locale)}</span>
                </div>
                <div className="rec-hero-meter">
                  <div className="progress-track large">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="rec-hero-legend">
                    <span>
                      <i className="legend-dot income" /> {dict.recurringPage.charged} <b>{formatCurrency(charged, locale)}</b>
                    </span>
                    <span>
                      <i className="legend-dot expense" /> {dict.recurringPage.pendingTotal}{" "}
                      <b className="negative">{formatCurrency(recurring.pending_total, locale)}</b>
                    </span>
                  </div>
                </div>
              </section>
            );
          })()}

          <section className="chart-card flush">
            <div className="table-scroll">
              <table className="tx-table rec-table">
                <thead>
                  <tr>
                    <th>{dict.txPage.columns.description}</th>
                    <th>{dict.txPage.columns.category}</th>
                    <th>{dict.recurringPage.colMonths}</th>
                    <th>{dict.recurringPage.colStatus}</th>
                    <th className="num">{dict.recurringPage.expected}</th>
                  </tr>
                </thead>
                <tbody>
                  {recurring.items.map((item) => (
                    <tr key={item.merchant}>
                      <td className="tx-desc">
                        <span title={item.merchant}>{item.merchant}</span>
                        <span className="chip muted">
                          {dict.recurringPage.lastCharge(formatDate(item.last_date, locale))}
                        </span>
                      </td>
                      <td className="nowrap muted-cell">
                        {item.category
                          ? `${getCategoryIcon(item.category) ?? ""} ${translateCategory(item.category, locale)}`
                          : "—"}
                      </td>
                      <td className="nowrap muted-cell">{dict.recurringPage.monthsSeen(item.months_seen)}</td>
                      <td>
                        <span className={`chip ${item.charged_this_month ? "status-ok" : "status-warn"}`}>
                          {item.charged_this_month ? dict.recurringPage.charged : dict.recurringPage.pendingTotal}
                        </span>
                      </td>
                      <td className="num nowrap tx-amount-cell negative">
                        {formatCurrency(-item.amount, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {demo ? null : (
            <section className="chart-card">
              <h2 className="chart-heading">{dict.recurringAi.heading}</h2>
              <AiHelp label={dict.common.howItWorks}>{dict.recurringAi.help}</AiHelp>
              {recurring.insight ? (
                <>
                  <AiSays moreLabel={dict.common.readMore} lessLabel={dict.common.readLess}>
                    <p className="insight-text">{recurring.insight.content}</p>
                  </AiSays>
                  <p className="muted-cell block">{dict.recurringAi.updated(formatDate(recurring.insight.created_at, locale))}</p>
                </>
              ) : (
                <p className="muted-cell block">{dict.recurringAi.none}</p>
              )}
              <AiButton
                kind="recurring"
                label={dict.recurringAi.button}
                runningLabel={dict.recurringAi.running}
                errorLabel={dict.recurringAi.failed}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
