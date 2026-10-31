import { AccountsView } from "@/components/accounts-view";
import { getDemoData } from "@/lib/demo-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function DemoAccountsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return <AccountsView accounts={getDemoData().accounts} locale={locale} dict={dict} demo />;
}
