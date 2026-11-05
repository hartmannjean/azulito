import { fetchAccounts, fetchImports } from "@/lib/api-client";
import { requireSession } from "@/lib/session";
import { AccountsView } from "@/components/accounts-view";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Account, ImportLogEntry } from "@azulito/shared";

export default async function AccountsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const session = await requireSession();

  let accounts: Account[] = [];
  let imports: ImportLogEntry[] = [];
  let loadError = false;
  try {
    [accounts, imports] = await Promise.all([fetchAccounts(session.cookie), fetchImports(session.cookie).catch(() => [])]);
  } catch (err) {
    console.error("Falha ao carregar contas:", err);
    loadError = true;
  }

  return <AccountsView accounts={accounts} imports={imports} locale={locale} dict={dict} loadError={loadError} />;
}
