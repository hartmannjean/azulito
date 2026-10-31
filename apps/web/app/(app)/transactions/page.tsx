import Link from "next/link";
import { CATEGORIES } from "@azulito/shared";
import { fetchAccounts, fetchTransactionsPage } from "@/lib/api-client";
import { requireAccess } from "@/lib/access";
import { TransactionTable } from "@/components/transaction-table";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Account, Transaction } from "@azulito/shared";

const PAGE_SIZE = 50;

type Search = {
  q?: string;
  account?: string;
  category?: string;
  type?: string;
  month?: string;
  p?: string;
};

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const access = await requireAccess();

  const page = Math.max(1, Math.min(2000, Number(search.p) || 1));
  const type = search.type === "income" || search.type === "expense" ? search.type : undefined;
  const month = search.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month) ? search.month : undefined;

  let accounts: Account[] = [];
  let transactions: Transaction[] = [];
  let total = 0;
  let loadError = false;

  try {
    const [accountsResult, pageResult] = await Promise.all([
      fetchAccounts(access.jwt),
      fetchTransactionsPage(access.jwt, {
        q: search.q,
        account_id: search.account,
        category: search.category,
        type,
        month,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
    ]);
    accounts = accountsResult;
    transactions = pageResult.transactions;
    total = pageResult.total;
  } catch (err) {
    console.error("Falha ao carregar transações:", err);
    loadError = true;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (search.q) params.set("q", search.q);
    if (search.account) params.set("account", search.account);
    if (search.category) params.set("category", search.category);
    if (type) params.set("type", type);
    if (month) params.set("month", month);
    if (target > 1) params.set("p", String(target));
    const query = params.toString();
    return query ? `/transactions?${query}` : "/transactions";
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.transactions}</h1>
          <p className="page-subtitle">{dict.txPage.total(total)}</p>
        </div>
      </header>

      <form method="get" action="/transactions" className="filter-bar">
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
        <select name="type" defaultValue={type ?? ""} aria-label={dict.txPage.allTypes}>
          <option value="">{dict.txPage.allTypes}</option>
          <option value="income">{dict.txPage.income}</option>
          <option value="expense">{dict.txPage.expense}</option>
        </select>
        <input type="month" name="month" defaultValue={month ?? ""} aria-label={dict.txPage.month} />
        <button type="submit" className="button small">
          {dict.txPage.apply}
        </button>
        <Link href="/transactions" className="button secondary small">
          {dict.txPage.clear}
        </Link>
      </form>

      {loadError ? (
        <p role="alert" className="form-error">
          {dict.dashboard.loadError}
        </p>
      ) : (
        <section className="chart-card flush">
          <TransactionTable transactions={transactions} locale={locale} dict={dict.txPage} />
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
