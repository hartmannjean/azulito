import {
  fetchAccounts,
  fetchAudit,
  fetchCardComparison,
  fetchBudgetsProgress,
  fetchRecurring,
  fetchTransactionsCategories,
  fetchTransactionsPage,
  fetchTransactionsSummary,
  fetchTransactionsTrend,
} from "@/lib/api-client";
import { requireSession } from "@/lib/session";
import { resolveMonthWithTrend } from "@/lib/month";
import { DashboardView, type DashboardData } from "@/components/dashboard-view";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { shiftMonth } from "@/lib/format";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const session = await requireSession();

  const { month, trend: resolvedTrend } = await resolveMonthWithTrend(session.cookie, monthParam);
  const previousMonth = shiftMonth(month, -1);

  const data: DashboardData = {
    firstName: session.email?.split("@")[0] ?? "",
    month,
    accounts: [],
    summary: null,
    previousSummary: null,
    categories: null,
    trend: [],
    budgets: null,
    recurring: null,
    recent: [],
    uncategorized: 0,
    loadError: false,
  };

  try {
    const sessionCookie = session.cookie;
    const [accounts, summary, previousSummary, categories, trend, budgets, recurring, recent, none, audit, cardComparison] =
      await Promise.all([
        fetchAccounts(sessionCookie),
        fetchTransactionsSummary(sessionCookie, month),
        fetchTransactionsSummary(sessionCookie, previousMonth),
        fetchTransactionsCategories(sessionCookie, month),
        resolvedTrend ?? fetchTransactionsTrend(sessionCookie, 6),
        fetchBudgetsProgress(sessionCookie, month),
        fetchRecurring(sessionCookie),
        fetchTransactionsPage(sessionCookie, { month, limit: 8 }),
        fetchTransactionsPage(sessionCookie, { category: "__none__", limit: 1 }),
        // A revisão da IA é um extra: se falhar, o resto do dashboard segue.
        fetchAudit(sessionCookie).catch(() => null),
        fetchCardComparison(sessionCookie).catch(() => null),
      ]);
    Object.assign(data, {
      accounts,
      summary,
      previousSummary,
      categories,
      trend: trend.trend,
      budgets,
      recurring,
      recent: recent.transactions,
      uncategorized: none.total,
      audit,
      cardComparison,
    });
  } catch (err) {
    console.error("Falha ao carregar dashboard:", err);
    data.loadError = true;
  }

  return <DashboardView data={data} locale={locale} dict={dict} />;
}
