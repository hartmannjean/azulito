import { Router } from "express";
import {
  addMonths,
  buildSavingsOverview,
  savingsMonthSchema,
  upsertSavingsSnapshotSchema,
  type SavingsOverview,
} from "@azulito/shared";
import { getDb } from "../lib/db.js";
import { isInvestmentFlow } from "../lib/classify.js";
import { generateSavingsPlan } from "../lib/insight.js";
import { loadSpendRows } from "../lib/ai-facts.js";
import { logAction } from "../lib/history.js";

export const savingsRouter = Router();

// Uma análise por vez e com intervalo mínimo: cada chamada gasta neurônios do
// plano gratuito do Workers AI.
const INSIGHT_COOLDOWN_MS = 30_000;

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function loadOverview(userId: string): Promise<Omit<SavingsOverview, "insight">> {
  const db = getDb();
  const [flowRows, snapshotRows] = await Promise.all([
    // Aplicação/resgate vêm marcados como `excluded` na importação
    // (lib/classify.ts); o filtro fino por descrição é o mesmo daquele arquivo.
    db
      .prepare(
        `select substr(t.transaction_date, 1, 7) as month, t.description, t.amount
         from transactions t join accounts a on a.id = t.account_id
         where t.user_id = ? and t.excluded = 1 and a.kind = 'checking'
         limit 20000`,
      )
      .bind(userId)
      .all<{ month: string; description: string; amount: number }>(),
    db
      .prepare("select month, balance from savings_snapshots where user_id = ?")
      .bind(userId)
      .all<{ month: string; balance: number }>(),
  ]);

  const flows = flowRows.results
    .filter((row) => isInvestmentFlow(row.description))
    .map((row) => ({ month: row.month, amount: Number(row.amount) }));
  const snapshots: Record<string, number> = {};
  for (const row of snapshotRows.results) snapshots[row.month] = Number(row.balance);

  return buildSavingsOverview(flows, snapshots, currentMonth());
}

/** GET /savings — mês a mês das caixinhas, projeção e a última análise da IA. */
savingsRouter.get("/", async (req, res) => {
  try {
    const [overview, insight] = await Promise.all([
      loadOverview(req.userId!),
      getDb()
        .prepare("select content, created_at from ai_insights where user_id = ? and kind = 'savings'")
        .bind(req.userId!)
        .first<{ content: string; created_at: string }>(),
    ]);
    res.json({ ...overview, insight: insight ?? null } satisfies SavingsOverview);
  } catch (error) {
    console.error("Falha ao calcular as caixinhas:", error);
    res.status(500).json({ error: "Falha ao calcular as caixinhas." });
  }
});

/** PUT /savings — informa (ou corrige) o saldo das caixinhas no fim de um mês. */
savingsRouter.put("/", async (req, res) => {
  const parsed = upsertSavingsSnapshotSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.month > currentMonth()) {
    return res.status(400).json({ error: "Dados inválidos." });
  }

  try {
    const previous = await getDb()
      .prepare("select balance from savings_snapshots where user_id = ? and month = ?")
      .bind(req.userId!, parsed.data.month)
      .first<{ balance: number }>();
    await getDb()
      .prepare(
        `insert into savings_snapshots (user_id, month, balance) values (?, ?, ?)
         on conflict (user_id, month) do update set
           balance = excluded.balance,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(req.userId!, parsed.data.month, Math.round(parsed.data.balance * 100) / 100)
      .run();
    await logAction(
      req.userId!,
      "savings_set",
      { month: parsed.data.month, balance: Math.round(parsed.data.balance * 100) / 100 },
      [{ op: "snapshot", month: parsed.data.month, balance: previous?.balance ?? null }],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao salvar o saldo:", error);
    res.status(500).json({ error: "Falha ao salvar o saldo." });
  }
});

/** DELETE /savings/:month — remove o saldo informado de um mês. */
savingsRouter.delete("/:month", async (req, res) => {
  const month = savingsMonthSchema.safeParse(req.params.month);
  if (!month.success) return res.status(400).json({ error: "Mês inválido." });

  try {
    const previous = await getDb()
      .prepare("select balance from savings_snapshots where user_id = ? and month = ?")
      .bind(req.userId!, month.data)
      .first<{ balance: number }>();
    await getDb()
      .prepare("delete from savings_snapshots where user_id = ? and month = ?")
      .bind(req.userId!, month.data)
      .run();
    if (previous) {
      await logAction(req.userId!, "savings_remove", { month: month.data }, [
        { op: "snapshot", month: month.data, balance: previous.balance },
      ]);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao remover o saldo:", error);
    res.status(500).json({ error: "Falha ao remover o saldo." });
  }
});

/**
 * POST /savings/insight — a IA lê os números agregados (receita, despesa por
 * categoria, caixinhas) e escreve onde cortar gastos. Os números do texto
 * vêm de código; ver lib/insight.ts.
 */
savingsRouter.post("/insight", async (req, res) => {
  const userId = req.userId!;
  const db = getDb();

  try {
    const last = await db
      .prepare("select content, created_at from ai_insights where user_id = ? and kind = 'savings'")
      .bind(userId)
      .first<{ content: string; created_at: string }>();
    if (last && Date.now() - Date.parse(last.created_at) < INSIGHT_COOLDOWN_MS) {
      return res.status(429).json({ error: "Aguarde alguns segundos para gerar outra análise." });
    }

    const current = currentMonth();
    const since = addMonths(current, -3);
    const [overview, spend] = await Promise.all([loadOverview(userId), loadSpendRows(userId, since)]);

    const plan = await generateSavingsPlan(userId, spend, overview, current);
    const content = JSON.stringify(plan);

    await db
      .prepare(
        `insert into ai_insights (user_id, kind, content) values (?, 'savings', ?)
         on conflict (user_id, kind) do update set
           content = excluded.content,
           created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(userId, content)
      .run();

    await logAction(userId, "insight", {}, [
      { op: "insight", content: last?.content ?? null, created_at: last?.created_at ?? null },
    ]);
    res.json({ content, created_at: new Date().toISOString() });
  } catch (error) {
    console.error("Falha ao gerar a análise:", error);
    res.status(500).json({ error: "Falha ao gerar a análise." });
  }
});
