import { addMonths, type BudgetSuggestion } from "@azulito/shared";
import { generateText } from "./ai.js";
import { NOT_CUTTABLE, ptCategory, round2, type SpendRow } from "./ai-facts.js";

const WINDOW = 3;
const MAX_SUGGESTIONS = 6;
const MIN_NEW_BUDGET_AVERAGE = 80;

const ceil10 = (value: number) => Math.ceil(value / 10) * 10;
const brl = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Sugere limites de orçamento a partir do gasto real dos últimos meses
 * completos. Regras, todas calculadas aqui (a IA só reescreve a justificativa):
 *
 * - limite muito acima do que se gasta (média até 75% dele): propor um limite
 *   mais justo, que libera folga para as caixinhas;
 * - limite estourado em 2 ou mais meses e média 15% acima: propor um passo na
 *   direção da realidade, em vez de um limite que nunca é cumprido;
 * - categoria que se pode cortar, sem orçamento e com gasto relevante: propor
 *   um orçamento 10% abaixo da média.
 */
export function proposeBudgets(
  rows: SpendRow[],
  budgets: Record<string, number>,
  current: string,
): BudgetSuggestion[] {
  const months: string[] = [];
  for (let i = WINDOW; i >= 1; i--) months.push(addMonths(current, -i));

  const monthsWithSpending = months.filter((m) => rows.some((r) => r.month === m && r.spent > 0));
  if (monthsWithSpending.length === 0) return [];

  const byCategory = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.spent <= 0 || !months.includes(row.month) || row.category === "Income") continue;
    const perMonth = byCategory.get(row.category) ?? new Map<string, number>();
    perMonth.set(row.month, (perMonth.get(row.month) ?? 0) + row.spent);
    byCategory.set(row.category, perMonth);
  }

  const out: BudgetSuggestion[] = [];
  for (const [category, perMonth] of byCategory) {
    const total = [...perMonth.values()].reduce((sum, v) => sum + v, 0);
    const average = total / monthsWithSpending.length;
    const present = perMonth.size;
    const limit = budgets[category];

    if (limit !== undefined) {
      const over = [...perMonth.values()].filter((v) => v > limit).length;
      if (present >= 2 && average <= limit * 0.75) {
        const suggested = ceil10(average * 1.15);
        if (suggested < limit) {
          out.push({
            category,
            current: limit,
            suggested,
            average: round2(average),
            reason: `Você gasta em média ${brl(average)} por mês em ${ptCategory(category)}, bem abaixo do limite de ${brl(limit)}. Um limite de ${brl(suggested)} ainda dá folga e libera ${brl(limit - suggested)} por mês.`,
          });
        }
      } else if (over >= 2 && average > limit * 1.15) {
        const suggested = ceil10((limit + average * 0.95) / 2);
        if (suggested > limit) {
          out.push({
            category,
            current: limit,
            suggested,
            average: round2(average),
            reason: `O limite de ${brl(limit)} foi estourado em ${over} dos últimos ${months.length} meses (média ${brl(average)}). Um passo intermediário de ${brl(suggested)} é mais cumprível e ainda puxa o gasto para baixo.`,
          });
        }
      }
    } else if (!NOT_CUTTABLE.has(category) && average >= MIN_NEW_BUDGET_AVERAGE && present >= 2) {
      const suggested = ceil10(average * 0.9);
      out.push({
        category,
        current: null,
        suggested,
        average: round2(average),
        reason: `${ptCategory(category)} não tem limite e você gasta em média ${brl(average)} por mês. Um limite de ${brl(suggested)} (10% abaixo da média) cria um alvo sem ser apertado.`,
      });
    }
  }

  return out
    .sort((a, b) => Math.abs(b.suggested - (b.current ?? b.average)) - Math.abs(a.suggested - (a.current ?? a.average)))
    .slice(0, MAX_SUGGESTIONS);
}

const REASON_PROMPT = `Você é um assistente de orçamento pessoal. Português do Brasil, direto, sem markdown.
Você recebe uma lista numerada de sugestões de limite de orçamento em JSON, já calculadas pelo aplicativo (com o gasto médio mensal real). Para cada item, escreva UMA frase curta (até 150 caracteres) explicando por que a sugestão faz sentido para essa pessoa. Use SOMENTE os números do item; não invente valores.
Responda SOMENTE com um objeto JSON {"1":"frase","2":"frase"}, sem texto extra.`;

/** Troca a justificativa padrão por uma frase da IA; se a IA falhar, a padrão continua. */
export async function polishReasons(suggestions: BudgetSuggestion[]): Promise<BudgetSuggestion[]> {
  if (suggestions.length === 0) return suggestions;
  try {
    const payload = suggestions.map((s, index) => ({
      n: index + 1,
      categoria: ptCategory(s.category),
      limite_atual: s.current,
      limite_sugerido: s.suggested,
      gasto_medio_mensal: s.average,
    }));
    const raw = await generateText(REASON_PROMPT, JSON.stringify(payload), 700);
    const match = /\{[\s\S]*\}/.exec(raw);
    if (!match) return suggestions;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return suggestions.map((s, index) => {
      const text = parsed[String(index + 1)];
      return typeof text === "string" && text.trim().length >= 10 && text.length <= 220
        ? { ...s, reason: text.replace(/\*\*/g, "").trim() }
        : s;
    });
  } catch (error) {
    console.error("IA não reescreveu as justificativas (mantendo as padrão):", error);
    return suggestions;
  }
}
