import type { ActionLogEntry } from "@azulito/shared";
import { formatDateTime } from "@/lib/format";
import { describeAction } from "@/lib/history-message";
import { UndoButton } from "@/components/undo-button";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

/** Ações recentes, cada uma com o botão de desfazer; só apresentação. */
export function HistoryView({
  actions,
  locale,
  dict,
  loadError = false,
}: {
  actions: ActionLogEntry[];
  locale: Locale;
  dict: Dictionary;
  loadError?: boolean;
}) {
  const t = dict.history;

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.history}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
      </header>

      <section className="chart-card">
        {loadError ? (
          <p role="alert" className="form-error">
            {dict.dashboard.loadError}
          </p>
        ) : actions.length === 0 ? (
          <p className="empty-state">{t.empty}</p>
        ) : (
          <ul className="account-list">
            {actions.map((action) => (
              <li key={action.id} className="account-item">
                <div className="account-info">
                  <strong>{describeAction(action, locale, dict)}</strong>
                  <span className="muted-cell">{formatDateTime(action.created_at, locale)}</span>
                </div>
                {action.undone_at ? (
                  <span className="chip muted">{t.undoneAt(formatDateTime(action.undone_at, locale))}</span>
                ) : (
                  <UndoButton id={action.id} label={t.undo} failedLabel={t.failed} />
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="tx-totals-note">{t.note}</p>
      </section>
    </main>
  );
}
