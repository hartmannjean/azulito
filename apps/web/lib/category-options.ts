import { CATEGORIES } from "@azulito/shared";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import type { CategoryOption } from "@/components/category-select";
import type { Locale } from "@/lib/i18n/locale";

/** Opções de categoria para os seletores: as fixas traduzidas + as criadas pelo usuário. */
export function buildCategoryOptions(
  locale: Locale,
  custom: readonly string[] = [],
  { includeIncome = true }: { includeIncome?: boolean } = {},
): CategoryOption[] {
  const fixed = CATEGORIES.filter((category) => includeIncome || category !== "Income").map((value) => ({
    value,
    label: `${getCategoryIcon(value) ?? ""} ${translateCategory(value, locale) ?? value}`.trim(),
  }));
  const own = custom.map((value) => ({ value, label: `🏷️ ${value}` }));
  return [...own, ...fixed];
}
