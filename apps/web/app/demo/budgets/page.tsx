import { BudgetsView } from "@/components/budgets-view";
import { getDemoData } from "@/lib/demo-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function DemoBudgetsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const demo = getDemoData();

  return (
    <BudgetsView
      progress={demo.budgets}
      month={demo.month}
      basePath="/demo/budgets"
      locale={locale}
      dict={dict}
      demo
    />
  );
}
