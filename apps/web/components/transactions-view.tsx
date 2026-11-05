import Link from "next/link";
import { TransactionTable } from "@/components/transaction-table";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { ForecastSection } from "@/components/forecast-section";
import { buildCategoryOptions } from "@/lib/category-options";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { formatCurrency } from "@/lib/format";
import type { Account, ForecastResponse, Transaction, TransactionsPage } from "@azulito/shared";

export const TRANSACTIONS_PAGE_SIZE = 50;

export type TransactionsSearch = {
  q?: string;
  account?: string;
  category?: string;
  type?: "income" | "expense";
  month?: string;
  /** Mostra também o que está fora das somas (fatura paga, aplicação/resgate). */
  excluded?: boolean;
};

/** Listagem filtrável; só apresentação (dados e filtros chegam prontos). */
export function TransactionsView({
  transactions,
  total,
  totals,
  customCategories = [],
  accounts,
  search,
  page,
  basePath,
  locale,
  dict,
  loadError = false,
  readOnly = false,
  forecast = null,
  today = "",
}: {
  /** Previsão e contas a pagar (opcional: some se a api falhar). */
  forecast?: ForecastResponse | null;
  /** AAAA-MM-DD, vencimento padrão do formulário de contas. */
  today?: string;
  transactions: Transaction[];
  total: number;
  totals: TransactionsPage["totals"];
  customCategories?: string[];
  accounts: Account[];
  search: TransactionsSearch;
  page: number;
  /** "/dash/transactions" ou "/demo/transactions". */
  basePath: string;
  locale: Locale;
  dict: Dictionary;
  loadError?: boolean;
  readOnly?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE));
  const activeFilters = [search.q, search.account, search.category, search.type, search.month, search.excluded].filter(Boolean).length;

  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (search.q) params.set("q", search.q);
    if (search.account) params.set("account", search.account);
    if (search.category) params.set("category", search.category);
    if (search.type) params.set("type", search.type);
    if (search.month) params.set("month", search.month);
    if (search.excluded) params.set("excluded", "1");
    if (target > 1) params.set("p", String(target));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.transactions}</h1>
          <p className="page-subtitle">{dict.txPage.total(total)}</p>
        </div>
      </header>

      <AutoSubmitForm basePath={basePath} className="filter-bar filter-sticky" clearLabel={dict.txPage.clear}>
        <input
          type="search"
          name="q"
          defaultValue={search.q ?? ""}
          placeholder={dict.txPage.searchPlaceholder}
          maxLength={80}
          className="filter-search"
        />
        <select
          name="account"
          defaultValue={search.account ?? ""}
          aria-label={dict.txPage.columns.account}
        >
          <option value="">{dict.txPage.allAccounts}</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.institution_name} ·{" "}
              {dict.accountsPage.kind[account.kind]}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={search.category ?? ""}
          aria-label={dict.txPage.columns.category}
        >
          <option value="">{dict.txPage.allCategories}</option>
          <option value="__none__">{dict.txPage.uncategorized}</option>
          {buildCategoryOptions(locale, customCategories).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={search.type ?? ""}
          aria-label={dict.txPage.allTypes}
        >
          <option value="">{dict.txPage.allTypes}</option>
          <option value="income">{dict.txPage.income}</option>
          <option value="expense">{dict.txPage.expense}</option>
        </select>
        <input
          type="month"
          name="month"
          defaultValue={search.month ?? ""}
          aria-label={dict.txPage.month}
        />
        <label className="filter-check">
          <input type="checkbox" name="excluded" value="1" defaultChecked={search.excluded ?? false} />
          {dict.txPage.showExcluded}
        </label>
      </AutoSubmitForm>

      {activeFilters > 0 ? (
        <div className="filter-summary">
          <span>{dict.txPage.showing(total)}</span>
          <span className="filter-active-count chip muted">{dict.txPage.activeFilters(activeFilters)}</span>
        </div>
      ) : null}

      {forecast ? (
        <details className="forecast-fold">
          <summary>{dict.txPage.forecastFold}</summary>
          <ForecastSection
            forecast={forecast}
            customCategories={customCategories}
            today={today}
            locale={locale}
            dict={dict}
            demo={readOnly}
          />
        </details>
      ) : null}

      {loadError ? (
        <p role="alert" className="form-error">
          {dict.dashboard.loadError}
        </p>
      ) : (
        <>
          <section className="tx-totals" aria-label={dict.txPage.totalsLabel}>
            {search.type !== "expense" ? (
              <div className="tx-total">
                <span className="summary-label">{dict.txPage.income}</span>
                <span className="tx-total-value positive">
                  {formatCurrency(totals.income, locale)}
                </span>
              </div>
            ) : null}
            {search.type !== "income" ? (
              <div className="tx-total">
                <span className="summary-label">{dict.txPage.expense}</span>
                <span className="tx-total-value negative">
                  {formatCurrency(totals.expenses, locale)}
                </span>
              </div>
            ) : null}
            {!search.type ? (
              <div className="tx-total">
                <span className="summary-label">{dict.summary.balance}</span>
                <span
                  className={`tx-total-value ${totals.balance >= 0 ? "positive" : "negative"}`}
                >
                  {formatCurrency(totals.balance, locale)}
                </span>
              </div>
            ) : null}
            <p className="tx-totals-note">{dict.txPage.totalsNote}</p>
          </section>
          <section className="chart-card flush">
            <TransactionTable
              transactions={transactions}
              locale={locale}
              dict={dict.txPage}
              readOnly={readOnly}
              customCategories={customCategories}
            />
            {pages > 1 ? (
              <nav className="pagination" aria-label="Paginação">
                {page > 1 ? (
                  <Link
                    href={pageHref(page - 1)}
                    className="button secondary small"
                  >
                    ‹ {dict.txPage.previous}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="muted-cell">
                  {dict.txPage.page(page, pages)}
                </span>
                {page < pages ? (
                  <Link
                    href={pageHref(page + 1)}
                    className="button secondary small"
                  >
                    {dict.txPage.next} ›
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
