import { Router } from "express";
import {
  listTransactionsQuerySchema,
  monthSummaryQuerySchema,
  trendQuerySchema,
  updateCategorySchema,
  isCategory,
} from "@azulito/shared";
import { getDb } from "../lib/db.js";
import { categorizePending } from "../lib/categorizer.js";

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
 * GET /transactions — lista paginada e filtrável das transações do usuário
 * autenticado (busca, conta, categoria, tipo, mês, ordenação). Montada com
 * `requireAuth` em src/app.ts; aqui já podemos confiar em `req.userId`.
 */
transactionsRouter.get("/", async (req, res) => {
  const parsed = listTransactionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos.", issues: parsed.error.flatten() });
  }

  const { limit, offset, category, month, q, account_id, type, sort, order } = parsed.data;

  // Sem RLS no D1: o filtro por user_id (vindo do JWT, nunca do cliente) é a
  // única barreira de isolamento entre usuários. Todo valor do cliente entra
  // como parâmetro (?), nunca concatenado; colunas de ordenação vêm de uma
  // lista fixa.
  const conditions = ["t.user_id = ?"];
  const params: unknown[] = [req.userId!];

  if (month) {
    const { start, end } = getMonthRange(month);
    conditions.push("t.transaction_date >= ?", "t.transaction_date < ?");
    params.push(start, end);
  }
  if (category === "__none__") {
    conditions.push("t.category is null");
  } else if (category) {
    conditions.push("t.category = ?");
    params.push(category);
  }
  if (account_id) {
    conditions.push("t.account_id = ?");
    params.push(account_id);
  }
  if (type === "income") conditions.push("t.amount > 0");
  if (type === "expense") conditions.push("t.amount < 0");
  if (q) {
    conditions.push("t.description like ? escape '!'");
    params.push(`%${q.replace(/[!%_]/g, "!$&")}%`);
  }

  const where = conditions.join(" and ");
  const direction = order === "asc" ? "asc" : "desc";
  const orderBy =
    sort === "amount"
      ? `t.amount ${direction}, t.transaction_date desc`
      : `t.transaction_date ${direction}, t.id`;

  try {
    const db = getDb();
    const [page, count] = await Promise.all([
      db
        .prepare(
          `select t.id, t.description, t.amount, t.currency_code, t.transaction_date, t.category,
                  t.category_source, t.excluded, t.account_id,
                  a.institution_name, a.kind as account_kind
           from transactions t join accounts a on a.id = t.account_id
           where ${where}
           order by ${orderBy}
           limit ? offset ?`,
        )
        .bind(...params, limit, offset)
        .all<{ excluded: number }>(),
      db
        .prepare(`select count(*) as n from transactions t where ${where}`)
        .bind(...params)
        .first<{ n: number }>(),
    ]);

    res.json({
      transactions: page.results.map((row) => ({ ...row, excluded: row.excluded === 1 })),
      total: count?.n ?? 0,
    });
  } catch (error) {
    console.error("Falha ao buscar transações:", error);
    res.status(500).json({ error: "Falha ao buscar transações." });
  }
});

/**
 * PATCH /transactions/:id — corrige a categoria. Vira uma regra por
 * estabelecimento (`merchant_rules`) e é aplicada às OUTRAS transações do
 * mesmo lugar que não foram definidas à mão pelo usuário.
 */
transactionsRouter.patch("/:id", async (req, res) => {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success || !isCategory(parsed.data.category)) {
    return res.status(400).json({ error: "Categoria inválida." });
  }
  const { category } = parsed.data;
  const userId = req.userId!;
  const db = getDb();

  try {
    const row = await db
      .prepare("select merchant_key from transactions where id = ? and user_id = ?")
      .bind(req.params.id, userId)
      .first<{ merchant_key: string | null }>();
    if (!row) return res.status(404).json({ error: "Transação não encontrada." });

    await db
      .prepare("update transactions set category = ?, category_source = 'user' where id = ? and user_id = ?")
      .bind(category, req.params.id, userId)
      .run();

    let updated = 1;
    if (row.merchant_key) {
      await db
        .prepare(
          `insert into merchant_rules (user_id, merchant_key, category) values (?, ?, ?)
           on conflict (user_id, merchant_key) do update set category = excluded.category`,
        )
        .bind(userId, row.merchant_key, category)
        .run();
      const others = await db
        .prepare(
          `update transactions set category = ?, category_source = 'rule'
           where user_id = ? and merchant_key = ? and id != ?
             and (category_source is null or category_source != 'user')`,
        )
        .bind(category, userId, row.merchant_key, req.params.id)
        .run();
      updated += others.meta.changes;
    }

    res.json({ updated });
  } catch (error) {
    console.error("Falha ao atualizar categoria:", error);
    res.status(500).json({ error: "Falha ao atualizar categoria." });
  }
});

/** POST /transactions/categorize — categoriza (regras + IA) o que está sem categoria. */
transactionsRouter.post("/categorize", async (req, res) => {
  try {
    res.json(await categorizePending(req.userId!));
  } catch (error) {
    console.error("Falha ao categorizar:", error);
    res.status(500).json({ error: "Falha ao categorizar." });
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
