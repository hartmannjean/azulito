import { fetchRecurring } from "@/lib/api-client";
import { requireAccess } from "@/lib/access";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { formatCurrency, formatDate } from "@/lib/format";
import type { RecurringSummary } from "@azulito/shared";

export default async function RecurringPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const access = await requireAccess();

  let recurring: RecurringSummary | null = null;
  let loadError = false;
  try {
    recurring = await fetchRecurring(access.jwt);
  } catch (err) {
    console.error("Falha ao carregar recorrências:", err);
    loadError = true;
  }

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
          <div className="summary-cards two">
            <div className="summary-card">
              <span className="summary-label">{dict.recurringPage.monthlyTotal}</span>
              <span className="summary-value">{formatCurrency(recurring.monthly_total, locale)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">{dict.recurringPage.pendingTotal}</span>
              <span className="summary-value negative">{formatCurrency(recurring.pending_total, locale)}</span>
            </div>
          </div>

          <section className="chart-card flush">
            <div className="table-scroll">
              <table className="tx-table">
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
                        <span className="chip muted">{dict.recurringPage.lastCharge(formatDate(item.last_date, locale))}</span>
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
        </>
      )}
    </main>
  );
}
