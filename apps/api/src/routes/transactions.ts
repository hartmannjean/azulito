import { Router } from "express";
import { listTransactionsQuerySchema, monthSummaryQuerySchema } from "@azulito/shared";
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
