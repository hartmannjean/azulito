import Link from "next/link";
import { CATEGORIES } from "@azulito/shared";
import { TransactionTable } from "@/components/transaction-table";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import type { Account, Transaction } from "@azulito/shared";

export const TRANSACTIONS_PAGE_SIZE = 50;

export type TransactionsSearch = {
  q?: string;
  account?: string;
  category?: string;
  type?: "income" | "expense";
  month?: string;
};

/** Listagem filtrável; só apresentação (dados e filtros chegam prontos). */
export function TransactionsView({
  transactions,
  total,
  accounts,
  search,
  page,
  basePath,
  locale,
  dict,
  loadError = false,
  readOnly = false,
}: {
  transactions: Transaction[];
  total: number;
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

  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (search.q) params.set("q", search.q);
    if (search.account) params.set("account", search.account);
    if (search.category) params.set("category", search.category);
    if (search.type) params.set("type", search.type);
    if (search.month) params.set("month", search.month);
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

      <form method="get" action={basePath} className="filter-bar">
        <input
          type="search"
          name="q"
          defaultValue={search.q ?? ""}
          placeholder={dict.txPage.searchPlaceholder}
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
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {getCategoryIcon(category)} {translateCategory(category, locale)}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={search.type ?? ""} aria-label={dict.txPage.allTypes}>
          <option value="">{dict.txPage.allTypes}</option>
          <option value="income">{dict.txPage.income}</option>
          <option value="expense">{dict.txPage.expense}</option>
        </select>
        <input type="month" name="month" defaultValue={search.month ?? ""} aria-label={dict.txPage.month} />
        <button type="submit" className="button small">
          {dict.txPage.apply}
        </button>
        <Link href={basePath} className="button secondary small">
          {dict.txPage.clear}
        </Link>
      </form>

      {loadError ? (
        <p role="alert" className="form-error">
          {dict.dashboard.loadError}
        </p>
      ) : (
        <section className="chart-card flush">
          <TransactionTable transactions={transactions} locale={locale} dict={dict.txPage} readOnly={readOnly} />
          {pages > 1 ? (
            <nav className="pagination" aria-label="Paginação">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="button secondary small">
                  ‹ {dict.txPage.previous}
                </Link>
              ) : (
                <span />
              )}
              <span className="muted-cell">{dict.txPage.page(page, pages)}</span>
              {page < pages ? (
                <Link href={pageHref(page + 1)} className="button secondary small">
                  {dict.txPage.next} ›
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      )}
    </main>
  );
}
