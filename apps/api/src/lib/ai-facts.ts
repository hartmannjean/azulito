import { getDb } from "./db.js";
import { EFFECTIVE_MONTH } from "./refmonth.js";

export const PT_NAMES: Record<string, string> = {
  Income: "Receita",
  Groceries: "Supermercado",
  "Eating out": "Refeições fora",
  "Food delivery": "Delivery de comida",
  "Gas stations": "Combustível",
  Transportation: "Transporte",
  "Vehicle maintenance": "Manutenção do veículo",
  Housing: "Moradia",
  Electricity: "Energia",
  Internet: "Internet",
  Telecommunications: "Telefonia",
  Healthcare: "Saúde",
  Pharmacy: "Farmácia",
  "Wellness and fitness": "Bem-estar e academia",
  Shopping: "Compras",
  Clothing: "Roupas",
  Electronics: "Eletrônicos",
  "Pet supplies and vet": "Pet e veterinário",
  "Digital services": "Serviços digitais",
  "Video streaming": "Streaming de vídeo",
  Leisure: "Lazer",
  Travel: "Viagem",
  Education: "Educação",
  Insurance: "Seguros",
  Taxes: "Impostos",
  "Bank fees": "Tarifas bancárias",
  "Loans and financing": "Financiamentos",
  Donations: "Doações",
  Services: "Serviços",
  Transfers: "Transferências",
  Other: "Outros",
};

export const ptCategory = (name: string): string => PT_NAMES[name] ?? name;

// Gastos que o usuário não "para de fazer" (ou que não são consumo): ficam de
// fora das sugestões de corte e de novos orçamentos.
export const NOT_CUTTABLE = new Set([
  "Income",
  "Housing",
  "Electricity",
  "Internet",
  "Telecommunications",
  "Healthcare",
  "Insurance",
  "Taxes",
  "Bank fees",
  "Loans and financing",
  "Education",
  "Transfers",
  "Other",
]);

/**
 * Texto vindo de arquivo do usuário (descrição de transação) que vai entrar
 * num prompt: sem quebras de linha, aspas, chaves ou colchetes, e curto. O
 * modelo ainda o recebe só como DADO dentro de JSON, e a resposta é apenas
 * exibida (nada que a IA escreva executa ação).
 */
export function sanitizeText(value: string, max = 40): string {
  const dropped = "\"`{}[]\\";
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) out += " ";
    else if (!dropped.includes(char)) out += char;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

export const round2 = (value: number) => Math.round(value * 100) / 100;

export type SpendRow = { month: string; category: string; spent: number; income: number };

/** Gasto e receita por (mês efetivo, categoria) desde `since` (AAAA-MM), sem o que está fora das somas. */
export async function loadSpendRows(userId: string, since: string): Promise<SpendRow[]> {
  const { results } = await getDb()
    .prepare(
      `select ${EFFECTIVE_MONTH} as month, coalesce(t.category, 'Other') as category,
              sum(case when t.amount < 0 then -t.amount else 0 end) as spent,
              sum(case when t.amount >= 0 then t.amount else 0 end) as income
       from transactions t join accounts a on a.id = t.account_id
       where t.user_id = ? and t.excluded = 0 and ${EFFECTIVE_MONTH} >= ?
       group by 1, 2`,
    )
    .bind(userId, since)
    .all<SpendRow>();
  return results.map((row) => ({ ...row, spent: Number(row.spent), income: Number(row.income) }));
}

export function currentMonthUtc(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
