import { fetchSavings } from "@/lib/api-client";
import { requireSession } from "@/lib/session";
import { SavingsView } from "@/components/savings-view";
import { currentMonth } from "@/lib/format";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { SavingsOverview } from "@azulito/shared";

export default async function SavingsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const session = await requireSession();

  let overview: SavingsOverview | null = null;
  let loadError = false;
  try {
    overview = await fetchSavings(session.cookie);
  } catch (err) {
    console.error("Falha ao carregar as caixinhas:", err);
    loadError = true;
  }

  return (
    <SavingsView overview={overview} currentMonth={currentMonth()} locale={locale} dict={dict} loadError={loadError} />
  );
}
