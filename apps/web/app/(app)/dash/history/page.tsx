import { fetchHistory } from "@/lib/api-client";
import { requireSession } from "@/lib/session";
import { HistoryView } from "@/components/history-view";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { ActionLogEntry } from "@azulito/shared";

export default async function HistoryPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const session = await requireSession();

  let actions: ActionLogEntry[] = [];
  let loadError = false;
  try {
    actions = (await fetchHistory(session.cookie, 50)).actions;
  } catch (err) {
    console.error("Falha ao carregar o histórico:", err);
    loadError = true;
  }

  return <HistoryView actions={actions} locale={locale} dict={dict} loadError={loadError} />;
}
