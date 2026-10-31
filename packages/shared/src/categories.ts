/**
 * Taxonomia fechada de categorias. O valor é o nome em inglês (a UI traduz em
 * apps/web/lib/i18n/category-names.ts). A categorização por IA só pode
 * devolver um destes valores — qualquer outra coisa é descartada —, e é
 * também a lista aceita ao editar uma categoria à mão.
 */
export const CATEGORIES = [
  "Income",
  "Groceries",
  "Eating out",
  "Food delivery",
  "Gas stations",
  "Transportation",
  "Vehicle maintenance",
  "Housing",
  "Electricity",
  "Internet",
  "Telecommunications",
  "Healthcare",
  "Pharmacy",
  "Wellness and fitness",
  "Shopping",
  "Clothing",
  "Electronics",
  "Pet supplies and vet",
  "Digital services",
  "Video streaming",
  "Leisure",
  "Travel",
  "Education",
  "Insurance",
  "Taxes",
  "Bank fees",
  "Loans and financing",
  "Donations",
  "Services",
  "Transfers",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
