import {
  TransactionsView,
  TRANSACTIONS_PAGE_SIZE,
  type TransactionsSearch,
} from "@/components/transactions-view";
import { getDemoData } from "@/lib/demo-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

type Search = {
  q?: string;
  account?: string;
  category?: string;
  type?: string;
  month?: string;
  p?: string;
};

export default async function DemoTransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const demo = getDemoData();

  const page = Math.max(1, Math.min(2000, Number(raw.p) || 1));
  const search: TransactionsSearch = {
    q: raw.q?.slice(0, 80),
    account: raw.account,
    category: raw.category,
    type: raw.type === "income" || raw.type === "expense" ? raw.type : undefined,
    month: raw.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month) ? raw.month : undefined,
  };

  // Filtros aplicados em memória sobre os dados fictícios.
  const needle = search.q?.toLowerCase();
  const filtered = demo.transactions.filter((tx) => {
    if (needle && !tx.description.toLowerCase().includes(needle)) return false;
    if (search.account && tx.account_id !== search.account) return false;
    if (search.category === "__none__" ? tx.category !== null : search.category && tx.category !== search.category) {
      return false;
    }
    if (search.type === "income" && tx.amount <= 0) return false;
    if (search.type === "expense" && tx.amount >= 0) return false;
    if (search.month && !tx.transaction_date.startsWith(search.month)) return false;
    return true;
  });

  const start = (page - 1) * TRANSACTIONS_PAGE_SIZE;

  return (
    <TransactionsView
      transactions={filtered.slice(start, start + TRANSACTIONS_PAGE_SIZE)}
      total={filtered.length}
      accounts={demo.accounts}
      search={search}
      page={page}
      basePath="/demo/transactions"
      locale={locale}
      dict={dict}
      readOnly
    />
  );
}
