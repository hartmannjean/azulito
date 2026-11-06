import Link from "next/link";
import { TransactionTable } from "@/components/transaction-table";
import { CategoryGroups } from "@/components/category-groups";
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
  /** "groups" = extrato agrupado por categoria (padrão: lista). */
  view?: "groups";
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
  truncated = false,
}: {
  /** No agrupamento: havia mais lançamentos do que o teto carregado. */
  truncated?: boolean;
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

  const extraActive = [search.q, search.account, search.category, search.excluded].filter(Boolean).length;
  const typeOptions = [
    { value: "", label: dict.txPage.typeAll },
    { value: "income", label: dict.txPage.income },
    { value: "expense", label: dict.txPage.expense },
  ];

  function queryOf(view: TransactionsSearch["view"], target = 1): string {
    const params = new URLSearchParams();
    if (view) params.set("view", view);
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

  const pageHref = (target: number) => queryOf(search.view, target);
  const grouped = search.view === "groups";

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.transactions}</h1>
          <p className="page-subtitle">{dict.txPage.total(total)}</p>
        </div>
        <div className="view-toggle" role="group" aria-label={dict.txPage.viewLabel}>
          <Link href={queryOf(undefined)} aria-current={grouped ? undefined : "page"} className={grouped ? undefined : "active"}>
            {dict.txPage.viewList}
          </Link>
          <Link href={queryOf("groups")} aria-current={grouped ? "page" : undefined} className={grouped ? "active" : undefined}>
            {dict.txPage.viewGroups}
          </Link>
        </div>
      </header>

      <AutoSubmitForm
        basePath={basePath}
        className="filter-bar filter-sticky"
        clearLabel={dict.txPage.clear}
        moreLabel={dict.txPage.moreFilters}
        extraActive={extraActive}
        extra={
          <>
            <input
              type="search"
              name="q"
              defaultValue={search.q ?? ""}
              placeholder={dict.txPage.searchPlaceholder}
              aria-label={dict.txPage.searchPlaceholder}
              maxLength={80}
              className="filter-search"
            />
            <select name="account" defaultValue={search.account ?? ""} aria-label={dict.txPage.columns.account}>
              <option value="">{dict.txPage.allAccounts}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.institution_name} · {dict.accountsPage.kind[account.kind]}
                </option>
              ))}
            </select>
            <select name="category" defaultValue={search.category ?? ""} aria-label={dict.txPage.columns.category}>
              <option value="">{dict.txPage.allCategories}</option>
              <option value="__none__">{dict.txPage.uncategorized}</option>
              {buildCategoryOptions(locale, customCategories).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="filter-check">
              <input type="checkbox" name="excluded" value="1" defaultChecked={search.excluded ?? false} />
              {dict.txPage.showExcluded}
            </label>
          </>
        }
      >
        {grouped ? <input type="hidden" name="view" value="groups" /> : null}
        <div className="filter-seg" role="radiogroup" aria-label={dict.txPage.typeLabel}>
          {typeOptions.map((option) => (
            <label key={option.value || "all"} className="filter-seg-opt">
              <input type="radio" name="type" value={option.value} defaultChecked={(search.type ?? "") === option.value} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <input type="month" name="month" defaultValue={search.month ?? ""} aria-label={dict.txPage.month} className="filter-month" />
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
            {grouped ? (
              <>
                {truncated ? <p className="muted-cell groups-note">{dict.txPage.groupsTruncated(transactions.length, total)}</p> : null}
                <CategoryGroups
                  transactions={transactions}
                  locale={locale}
                  dict={dict}
                  readOnly={readOnly}
                  customCategories={customCategories}
                />
              </>
            ) : (
              <TransactionTable
                transactions={transactions}
                locale={locale}
                dict={dict.txPage}
                readOnly={readOnly}
                customCategories={customCategories}
              />
            )}
            {!grouped && pages > 1 ? (
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
