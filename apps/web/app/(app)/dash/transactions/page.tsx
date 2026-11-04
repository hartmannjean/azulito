import { fetchAccounts, fetchForecast, fetchTransactionsPage, fetchUserCategories } from "@/lib/api-client";
import { requireAccess } from "@/lib/access";
import {
  TransactionsView,
  TRANSACTIONS_PAGE_SIZE,
  type TransactionsSearch,
} from "@/components/transactions-view";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Account, ForecastResponse, Transaction, TransactionsPage } from "@azulito/shared";

type Search = {
  q?: string;
  account?: string;
  category?: string;
  type?: string;
  month?: string;
  excluded?: string;
  p?: string;
};

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const access = await requireAccess();

  const page = Math.max(1, Math.min(2000, Number(raw.p) || 1));
  const search: TransactionsSearch = {
    q: raw.q,
    account: raw.account,
    category: raw.category,
    type: raw.type === "income" || raw.type === "expense" ? raw.type : undefined,
    month: raw.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month) ? raw.month : undefined,
    excluded: raw.excluded === "1",
  };

  let accounts: Account[] = [];
  let transactions: Transaction[] = [];
  let total = 0;
  let customCategories: string[] = [];
  let totals: TransactionsPage["totals"] = { income: 0, expenses: 0, balance: 0 };
  let forecast: ForecastResponse | null = null;
  let loadError = false;

  try {
    const [accountsResult, pageResult, categoriesResult, forecastResult] = await Promise.all([
      fetchAccounts(access.jwt),
      fetchTransactionsPage(access.jwt, {
        q: search.q,
        account_id: search.account,
        category: search.category,
        type: search.type,
        month: search.month,
        show_excluded: search.excluded ? "1" : undefined,
        limit: TRANSACTIONS_PAGE_SIZE,
        offset: (page - 1) * TRANSACTIONS_PAGE_SIZE,
      }),
      fetchUserCategories(access.jwt),
      // A previsão é um extra: se falhar, a lista de transações segue normal.
      fetchForecast(access.jwt).catch(() => null),
    ]);
    forecast = forecastResult;
    customCategories = categoriesResult.map((category) => category.name);
    accounts = accountsResult;
    transactions = pageResult.transactions;
    total = pageResult.total;
    totals = pageResult.totals;
  } catch (err) {
    console.error("Falha ao carregar transações:", err);
    loadError = true;
  }

  return (
    <TransactionsView
      transactions={transactions}
      total={total}
      totals={totals}
      customCategories={customCategories}
      accounts={accounts}
      search={search}
      page={page}
      basePath="/dash/transactions"
      locale={locale}
      dict={dict}
      loadError={loadError}
      forecast={forecast}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
