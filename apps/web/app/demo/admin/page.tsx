import { AdminView } from "@/components/admin-view";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function DemoAdminPage() {
  const dict = getDictionary(await getLocale());
  return <AdminView base="/demo" dict={dict} demo />;
}
