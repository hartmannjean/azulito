import { Router } from "express";
import {
  listTransactionsQuerySchema,
  monthSummaryQuerySchema,
  trendQuerySchema,
} from "@azulito/shared";
import { getDb } from "../lib/db.js";

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

type AdjustedRow = { amount: number; category: string | null; transaction_date: string };

/**
 * Transações do período que contam como receita/despesa real: o OFX tem sinal
 * confiável (TRNAMT), e o que não é fluxo de caixa (pagamento de fatura,
 * aplicação/resgate) já vem marcado como `excluded` na importação (ver
 * lib/classify.ts). A lista (GET /transactions) mostra tudo; só a soma
 * agregada (summary/categories/trend) desconsidera as excluídas.
 */
async function fetchAdjustedTransactions(
  userId: string,
  start: string,
  end: string,
): Promise<AdjustedRow[]> {
  const { results } = await getDb()
    .prepare(
      `select amount, category, transaction_date from transactions
       where user_id = ? and excluded = 0 and transaction_date >= ? and transaction_date < ?`,
    )
    .bind(userId, start, end)
    .all<{ amount: number; category: string | null; transaction_date: string }>();

  return results.map((row) => ({
    amount: Number(row.amount),
    category: row.category,
    transaction_date: row.transaction_date,
  }));
}

/**
 * GET /transactions — lista as transações do usuário autenticado.
 * Montada com `requireAuth` em src/app.ts; aqui já podemos confiar em
 * `req.userId`.
 */
transactionsRouter.get("/", async (req, res) => {
  const parsed = listTransactionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos.", issues: parsed.error.flatten() });
  }

  const { limit, cursor, category, month } = parsed.data;

  // Sem RLS no D1: o filtro por user_id (vindo do JWT, nunca do cliente) é a
  // única barreira de isolamento entre usuários.
  const conditions = ["user_id = ?"];
  const params: unknown[] = [req.userId!];

  if (month) {
    const { start, end } = getMonthRange(month);
    conditions.push("transaction_date >= ?", "transaction_date < ?");
    params.push(start, end);
  }
  if (cursor) {
    conditions.push("transaction_date < ?");
    params.push(cursor);
  }
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  params.push(limit);

  try {
    const { results } = await getDb()
      .prepare(
        `select id, description, amount, currency_code, transaction_date, category
         from transactions
         where ${conditions.join(" and ")}
         order by transaction_date desc
         limit ?`,
      )
      .bind(...params)
      .all();
    res.json({ transactions: results });
  } catch (error) {
    console.error("Falha ao buscar transações:", error);
    res.status(500).json({ error: "Falha ao buscar transações." });
  }
});

/**
 * GET /transactions/summary?month=AAAA-MM — total de receitas/despesas do
 * mês. Soma no servidor em vez de agregar no SQL: o
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

  let rows: AdjustedRow[];
  try {
    rows = await fetchAdjustedTransactions(req.userId!, start, end);
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

  let rows: AdjustedRow[];
  try {
    rows = await fetchAdjustedTransactions(req.userId!, start, end);
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

  let rows: AdjustedRow[];
  try {
    rows = await fetchAdjustedTransactions(req.userId!, rangeStart, rangeEnd);
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
