import { Router } from "express";
import { monthSummaryQuerySchema, upsertBudgetSchema } from "@azulito/shared";
import { getDb } from "../lib/db.js";
import { resolveCategory } from "../lib/categories.js";
import { EFFECTIVE_MONTH } from "../lib/refmonth.js";
import { logAction } from "../lib/history.js";

export const budgetsRouter = Router();

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
  if (!parsed.success || parsed.data.category === "Income") {
    return res.status(400).json({ error: "Orçamento inválido." });
  }
  const { monthly_limit } = parsed.data;

  try {
    const resolved = await resolveCategory(req.userId!, parsed.data.category);
    if (!resolved) return res.status(400).json({ error: "Orçamento inválido." });
    const category = resolved.name;

    const previous = await getDb()
      .prepare("select monthly_limit from budgets where user_id = ? and category = ?")
      .bind(req.userId!, category)
      .first<{ monthly_limit: number }>();

    await getDb()
      .prepare(
        `insert into budgets (user_id, category, monthly_limit) values (?, ?, ?)
         on conflict (user_id, category) do update set
           monthly_limit = excluded.monthly_limit,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(req.userId!, category, Math.round(monthly_limit * 100) / 100)
      .run();
    await logAction(req.userId!, "budget_set", { category, limit: Math.round(monthly_limit * 100) / 100 }, [
      { op: "budget", category, monthly_limit: previous?.monthly_limit ?? null },
    ]);
    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao salvar orçamento:", error);
    res.status(500).json({ error: "Falha ao salvar orçamento." });
  }
});

/** DELETE /budgets/:category — remove o limite de uma categoria. */
budgetsRouter.delete("/:category", async (req, res) => {
  try {
    const previous = await getDb()
      .prepare("select monthly_limit from budgets where user_id = ? and category = ?")
      .bind(req.userId!, req.params.category)
      .first<{ monthly_limit: number }>();
    await getDb()
      .prepare("delete from budgets where user_id = ? and category = ?")
      .bind(req.userId!, req.params.category)
      .run();
    if (previous) {
      await logAction(req.userId!, "budget_remove", { category: req.params.category }, [
        { op: "budget", category: req.params.category, monthly_limit: previous.monthly_limit },
      ]);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao remover orçamento:", error);
    res.status(500).json({ error: "Falha ao remover orçamento." });
  }
});

/**
 * GET /budgets/progress?month=AAAA-MM — quanto já foi gasto em cada categoria
 * com limite, no mês, e o gasto nas categorias sem limite. Só conta despesa
 * real (fora as `excluded`).
 */
budgetsRouter.get("/progress", async (req, res) => {
  const parsed = monthSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos." });
  }
  const { month } = parsed.data;
  const db = getDb();

  try {
    const [limits, spent] = await Promise.all([
      db
        .prepare("select category, monthly_limit from budgets where user_id = ?")
        .bind(req.userId!)
        .all<{ category: string; monthly_limit: number }>(),
      db
        .prepare(
          `select t.category, sum(-t.amount) as spent
           from transactions t join accounts a on a.id = t.account_id
           where t.user_id = ? and t.excluded = 0 and t.amount < 0 and ${EFFECTIVE_MONTH} = ?
           group by 1`,
        )
        .bind(req.userId!, month)
        .all<{ category: string | null; spent: number }>(),
    ]);

    const spentByCategory = new Map(spent.results.map((row) => [row.category, Number(row.spent)]));
    const limited = new Set(limits.results.map((row) => row.category));
    const unbudgeted = spent.results
      .filter((row) => row.category === null || !limited.has(row.category))
      .map((row) => ({ category: row.category, spent: Math.round(Number(row.spent) * 100) / 100 }))
      .sort((a, b) => b.spent - a.spent);
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
      unbudgeted,
      unbudgetedTotal: Math.round(unbudgeted.reduce((sum, row) => sum + row.spent, 0) * 100) / 100,
    });
  } catch (error) {
    console.error("Falha ao calcular orçamentos:", error);
    res.status(500).json({ error: "Falha ao calcular orçamentos." });
  }
});
