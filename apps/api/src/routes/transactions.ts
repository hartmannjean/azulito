import { Router } from "express";
import {
  listTransactionsQuerySchema,
  monthSummaryQuerySchema,
  setReferenceMonthSchema,
  trendQuerySchema,
  updateCategorySchema,
} from "@azulito/shared";
import { getDb } from "../lib/db.js";
import { resolveCategory } from "../lib/categories.js";
import { categorizePending } from "../lib/categorizer.js";
import { EFFECTIVE_MONTH } from "../lib/refmonth.js";

export const transactionsRouter = Router();

const round2 = (value: number) => Math.round(value * 100) / 100;

// Agregação feita no D1 (GROUP BY) para não trazer todas as linhas do período.
// O que não é fluxo de caixa (fatura paga, aplicação/resgate) já vem marcado
// como `excluded` na importação (lib/classify.ts); só as somas o ignoram.

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

  const { limit, offset, category, month, q, account_id, type, show_excluded, sort, order } = parsed.data;

  // Sem RLS no D1: o filtro por user_id (vindo do JWT, nunca do cliente) é a
  // única barreira de isolamento entre usuários. Todo valor do cliente entra
  // como parâmetro (?), nunca concatenado; colunas de ordenação vêm de uma
  // lista fixa.
  const conditions = ["t.user_id = ?"];
  const params: unknown[] = [req.userId!];

  if (month) {
    conditions.push(`${EFFECTIVE_MONTH} = ?`);
    params.push(month);
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
  // Filtrar por tipo segue a mesma regra das somas (summary): o que está
  // `excluded` (resgate/aplicação, pagamento de fatura) não é receita nem
  // despesa, então a lista bate com o total do card do dashboard.
  if (type || !show_excluded) conditions.push("t.excluded = 0");
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
                  t.reference_month, ${EFFECTIVE_MONTH} as effective_month,
                  a.institution_name, a.kind as account_kind
           from transactions t join accounts a on a.id = t.account_id
           where ${where}
           order by ${orderBy}
           limit ? offset ?`,
        )
        .bind(...params, limit, offset)
        .all<{ excluded: number }>(),
      db
        .prepare(
          `select count(*) as n,
                  coalesce(sum(case when t.excluded = 0 and t.amount > 0 then t.amount end), 0) as income,
                  coalesce(sum(case when t.excluded = 0 and t.amount < 0 then -t.amount end), 0) as expenses
           from transactions t join accounts a on a.id = t.account_id
           where ${where}`,
        )
        .bind(...params)
        .first<{ n: number; income: number; expenses: number }>(),
    ]);
    const income = Number(count?.income ?? 0);
    const expenses = Number(count?.expenses ?? 0);

    res.json({
      transactions: page.results.map((row) => ({ ...row, excluded: row.excluded === 1 })),
      total: count?.n ?? 0,
      totals: { income: round2(income), expenses: round2(expenses), balance: round2(income - expenses) },
    });
  } catch (error) {
    console.error("Falha ao buscar transações:", error);
    res.status(500).json({ error: "Falha ao buscar transações." });
  }
});

/**
 * PATCH /transactions/:id — corrige a categoria. Para categoria fixa, vira
 * uma regra por estabelecimento (`merchant_rules`) aplicada às OUTRAS
 * transações do mesmo lugar que não foram definidas à mão. Categoria própria
 * vale só para esta transação: ela costuma marcar QUEM fez a compra (ex.:
 * outra pessoa usando o cartão), não o lugar.
 */
transactionsRouter.patch("/:id", async (req, res) => {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Categoria inválida." });
  }
  const userId = req.userId!;
  const db = getDb();

  try {
    const resolved = await resolveCategory(userId, parsed.data.category);
    if (!resolved) return res.status(400).json({ error: "Categoria inválida." });
    const category = resolved.name;

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
    if (row.merchant_key && !resolved.custom) {
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

/**
 * POST /transactions/reference-month — define (ou, com `month: null`, limpa)
 * o mês em que as transações contam nas somas. Aceita vários ids de uma vez.
 * O filtro por user_id garante que só se altera o que é do usuário.
 */
transactionsRouter.post("/reference-month", async (req, res) => {
  const parsed = setReferenceMonthSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
  const { ids, month } = parsed.data;

  try {
    const db = getDb();
    const statements = ids.map((id) =>
      db
        .prepare("update transactions set reference_month = ? where id = ? and user_id = ?")
        .bind(month, id, req.userId!),
    );
    const results = await db.batch(statements);
    res.json({ updated: results.reduce((sum, r) => sum + r.meta.changes, 0) });
  } catch (error) {
    console.error("Falha ao definir mês de referência:", error);
    res.status(500).json({ error: "Falha ao definir mês de referência." });
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
 * mês.
 */
transactionsRouter.get("/summary", async (req, res) => {
  const parsed = monthSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos.", issues: parsed.error.flatten() });
  }

  const { month } = parsed.data;

  try {
    const row = await getDb()
      .prepare(
        `select coalesce(sum(case when t.amount >= 0 then t.amount end), 0) as income,
                coalesce(sum(case when t.amount < 0 then -t.amount end), 0) as expenses
         from transactions t join accounts a on a.id = t.account_id
         where t.user_id = ? and t.excluded = 0 and ${EFFECTIVE_MONTH} = ?`,
      )
      .bind(req.userId!, month)
      .first<{ income: number; expenses: number }>();
    const income = Number(row?.income ?? 0);
    const expenses = Number(row?.expenses ?? 0);

    res.json({
      month,
      income: round2(income),
      expenses: round2(expenses),
      balance: round2(income - expenses),
    });
  } catch (error) {
    console.error("Falha ao calcular o resumo:", error);
    res.status(500).json({ error: "Falha ao calcular o resumo." });
  }
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

  try {
    const { results } = await getDb()
      .prepare(
        `select coalesce(t.category, 'Outros') as category, sum(-t.amount) as total
         from transactions t join accounts a on a.id = t.account_id
         where t.user_id = ? and t.excluded = 0 and t.amount < 0 and ${EFFECTIVE_MONTH} = ?
         group by 1`,
      )
      .bind(req.userId!, month)
      .all<{ category: string; total: number }>();

    const totalExpenses = results.reduce((sum, row) => sum + Number(row.total), 0);
    const categories = results
      .map((row) => ({
        category: row.category,
        total: round2(Number(row.total)),
        percentage:
          totalExpenses > 0 ? Math.round((Number(row.total) / totalExpenses) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    res.json({ month, categories });
  } catch (error) {
    console.error("Falha ao calcular categorias:", error);
    res.status(500).json({ error: "Falha ao calcular categorias." });
  }
});

/**
 * GET /transactions/trend?months=6 — receitas/despesas/saldo dos últimos N
 * meses (incluindo o atual), do mais antigo pro mais recente. Uma única
 * query agregada no intervalo inteiro, em vez de uma por mês.
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

  // AAAA-MM compara certo como texto, então o intervalo é fechado nos dois lados.
  const rangeStart = monthList[0]!;
  const rangeEnd = monthList[monthList.length - 1]!;

  try {
    const { results } = await getDb()
      .prepare(
        `select ${EFFECTIVE_MONTH} as month,
                coalesce(sum(case when t.amount >= 0 then t.amount end), 0) as income,
                coalesce(sum(case when t.amount < 0 then -t.amount end), 0) as expenses
         from transactions t join accounts a on a.id = t.account_id
         where t.user_id = ? and t.excluded = 0
           and ${EFFECTIVE_MONTH} >= ? and ${EFFECTIVE_MONTH} <= ?
         group by 1`,
      )
      .bind(req.userId!, rangeStart, rangeEnd)
      .all<{ month: string; income: number; expenses: number }>();

    const byMonth = new Map(results.map((row) => [row.month, row]));
    const trend = monthList.map((monthKey) => {
      const income = Number(byMonth.get(monthKey)?.income ?? 0);
      const expenses = Number(byMonth.get(monthKey)?.expenses ?? 0);
      return {
        month: monthKey,
        income: round2(income),
        expenses: round2(expenses),
        balance: round2(income - expenses),
      };
    });

    res.json({ trend });
  } catch (error) {
    console.error("Falha ao calcular a tendência:", error);
    res.status(500).json({ error: "Falha ao calcular a tendência." });
  }
});
