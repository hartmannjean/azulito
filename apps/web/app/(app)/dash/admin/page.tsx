import { AdminView } from "@/components/admin-view";
import { requireSession } from "@/lib/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function AdminPage() {
  await requireSession();
  const dict = getDictionary(await getLocale());
  return <AdminView base="/dash" dict={dict} />;
}
