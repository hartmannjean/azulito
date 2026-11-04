import { addMonths, type SavingsOverview } from "@azulito/shared";
import { generateText } from "./ai.js";

const PT_NAMES: Record<string, string> = {
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

// Gastos que o usuário não "para de fazer" (ou que não são consumo): ficam de
// fora das sugestões de corte.
const NOT_CUTTABLE = new Set([
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

const CUT_FRACTION = 0.2;
const MAX_CANDIDATES = 6;
const WINDOW = 3;

export type SpendRow = { month: string; category: string; spent: number; income: number };

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Fatos que a IA pode citar. Tudo é calculado aqui, em código: o modelo só
 * redige. Assim os números do texto vêm do banco, não da "imaginação" dele.
 */
export function buildInsightFacts(rows: SpendRow[], savings: Omit<SavingsOverview, "insight">, current: string) {
  const completeMonths: string[] = [];
  for (let i = WINDOW; i >= 1; i--) completeMonths.push(addMonths(current, -i));

  const monthly = completeMonths
    .map((month) => {
      const inMonth = rows.filter((r) => r.month === month);
      const income = inMonth.reduce((sum, r) => sum + r.income, 0);
      const expenses = inMonth.reduce((sum, r) => sum + r.spent, 0);
      return { month, income: round2(income), expenses: round2(expenses), balance: round2(income - expenses) };
    })
    .filter((m) => m.income > 0 || m.expenses > 0);

  const byCategory = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.spent <= 0 || !completeMonths.includes(row.month)) continue;
    const perMonth = byCategory.get(row.category) ?? new Map<string, number>();
    perMonth.set(row.month, (perMonth.get(row.month) ?? 0) + row.spent);
    byCategory.set(row.category, perMonth);
  }

  const lastComplete = completeMonths[completeMonths.length - 1]!;
  const candidates = [...byCategory.entries()]
    .filter(([category]) => !NOT_CUTTABLE.has(category))
    .map(([category, perMonth]) => {
      const total = [...perMonth.values()].reduce((sum, v) => sum + v, 0);
      const average = total / monthly.length;
      return {
        categoria: PT_NAMES[category] ?? category,
        media_mensal: round2(average),
        ultimo_mes: round2(perMonth.get(lastComplete) ?? 0),
        economia_mensal_se_cortar_20_porcento: round2(average * CUT_FRACTION),
      };
    })
    .sort((a, b) => b.media_mensal - a.media_mensal)
    .slice(0, MAX_CANDIDATES);

  const monthlyCut = round2(candidates.reduce((sum, c) => sum + c.economia_mensal_se_cortar_20_porcento, 0));

  return {
    meses_completos: monthly,
    caixinhas: {
      saldo_atual: savings.current_balance,
      saldo_atual_e_estimativa: savings.current_balance_estimated,
      rendimento_acumulado: savings.total_yield,
      guardado_medio_por_mes: savings.assumptions?.avg_net ?? null,
      rendimento_mensal_medio_percentual:
        savings.assumptions === null ? null : Math.round(savings.assumptions.avg_rate * 10000) / 100,
      projecao: savings.forecast.map((p) => ({ mes: p.month, saldo: p.balance })),
    },
    categorias_que_podem_ser_cortadas: candidates,
    economia_mensal_se_cortar_20_porcento_em_todas: monthlyCut,
    economia_em_3_meses_se_cortar_20_porcento_em_todas: round2(monthlyCut * 3),
  };
}

const SYSTEM_PROMPT = `Você é um assistente de finanças pessoais. Fale em português do Brasil, direto e sem julgamento, em texto simples (sem markdown, sem asteriscos, sem tabelas).
Você recebe FATOS em JSON calculados pelo aplicativo. Use SOMENTE os números desses fatos, nunca invente valores, e escreva valores em reais no formato R$ 1.234,56.
Estrutura da resposta, nesta ordem:
1. Diagnóstico: 2 ou 3 frases sobre receita, despesa e como o dinheiro guardado nas caixinhas está evoluindo (saldo, rendimento, projeção).
2. Onde parar de gastar: até 4 itens, um por linha começando com "- ", escolhendo entre "categorias_que_podem_ser_cortadas" as de maior média ou em alta no último mês. Em cada item cite a categoria, a média mensal e quanto se economiza por mês cortando 20%.
3. Efeito: 1 ou 2 frases dizendo quanto a mais iria para as caixinhas por mês e em 3 meses se os cortes escolhidos forem feitos.
Se faltar dado (por exemplo, sem saldo das caixinhas), diga em uma frase o que falta informar. Máximo de 1200 caracteres.`;

export async function generateSavingsInsight(
  rows: SpendRow[],
  savings: Omit<SavingsOverview, "insight">,
  current: string,
): Promise<string> {
  const facts = buildInsightFacts(rows, savings, current);
  const text = await generateText(SYSTEM_PROMPT, `FATOS:\n${JSON.stringify(facts)}`);
  const cleaned = text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").trim();
  if (cleaned.length === 0) throw new Error("A IA não devolveu texto.");
  return cleaned.slice(0, 2500);
}
