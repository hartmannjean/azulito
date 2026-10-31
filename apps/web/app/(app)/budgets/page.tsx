import { fetchBudgetsProgress } from "@/lib/api-client";
import { requireAccess } from "@/lib/access";
import { resolveMonth } from "@/lib/month";
import { BudgetsView } from "@/components/budgets-view";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { BudgetsProgress } from "@azulito/shared";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const access = await requireAccess();
  const month = await resolveMonth(access.jwt, monthParam);

  let progress: BudgetsProgress | null = null;
  let loadError = false;
  try {
    progress = await fetchBudgetsProgress(access.jwt, month);
  } catch (err) {
    console.error("Falha ao carregar orçamentos:", err);
    loadError = true;
  }

  return (
    <BudgetsView
      progress={progress}
      month={month}
      basePath="/budgets"
      locale={locale}
      dict={dict}
      loadError={loadError}
    />
  );
}
