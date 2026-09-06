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

  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", req.userId!)
    .gte("transaction_date", start)
    .lt("transaction_date", end);

  if (error) {
    console.error("Falha ao calcular o resumo:", error);
    return res.status(500).json({ error: "Falha ao calcular o resumo." });
  }

  let income = 0;
  let expenses = 0;
  for (const row of data) {
    const amount = Number(row.amount);
    if (amount >= 0) {
      income += amount;
    } else {
      expenses += Math.abs(amount);
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

  const { data, error } = await supabase
    .from("transactions")
    .select("category, amount")
    .eq("user_id", req.userId!)
    .gte("transaction_date", start)
    .lt("transaction_date", end)
    .lt("amount", 0);

  if (error) {
    console.error("Falha ao calcular categorias:", error);
    return res.status(500).json({ error: "Falha ao calcular categorias." });
  }

  const totals = new Map<string, number>();
  for (const row of data) {
    const key = row.category ?? "Outros";
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(Number(row.amount)));
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

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, transaction_date")
    .eq("user_id", req.userId!)
    .gte("transaction_date", rangeStart)
    .lt("transaction_date", rangeEnd);

  if (error) {
    console.error("Falha ao calcular a tendência:", error);
    return res.status(500).json({ error: "Falha ao calcular a tendência." });
  }

  const byMonth = new Map<string, { income: number; expenses: number }>();
  for (const monthKey of monthList) {
    byMonth.set(monthKey, { income: 0, expenses: 0 });
  }
  for (const row of data) {
    const bucket = byMonth.get(row.transaction_date.slice(0, 7));
    if (!bucket) continue;
    const amount = Number(row.amount);
    if (amount >= 0) {
      bucket.income += amount;
    } else {
      bucket.expenses += Math.abs(amount);
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
