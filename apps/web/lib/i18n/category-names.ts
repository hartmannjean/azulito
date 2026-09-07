import type { Locale } from "./locale";

/**
 * As categorias vêm da Pluggy sempre em inglês (taxonomia própria deles,
 * independente do banco conectado) — isso é dado, não string de UI, então
 * não mora no dicionário normal. Traduzimos só a exibição; o valor original
 * continua sendo usado pra escolher o ícone em `category-icons.ts` (que já
 * casa palavras-chave nos dois idiomas).
 */
const PT_BR_CATEGORY_NAMES: Record<string, string> = {
  income: "Receita",
  "loans and financing": "Empréstimos e financiamentos",
  investments: "Investimentos",
  "same person transfer": "Transferência entre contas próprias",
  transfers: "Transferências",
  "legal obligations": "Obrigações legais",
  services: "Serviços",
  shopping: "Compras",
  "digital services": "Serviços digitais",
  groceries: "Supermercado",
  "food and drinks": "Alimentação",
  travel: "Viagem",
  donations: "Doações",
  gambling: "Apostas",
  taxes: "Impostos",
  "bank fees": "Tarifas bancárias",
  housing: "Moradia",
  healthcare: "Saúde",
  transportation: "Transporte",
  insurance: "Seguros",
  leisure: "Lazer",
  other: "Outros",
  // Sintética, gerada pelo backend (apps/api/src/routes/transactions.ts) pra
  // representar a fatura do cartão fechada — não vem da Pluggy.
  "credit card bill": "Fatura do cartão",
};

export function translateCategory(category: string | null | undefined, locale: Locale): string | null {
  if (!category) return null;
  if (locale !== "pt-BR") return category;
  return PT_BR_CATEGORY_NAMES[category.trim().toLowerCase()] ?? category;
}
