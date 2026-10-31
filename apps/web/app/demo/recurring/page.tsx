import { RecurringView } from "@/components/recurring-view";
import { getDemoData } from "@/lib/demo-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function DemoRecurringPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return <RecurringView recurring={getDemoData().recurring} locale={locale} dict={dict} />;
}
