import { ImportOfxButton } from "@/components/import-ofx-button";
import { CategorizeButton } from "@/components/categorize-button";
import { formatDate } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import type { Account } from "@azulito/shared";

/** Contas e importação; só apresentação. `demo` desliga o upload e a categorização. */
export function AccountsView({
  accounts,
  locale,
  dict,
  loadError = false,
  demo = false,
}: {
  accounts: Account[];
  locale: Locale;
  dict: Dictionary;
  loadError?: boolean;
  demo?: boolean;
}) {
  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.accounts}</h1>
        </div>
      </header>

      <div className="grid-two">
        <section className="chart-card">
          <h2 className="chart-heading">{dict.accountsPage.importHeading}</h2>
          <p className="muted-cell block">{dict.accountsPage.importHelp}</p>
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
        </section>

        <section className="chart-card">
          <h2 className="chart-heading">{dict.accountsPage.aiHeading}</h2>
          <p className="muted-cell block">{dict.accountsPage.aiHelp}</p>
          {demo ? (
            <button type="button" className="button secondary" disabled title={dict.demo.disabledHint}>
              {dict.accountsPage.aiButton}
            </button>
          ) : (
            <CategorizeButton label={dict.accountsPage.aiButton} runningLabel={dict.accountsPage.aiRunning} />
          )}
        </section>
      </div>

      <section className="chart-card">
        <h2 className="chart-heading">{dict.accountsPage.accountsHeading}</h2>
        {loadError ? (
          <p role="alert" className="form-error">
            {dict.dashboard.loadError}
          </p>
        ) : accounts.length === 0 ? (
          <p className="empty-state">{dict.accountsPage.empty}</p>
        ) : (
          <ul className="account-list">
            {accounts.map((account) => (
              <li key={account.id} className="account-item">
                <span className="account-icon" aria-hidden="true">
                  {account.kind === "credit_card" ? "💳" : "🏦"}
                </span>
                <div className="account-info">
                  <strong>{account.institution_name}</strong>
                  <span className="muted-cell">{dict.accountsPage.kind[account.kind]}</span>
                </div>
                <span className="muted-cell">
                  {account.last_import_at
                    ? dict.accountsPage.lastImport(formatDate(account.last_import_at, locale))
                    : dict.accountsPage.neverImported}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
