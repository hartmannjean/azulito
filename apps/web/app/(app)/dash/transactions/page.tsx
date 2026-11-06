import { fetchAccounts, fetchForecast, fetchTransactionsPage, fetchUserCategories } from "@/lib/api-client";
import { requireSession } from "@/lib/session";
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
  view?: string;
  p?: string;
};

// A api entrega no máximo 200 por página; o agrupamento junta várias, com teto.
const API_PAGE = 200;
const GROUP_CAP = 800;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const session = await requireSession();

  const page = Math.max(1, Math.min(2000, Number(raw.p) || 1));
  const search: TransactionsSearch = {
    q: raw.q,
    account: raw.account,
    category: raw.category,
    type: raw.type === "income" || raw.type === "expense" ? raw.type : undefined,
    month: raw.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month) ? raw.month : undefined,
    excluded: raw.excluded === "1",
    view: raw.view === "groups" ? "groups" : undefined,
  };
  const grouped = search.view === "groups";
  // Agrupar um histórico inteiro não ajuda: por padrão olha o mês corrente.
  if (grouped && !search.month) search.month = new Date().toISOString().slice(0, 7);

  let accounts: Account[] = [];
  let transactions: Transaction[] = [];
  let total = 0;
  let customCategories: string[] = [];
  let totals: TransactionsPage["totals"] = { income: 0, expenses: 0, balance: 0 };
  let forecast: ForecastResponse | null = null;
  let loadError = false;
  let truncated = false;

  try {
    const filters = {
      q: search.q,
      account_id: search.account,
      category: search.category,
      type: search.type,
      month: search.month,
      show_excluded: search.excluded ? "1" : undefined,
    };
    const loadTransactions = async (): Promise<TransactionsPage> => {
      if (!grouped) {
        return fetchTransactionsPage(session.cookie, {
          ...filters,
          limit: TRANSACTIONS_PAGE_SIZE,
          offset: (page - 1) * TRANSACTIONS_PAGE_SIZE,
        });
      }
      const first = await fetchTransactionsPage(session.cookie, { ...filters, limit: API_PAGE, offset: 0 });
      const more: Promise<TransactionsPage>[] = [];
      for (let offset = API_PAGE; offset < Math.min(first.total, GROUP_CAP); offset += API_PAGE) {
        more.push(fetchTransactionsPage(session.cookie, { ...filters, limit: API_PAGE, offset }));
      }
      const rest = await Promise.all(more);
      return { ...first, transactions: [...first.transactions, ...rest.flatMap((result) => result.transactions)] };
    };

    const [accountsResult, pageResult, categoriesResult, forecastResult] = await Promise.all([
      fetchAccounts(session.cookie),
      loadTransactions(),
      fetchUserCategories(session.cookie),
      // A previsão é um extra: se falhar, a lista de transações segue normal.
      fetchForecast(session.cookie).catch(() => null),
    ]);
    forecast = forecastResult;
    customCategories = categoriesResult.map((category) => category.name);
    accounts = accountsResult;
    transactions = pageResult.transactions;
    total = pageResult.total;
    truncated = grouped && pageResult.total > GROUP_CAP;
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
      truncated={truncated}
      forecast={forecast}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
