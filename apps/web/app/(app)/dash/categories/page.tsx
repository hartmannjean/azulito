import { fetchUserCategories } from "@/lib/api-client";
import { requireAccess } from "@/lib/access";
import { CategoriesView } from "@/components/categories-view";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { UserCategory } from "@azulito/shared";

export default async function CategoriesPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const access = await requireAccess();

  let categories: UserCategory[] = [];
  let loadError = false;
  try {
    categories = await fetchUserCategories(access.jwt);
  } catch (err) {
    console.error("Falha ao carregar categorias:", err);
    loadError = true;
  }

  return <CategoriesView categories={categories} locale={locale} dict={dict} loadError={loadError} />;
}
