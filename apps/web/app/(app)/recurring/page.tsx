import { fetchRecurring } from "@/lib/api-client";
import { requireAccess } from "@/lib/access";
import { RecurringView } from "@/components/recurring-view";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { RecurringSummary } from "@azulito/shared";

export default async function RecurringPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const access = await requireAccess();

  let recurring: RecurringSummary | null = null;
  let loadError = false;
  try {
    recurring = await fetchRecurring(access.jwt);
  } catch (err) {
    console.error("Falha ao carregar recorrências:", err);
    loadError = true;
  }

  return <RecurringView recurring={recurring} locale={locale} dict={dict} loadError={loadError} />;
}
