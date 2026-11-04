import { CategoriesView } from "@/components/categories-view";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function DemoCategoriesPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <CategoriesView
      categories={[{ id: "demo-1", name: locale === "pt-BR" ? "Viagem em grupo" : "Group trip" }]}
      locale={locale}
      dict={dict}
      demo
    />
  );
}
