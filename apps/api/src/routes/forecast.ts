import { Router } from "express";
import {
  addMonths,
  buildForecast,
  createScheduledSchema,
  updateScheduledSchema,
  type ForecastResponse,
  type SpendByKind,
} from "@azulito/shared";
import { getDb } from "../lib/db.js";
import { resolveCategory } from "../lib/categories.js";
import { logAction } from "../lib/history.js";
import { currentMonthUtc } from "../lib/ai-facts.js";
import { EFFECTIVE_MONTH } from "../lib/refmonth.js";
import { detectRecurring, loadRecurringRows } from "../lib/recurring.js";

export const forecastRouter = Router();
export const scheduledRouter = Router();

const MAX_ITEMS_PER_USER = 500;
const HORIZON_MONTHS = 3;

type ScheduledDbRow = {
  id: string;
  kind: "expense" | "income";
  description: string;
  amount: number;
  due_date: string;
  category: string | null;
  paid: number;
};

const ID_PATTERN = /^[0-9a-f]{32}$/;

/**
 * GET /forecast — previsão de receitas e despesas dos próximos meses e a lista
 * de contas a pagar/receber cadastradas (ver buildForecast em @azulito/shared).
 */
forecastRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const current = currentMonthUtc();

  try {
    const [spendRows, scheduledRows, cardRows, expenseRecurring, incomeRecurring] = await Promise.all([
      db
        .prepare(
          `select ${EFFECTIVE_MONTH} as month, a.kind as kind,
                  sum(case when t.amount < 0 then -t.amount else 0 end) as spent,
                  sum(case when t.amount >= 0 then t.amount else 0 end) as income
           from transactions t join accounts a on a.id = t.account_id
           where t.user_id = ? and t.excluded = 0
             and ${EFFECTIVE_MONTH} >= ? and ${EFFECTIVE_MONTH} <= ?
           group by 1, 2`,
        )
        .bind(userId, addMonths(current, -3), addMonths(current, HORIZON_MONTHS))
        .all<SpendByKind>(),
      // Pendentes de qualquer data (os vencidos ainda precisam ser pagos) e os já pagos recentes.
      db
        .prepare(
          `select id, kind, description, amount, due_date, category, paid from scheduled_items
           where user_id = ? and (paid = 0 or due_date >= date(?, '-45 days'))
           order by due_date limit 300`,
        )
        .bind(userId, today)
        .all<ScheduledDbRow>(),
      db
        .prepare(
          `select closing_day, due_day from accounts
           where user_id = ? and kind = 'credit_card' and closing_day is not null and due_day is not null`,
        )
        .bind(userId)
        .all<{ closing_day: number; due_day: number }>(),
      loadRecurringRows(userId, now, "expense"),
      loadRecurringRows(userId, now, "income"),
    ]);

    // Transações perto dos vencimentos, para reconhecer o que já foi pago.
    const earliest = scheduledRows.results.reduce((min, r) => (r.due_date < min ? r.due_date : min), today);
    const txs = await db
      .prepare(
        `select transaction_date as date, amount from transactions
         where user_id = ? and excluded = 0 and transaction_date >= date(?, '-8 days')
         order by transaction_date limit 3000`,
      )
      .bind(userId, earliest)
      .all<{ date: string; amount: number }>();

    const toPoint = (item: ReturnType<typeof detectRecurring>[number]) => ({
      amount: item.amount,
      charged_this_month: item.charged_this_month,
      account_kind: item.account_kind,
    });

    const forecast = buildForecast({
      today,
      months: HORIZON_MONTHS,
      spend: spendRows.results.map((r) => ({ ...r, spent: Number(r.spent), income: Number(r.income) })),
      scheduled: scheduledRows.results.map((r) => ({ ...r, amount: Number(r.amount), paid: r.paid === 1 })),
      transactions: txs.results.map((t) => ({ date: t.date, amount: Number(t.amount) })),
      recurringExpenses: detectRecurring(expenseRecurring, now).map(toPoint),
      recurringIncomes: detectRecurring(incomeRecurring, now).map(toPoint),
      cards: cardRows.results,
    });

    res.json(forecast satisfies ForecastResponse);
  } catch (error) {
    console.error("Falha ao calcular a previsão:", error);
    res.status(500).json({ error: "Falha ao calcular a previsão." });
  }
});

/** POST /scheduled — cadastra um boleto a pagar ou uma entrada prevista. */
scheduledRouter.post("/", async (req, res) => {
  const parsed = createScheduledSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });
  const userId = req.userId!;
  const db = getDb();
  const { kind, description, amount, due_date } = parsed.data;

  try {
    let category: string | null = null;
    if (parsed.data.category) {
      const resolved = await resolveCategory(userId, parsed.data.category);
      if (!resolved) return res.status(400).json({ error: "Categoria inválida." });
      category = resolved.name;
    }

    const count = await db
      .prepare("select count(*) as n from scheduled_items where user_id = ?")
      .bind(userId)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_ITEMS_PER_USER) return res.status(400).json({ error: "Limite de lançamentos atingido." });

    const created = await db
      .prepare(
        `insert into scheduled_items (user_id, kind, description, amount, due_date, category)
         values (?, ?, ?, ?, ?, ?) returning id`,
      )
      .bind(userId, kind, description, Math.round(amount * 100) / 100, due_date, category)
      .first<{ id: string }>();
    if (!created) throw new Error("Falha ao gravar o lançamento.");

    await logAction(userId, "scheduled_create", { kind, description: description.slice(0, 60), amount, due_date }, [
      { op: "scheduled_delete", id: created.id },
    ]);
    res.status(201).json({ id: created.id });
  } catch (error) {
    console.error("Falha ao cadastrar o lançamento:", error);
    res.status(500).json({ error: "Falha ao cadastrar o lançamento." });
  }
});

async function findOwn(userId: string, id: string): Promise<ScheduledDbRow | null> {
  return getDb()
    .prepare(
      "select id, kind, description, amount, due_date, category, paid from scheduled_items where id = ? and user_id = ?",
    )
    .bind(id, userId)
    .first<ScheduledDbRow>();
}

/** PATCH /scheduled/:id — marca como paga/recebida (ou desmarca). */
scheduledRouter.patch("/:id", async (req, res) => {
  const id = String(req.params.id);
  const parsed = updateScheduledSchema.safeParse(req.body);
  if (!ID_PATTERN.test(id) || !parsed.success) return res.status(400).json({ error: "Dados inválidos." });
  const userId = req.userId!;

  try {
    const before = await findOwn(userId, id);
    if (!before) return res.status(404).json({ error: "Lançamento não encontrado." });

    await getDb()
      .prepare("update scheduled_items set paid = ? where id = ? and user_id = ?")
      .bind(parsed.data.paid ? 1 : 0, id, userId)
      .run();
    await logAction(
      userId,
      "scheduled_paid",
      { description: before.description.slice(0, 60), paid: parsed.data.paid },
      [{ op: "scheduled_upsert", item: before }],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao atualizar o lançamento:", error);
    res.status(500).json({ error: "Falha ao atualizar o lançamento." });
  }
});

/** DELETE /scheduled/:id — remove um lançamento cadastrado. */
scheduledRouter.delete("/:id", async (req, res) => {
  const id = String(req.params.id);
  if (!ID_PATTERN.test(id)) return res.status(400).json({ error: "Lançamento inválido." });
  const userId = req.userId!;

  try {
    const before = await findOwn(userId, id);
    if (!before) return res.status(404).json({ error: "Lançamento não encontrado." });

    await getDb().prepare("delete from scheduled_items where id = ? and user_id = ?").bind(id, userId).run();
    await logAction(userId, "scheduled_delete", { description: before.description.slice(0, 60) }, [
      { op: "scheduled_upsert", item: before },
    ]);
    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao remover o lançamento:", error);
    res.status(500).json({ error: "Falha ao remover o lançamento." });
  }
});
