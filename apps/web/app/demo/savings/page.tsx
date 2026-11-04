import { SavingsView } from "@/components/savings-view";
import { getDemoSavings } from "@/lib/demo-data";
import { currentMonth } from "@/lib/format";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function DemoSavingsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return <SavingsView overview={getDemoSavings()} currentMonth={currentMonth()} locale={locale} dict={dict} demo />;
}
