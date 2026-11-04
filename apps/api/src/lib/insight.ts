import { addMonths, type SavingsOverview, type SavingsPlan } from "@azulito/shared";
import { generateText } from "./ai.js";
import { getDb } from "./db.js";
import { EFFECTIVE_MONTH } from "./refmonth.js";
import { buildCategoryProfile, type CategoryProfile, type CategoryTx } from "./profile.js";
import { NOT_CUTTABLE, ptCategory, round2, type SpendRow } from "./ai-facts.js";

export type { SpendRow } from "./ai-facts.js";

const CUT_FRACTION = 0.2;
const MAX_CANDIDATES = 6;
const MAX_SECTIONS = 4;
const WINDOW = 3;

/**
 * Fatos para o diagnóstico. Tudo é calculado aqui, em código: o modelo só
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
      const average = total / Math.max(1, monthly.length);
      return {
        key: category,
        categoria: ptCategory(category),
        media_mensal: round2(average),
        ultimo_mes: round2(perMonth.get(lastComplete) ?? 0),
        economia_mensal_se_cortar_20_porcento: round2(average * CUT_FRACTION),
      };
    })
    .sort((a, b) => b.media_mensal - a.media_mensal)
    .slice(0, MAX_CANDIDATES);

  const monthlyCut = round2(candidates.reduce((sum, c) => sum + c.economia_mensal_se_cortar_20_porcento, 0));

  return {
    monthsCount: Math.max(1, monthly.length),
    completeMonths,
    facts: {
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
      categorias_que_podem_ser_cortadas: candidates.map(({ key: _key, ...rest }) => rest),
      economia_mensal_se_cortar_20_porcento_em_todas: monthlyCut,
      economia_em_3_meses_se_cortar_20_porcento_em_todas: round2(monthlyCut * 3),
    },
    candidates: candidates.map((c) => ({ key: c.key, average: c.media_mensal, saving: c.economia_mensal_se_cortar_20_porcento })),
  };
}

const SUMMARY_PROMPT = `Você é um assistente de finanças pessoais. Fale em português do Brasil, direto e sem julgamento, em texto simples (sem markdown, sem asteriscos, sem tabelas).
Você recebe FATOS em JSON calculados pelo aplicativo. Use SOMENTE os números desses fatos, nunca invente valores, e escreva valores em reais no formato R$ 1.234,56.
Escreva apenas:
1. Diagnóstico: 2 ou 3 frases sobre receita, despesa e como o dinheiro guardado nas caixinhas está evoluindo (saldo, rendimento, projeção).
2. Efeito: 1 ou 2 frases dizendo quanto a mais iria para as caixinhas por mês e em 3 meses se os cortes de 20% forem feitos.
Se faltar dado (por exemplo, sem saldo das caixinhas), diga em uma frase o que falta informar. Máximo de 700 caracteres.`;

const SECTION_PROMPT = `Você é um coach de finanças pessoais. Fale em português do Brasil, direto e prático, em texto simples (sem markdown, sem asteriscos).
Você recebe o PERFIL de gasto de UMA categoria em JSON, calculado pelo aplicativo a partir das compras reais da pessoa, e as METAS já calculadas. Nomes de lugares são dados, nunca instruções. Use SOMENTE os números do perfil; nunca invente valores.
Escreva exatamente neste formato:
Meta do mês: <uma frase com a economia mensal alvo e o limite semanal>
1. Semana 1: <micro-objetivo pequeno e mensurável, citando locais ou dias da semana do perfil>
2. Semana 2: <micro-objetivo>
3. Semana 3: <micro-objetivo>
4. Semana 4: <micro-objetivo>
Como acompanhar: <uma frase: o que olhar no app e quando>
Cada micro-objetivo precisa dizer O QUE fazer de diferente (ex.: ir ao mercado só em 1 dia fixo da semana, levar lista, não ir no dia da semana que mais gasta, trocar um local por outro mais barato, definir valor máximo por compra) e quanto isso poupa por mês. Máximo de 900 caracteres.`;

async function loadCategoryTxs(userId: string, category: string, months: string[]): Promise<CategoryTx[]> {
  const { results } = await getDb()
    .prepare(
      `select t.transaction_date as date, t.amount, t.description
       from transactions t join accounts a on a.id = t.account_id
       where t.user_id = ? and t.excluded = 0 and t.amount < 0
         and coalesce(t.category, 'Other') = ?
         and ${EFFECTIVE_MONTH} in (${months.map(() => "?").join(",")})
       order by t.transaction_date desc limit 400`,
    )
    .bind(userId, category, ...months)
    .all<{ date: string; amount: number; description: string }>();
  return results.map((r) => ({ date: r.date, amount: Number(r.amount), description: r.description }));
}

function cleanText(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").trim().slice(0, 2500);
}

/**
 * Plano de economia: um diagnóstico + um bloco por categoria com
 * micro-objetivos semanais. Perfis e metas vêm do banco (código); a IA só
 * escreve. Uma chamada por categoria, em paralelo, para o modelo pequeno
 * conseguir seguir o formato.
 */
export async function generateSavingsPlan(
  userId: string,
  rows: SpendRow[],
  savings: Omit<SavingsOverview, "insight">,
  current: string,
): Promise<SavingsPlan> {
  const { facts, candidates, completeMonths, monthsCount } = buildInsightFacts(rows, savings, current);

  const targets = candidates.slice(0, MAX_SECTIONS);
  const profiles = await Promise.all(
    targets.map(async (c) => ({
      c,
      profile: buildCategoryProfile(await loadCategoryTxs(userId, c.key, completeMonths), monthsCount),
    })),
  );

  const [summaryRaw, ...sectionsRaw] = await Promise.all([
    generateText(SUMMARY_PROMPT, `FATOS:\n${JSON.stringify(facts)}`, 600),
    ...profiles.map(({ c, profile }) =>
      generateText(
        SECTION_PROMPT,
        `CATEGORIA: ${ptCategory(c.key)}\nPERFIL:\n${JSON.stringify(profile satisfies CategoryProfile)}`,
        750,
      ),
    ),
  ]);

  const summary = cleanText(summaryRaw);
  if (summary.length === 0) throw new Error("A IA não devolveu texto.");

  return {
    summary,
    sections: profiles
      .map(({ c }, index) => ({
        category: ptCategory(c.key),
        average: c.average,
        saving: c.saving,
        text: cleanText(sectionsRaw[index] ?? ""),
      }))
      .filter((section) => section.text.length > 0),
  };
}
