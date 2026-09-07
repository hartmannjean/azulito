import type { Locale } from "./locale";

/**
 * As categorias vêm da Pluggy sempre em inglês (taxonomia própria deles,
 * independente do banco conectado) — isso é dado, não string de UI, então
 * não mora no dicionário normal. Traduzimos só a exibição; o valor original
 * continua sendo usado pra escolher o ícone em `category-icons.ts` (que já
 * casa palavras-chave nos dois idiomas).
 *
 * Lista conferida contra transações reais de uma conexão Nubank (não só a
 * doc da Pluggy) — a taxonomia tem categorias de nível 1 (ex: "Housing") e
 * de nível 2, mais específicas (ex: "Gas stations", "Eating out"), e a
 * Pluggy pode devolver qualquer um dos dois níveis numa transação.
 */
const PT_BR_CATEGORY_NAMES: Record<string, string> = {
  // Nível 1
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

  // Nível 2 (observadas em dados reais)
  "gas stations": "Postos de gasolina",
  "eating out": "Refeições fora",
  "food delivery": "Delivery de comida",
  houseware: "Utilidades domésticas",
  clothing: "Vestuário",
  pharmacy: "Farmácia",
  electronics: "Eletrônicos",
  "pet supplies and vet": "Pet shop e veterinário",
  "vehicle maintenance": "Manutenção veicular",
  "wellness and fitness": "Bem-estar e fitness",
  "cinema, theater and concerts": "Cinema, teatro e shows",
  bookstore: "Livraria",
  "taxi and ride-hailing": "Táxi e aplicativos de transporte",
  tickets: "Ingressos",
  telecommunications: "Telecomunicações",
  "sports goods": "Artigos esportivos",
  "video streaming": "Streaming de vídeo",
  "office supplies": "Material de escritório",
  "kids and toys": "Infantil e brinquedos",
  internet: "Internet",
  "tax on financial operations": "IOF",
  parking: "Estacionamento",
  automotive: "Automotivo",
  "gyms and fitness centers": "Academias",
  electricity: "Energia elétrica",
  "credit card payment": "Pagamento da fatura",
  accomodation: "Hospedagem",
};

export function translateCategory(category: string | null | undefined, locale: Locale): string | null {
  if (!category) return null;
  if (locale !== "pt-BR") return category;
  return PT_BR_CATEGORY_NAMES[category.trim().toLowerCase()] ?? category;
}
