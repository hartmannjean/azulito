import { Router } from "express";
import { isCategory, monthSummaryQuerySchema, upsertBudgetSchema } from "@azulito/shared";
import { getDb } from "../lib/db.js";

export const budgetsRouter = Router();

function monthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const end =
    mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
  return { start: `${month}-01`, end };
}

/** GET /budgets — limites mensais definidos pelo usuário. */
budgetsRouter.get("/", async (req, res) => {
  try {
    const { results } = await getDb()
      .prepare("select category, monthly_limit from budgets where user_id = ? order by category")
      .bind(req.userId!)
      .all();
    res.json({ budgets: results });
  } catch (error) {
    console.error("Falha ao buscar orçamentos:", error);
    res.status(500).json({ error: "Falha ao buscar orçamentos." });
  }
});

/** PUT /budgets — cria/atualiza o limite mensal de uma categoria de gasto. */
budgetsRouter.put("/", async (req, res) => {
  const parsed = upsertBudgetSchema.safeParse(req.body);
  if (!parsed.success || !isCategory(parsed.data.category) || parsed.data.category === "Income") {
    return res.status(400).json({ error: "Orçamento inválido." });
  }
  const { category, monthly_limit } = parsed.data;

  try {
    await getDb()
      .prepare(
        `insert into budgets (user_id, category, monthly_limit) values (?, ?, ?)
         on conflict (user_id, category) do update set
           monthly_limit = excluded.monthly_limit,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(req.userId!, category, Math.round(monthly_limit * 100) / 100)
      .run();
    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao salvar orçamento:", error);
    res.status(500).json({ error: "Falha ao salvar orçamento." });
  }
});

/** DELETE /budgets/:category — remove o limite de uma categoria. */
budgetsRouter.delete("/:category", async (req, res) => {
  try {
    await getDb()
      .prepare("delete from budgets where user_id = ? and category = ?")
      .bind(req.userId!, req.params.category)
      .run();
    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao remover orçamento:", error);
    res.status(500).json({ error: "Falha ao remover orçamento." });
  }
});

/**
 * GET /budgets/progress?month=AAAA-MM — quanto já foi gasto em cada categoria
 * com limite, no mês. Só conta despesa real (fora as `excluded`).
 */
budgetsRouter.get("/progress", async (req, res) => {
  const parsed = monthSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos." });
  }
  const { month } = parsed.data;
  const { start, end } = monthRange(month);
  const db = getDb();

  try {
    const [limits, spent] = await Promise.all([
      db
        .prepare("select category, monthly_limit from budgets where user_id = ?")
        .bind(req.userId!)
        .all<{ category: string; monthly_limit: number }>(),
      db
        .prepare(
          `select coalesce(category, 'Other') as category, sum(-amount) as spent
           from transactions
           where user_id = ? and excluded = 0 and amount < 0
             and transaction_date >= ? and transaction_date < ?
           group by 1`,
        )
        .bind(req.userId!, start, end)
        .all<{ category: string; spent: number }>(),
    ]);

    const spentByCategory = new Map(spent.results.map((row) => [row.category, row.spent]));
    const budgets = limits.results
      .map((row) => {
        const value = Math.round((spentByCategory.get(row.category) ?? 0) * 100) / 100;
        return {
          category: row.category,
          limit: row.monthly_limit,
          spent: value,
          percentage: Math.round((value / row.monthly_limit) * 1000) / 10,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    res.json({
      month,
      budgets,
      totalLimit: Math.round(budgets.reduce((sum, b) => sum + b.limit, 0) * 100) / 100,
      totalSpent: Math.round(budgets.reduce((sum, b) => sum + b.spent, 0) * 100) / 100,
    });
  } catch (error) {
    console.error("Falha ao calcular orçamentos:", error);
    res.status(500).json({ error: "Falha ao calcular orçamentos." });
  }
});
