import { DashboardView, type DashboardData } from "@/components/dashboard-view";
import { getDemoData } from "@/lib/demo-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function DemoPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const demo = getDemoData();

  const data: DashboardData = {
    firstName: "demo",
    month: demo.month,
    accounts: demo.accounts,
    summary: demo.summary,
    previousSummary: demo.previousSummary,
    categories: demo.categories,
    trend: demo.trend,
    budgets: demo.budgets,
    recurring: demo.recurring,
    recent: demo.transactions.filter((tx) => !tx.excluded).slice(0, 8),
    uncategorized: demo.uncategorized,
    loadError: false,
  };

  return <DashboardView data={data} locale={locale} dict={dict} demo />;
}
