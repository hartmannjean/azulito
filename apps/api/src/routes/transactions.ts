import { Router } from "express";
import {
  listTransactionsQuerySchema,
  monthSummaryQuerySchema,
  trendQuerySchema,
} from "@azulito/shared";
import { createUserScopedClient } from "../lib/supabaseForUser.js";

export const transactionsRouter = Router();

/** `month` no formato AAAA-MM -> [primeiro dia do mês, primeiro dia do mês seguinte). */
function getMonthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const start = `${month}-01`;
  const end =
    mon === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
  return { start, end };
}

/**
 * Categorias que nunca devem contar como receita/despesa real, verificado
 * contra os dados de verdade do usuário (não só suposição sobre a
 * taxonomia da Pluggy):
 *
 * - "investments": aplicar/resgatar (ex: RDB) é o próprio dinheiro da
 *   pessoa mudando de lugar DENTRO do Nubank, não entra nem sai da conta.
 * - "credit card payment": o pagamento da fatura já aparece DUAS vezes nos
 *   dados — uma na conta corrente (categoria "Transfers", descrição
 *   "Pagamento de fatura") e outra na própria conta do cartão (categoria
 *   "Credit card payment", descrição "Pagamento recebido"), sempre com o
 *   mesmo valor e a mesma data (confirmado nos 8 meses de histórico do
 *   usuário) — cada uma é o mesmo evento visto pelas duas pontas da
 *   transferência. Excluir esta categoria mantém só o lado da conta
 *   corrente, sem contar a fatura duas vezes.
 *
 * "same person transfer" NÃO entra aqui (ver `SIGN_AMBIGUOUS_CATEGORIES`
 * abaixo) — só o Nubank está conectado, e é assim que a Pluggy categoriza a
 * transferência de um banco externo (ex: Banco do Brasil) de mesma
 * titularidade pro Nubank. Pro usuário, esse dinheiro entrou na conta que o
 * app acompanha — deve contar como receita, não ser descartado.
 */
const EXCLUDED_CATEGORIES = ["investments", "credit card payment"];

function isExcludedCategory(category: string | null): boolean {
  if (!category) return false;
  const normalized = category.toLowerCase();
  return EXCLUDED_CATEGORIES.some((excluded) => normalized.startsWith(excluded));
}

/**
 * Categorias cujo SINAL é confiável pra decidir receita vs despesa:
 *
 * - "transfers"/"same person transfer": dinheiro entrando (salário/Pix
 *   recebido, transferência de outro banco do próprio usuário) ou saindo
 *   (Pix enviado, transferência pra outro banco) — as duas direções são
 *   reais pra quem só acompanha o Nubank, então mantém o sinal original.
 * - "income": categoria já é receita por definição.
 * - sem categoria (null): não há informação pra decidir melhor, mantém o
 *   sinal original.
 *
 * Todas as outras categorias (Groceries, Shopping, Gas stations, etc.) são
 * SEMPRE despesa aqui, não importa o sinal gravado — verificado contra os
 * dados reais do usuário: compras no débito aparecem corretamente negativas,
 * mas as mesmas compras (mesmo estabelecimento, ex. "Supermercados Osana",
 * "Posto de Combustiveis") em vários meses seguidos (fev–ago/2026) aparecem
 * com valor POSITIVO — não são estornos (o volume e a recorrência não batem
 * com isso), é a Pluggy/Nubank gravando o sinal de forma inconsistente pra
 * parte das transações. Categoria já deixa claro que é gasto; usar o sinal
 * bruto nesses casos inflava "receita" com compra de mercado e posto.
 */
const SIGN_AMBIGUOUS_CATEGORIES = ["transfers", "same person transfer", "income"];

function isSignAmbiguousCategory(category: string | null): boolean {
  if (!category) return true;
  const normalized = category.toLowerCase();
  return SIGN_AMBIGUOUS_CATEGORIES.some((name) => normalized.startsWith(name));
}

type AdjustedRow = { amount: number; category: string | null; transaction_date: string };

/**
 * Transações do período, com dois ajustes em relação à tabela crua — sem
 * eles o resumo mensal conta dinheiro que não é receita/despesa real:
 *
 * - Categorias de `EXCLUDED_CATEGORIES` são descartadas por completo.
 * - Nas demais categorias (exceto as ambíguas), o sinal é normalizado pra
 *   despesa — ver `SIGN_AMBIGUOUS_CATEGORIES` acima.
 *
 * A lista de transações (GET /transactions) não passa por nenhum desses
 * ajustes — mostra tudo como veio da Pluggy, só a soma agregada
 * (summary/categories/trend) é que precisa disso.
 */
async function fetchAdjustedTransactions(
  supabase: ReturnType<typeof createUserScopedClient>,
  userId: string,
  start: string,
  end: string,
): Promise<AdjustedRow[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("amount, category, transaction_date")
    .eq("user_id", userId)
    .gte("transaction_date", start)
    .lt("transaction_date", end);

  if (error) throw error;

  return data
    .filter((row) => !isExcludedCategory(row.category))
    .map((row) => {
      const rawAmount = Number(row.amount);
      const amount = isSignAmbiguousCategory(row.category) ? rawAmount : -Math.abs(rawAmount);
      return { amount, category: row.category, transaction_date: row.transaction_date };
    });
}

/**
 * GET /transactions — lista as transações do usuário autenticado.
 * Montada com `requireAuth` em src/app.ts; aqui já podemos confiar em
 * `req.userId`/`req.accessToken`.
 */
transactionsRouter.get("/", async (req, res) => {
  const parsed = listTransactionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos.", issues: parsed.error.flatten() });
  }

  const { limit, cursor, category, month } = parsed.data;
  const supabase = createUserScopedClient(req.accessToken!);

  let query = supabase
    .from("transactions")
    // RLS (via createUserScopedClient) já restringe a linhas do próprio
    // usuário; o filtro abaixo é defesa em profundidade, não a única barreira.
    .select("id, description, amount, currency_code, transaction_date, category")
    .eq("user_id", req.userId!)
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (month) {
    const { start, end } = getMonthRange(month);
    query = query.gte("transaction_date", start).lt("transaction_date", end);
  }
  if (cursor) {
    query = query.lt("transaction_date", cursor);
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Falha ao buscar transações:", error);
    return res.status(500).json({ error: "Falha ao buscar transações." });
  }

  res.json({ transactions: data });
});

/**
 * GET /transactions/summary?month=AAAA-MM — total de receitas/despesas do
 * mês. Soma no servidor em vez de pedir pro PostgREST agregar: evita
 * depender de sintaxe de agregação que pode não estar habilitada, e o
 * volume de transações de um único mês de uma pessoa nunca é grande o
 * bastante pra isso pesar.
 */
transactionsRouter.get("/summary", async (req, res) => {
  const parsed = monthSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos.", issues: parsed.error.flatten() });
  }

  const { month } = parsed.data;
  const { start, end } = getMonthRange(month);
  const supabase = createUserScopedClient(req.accessToken!);

  let rows: AdjustedRow[];
  try {
    rows = await fetchAdjustedTransactions(supabase, req.userId!, start, end);
  } catch (error) {
    console.error("Falha ao calcular o resumo:", error);
    return res.status(500).json({ error: "Falha ao calcular o resumo." });
  }

  let income = 0;
  let expenses = 0;
  for (const row of rows) {
    if (row.amount >= 0) {
      income += row.amount;
    } else {
      expenses += Math.abs(row.amount);
    }
  }

  res.json({
    month,
    income: Math.round(income * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    balance: Math.round((income - expenses) * 100) / 100,
  });
});

/**
 * GET /transactions/categories?month=AAAA-MM — despesas do mês agrupadas por
 * categoria, ordenadas da maior pra menor, com o percentual sobre o total de
 * despesas do mês.
 */
transactionsRouter.get("/categories", async (req, res) => {
  const parsed = monthSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos.", issues: parsed.error.flatten() });
  }

  const { month } = parsed.data;
  const { start, end } = getMonthRange(month);
  const supabase = createUserScopedClient(req.accessToken!);

  let rows: AdjustedRow[];
  try {
    rows = await fetchAdjustedTransactions(supabase, req.userId!, start, end);
  } catch (error) {
    console.error("Falha ao calcular categorias:", error);
    return res.status(500).json({ error: "Falha ao calcular categorias." });
  }

  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.amount >= 0) continue;
    const key = row.category ?? "Outros";
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(row.amount));
  }

  const totalExpenses = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const categories = [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100,
      percentage: totalExpenses > 0 ? Math.round((total / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  res.json({ month, categories });
});

/**
 * GET /transactions/trend?months=6 — receitas/despesas/saldo dos últimos N
 * meses (incluindo o atual), do mais antigo pro mais recente. Soma no
 * servidor com uma única query no intervalo inteiro, em vez de uma query por
 * mês.
 */
transactionsRouter.get("/trend", async (req, res) => {
  const parsed = trendQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos.", issues: parsed.error.flatten() });
  }

  const { months } = parsed.data;
  const now = new Date();
  const monthList: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    monthList.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const rangeStart = getMonthRange(monthList[0]!).start;
  const rangeEnd = getMonthRange(monthList[monthList.length - 1]!).end;
  const supabase = createUserScopedClient(req.accessToken!);

  let rows: AdjustedRow[];
  try {
    rows = await fetchAdjustedTransactions(supabase, req.userId!, rangeStart, rangeEnd);
  } catch (error) {
    console.error("Falha ao calcular a tendência:", error);
    return res.status(500).json({ error: "Falha ao calcular a tendência." });
  }

  const byMonth = new Map<string, { income: number; expenses: number }>();
  for (const monthKey of monthList) {
    byMonth.set(monthKey, { income: 0, expenses: 0 });
  }
  for (const row of rows) {
    const bucket = byMonth.get(row.transaction_date.slice(0, 7));
    if (!bucket) continue;
    if (row.amount >= 0) {
      bucket.income += row.amount;
    } else {
      bucket.expenses += Math.abs(row.amount);
    }
  }

  const trend = monthList.map((monthKey) => {
    const bucket = byMonth.get(monthKey)!;
    return {
      month: monthKey,
      income: Math.round(bucket.income * 100) / 100,
      expenses: Math.round(bucket.expenses * 100) / 100,
      balance: Math.round((bucket.income - bucket.expenses) * 100) / 100,
    };
  });

  res.json({ trend });
});
