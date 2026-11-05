import { Router } from "express";
import { addMonths, type RecurringSummary } from "@azulito/shared";
import { currentMonthUtc, loadSpendRows, round2 } from "../lib/ai-facts.js";
import { cooldownActive, getInsight, saveInsight } from "../lib/insight-store.js";
import { detectRecurring, generateRecurringInsight, loadRecurringRows } from "../lib/recurring.js";
import { AI_LIMIT_MESSAGE, reserveAi } from "../lib/limits.js";

export const recurringRouter = Router();

/**
 * GET /recurring — gastos que se repetem todo mês (ver lib/recurring.ts), mais
 * a última análise da IA sobre eles.
 */
recurringRouter.get("/", async (req, res) => {
  try {
    const now = new Date();
    const [rows, insight] = await Promise.all([loadRecurringRows(req.userId!, now), getInsight(req.userId!, "recurring")]);
    const items = detectRecurring(rows, now).map((item) => ({
      merchant: item.merchant,
      category: item.category,
      amount: item.amount,
      months_seen: item.months_seen,
      last_date: item.last_date,
      charged_this_month: item.charged_this_month,
    }));

    res.json({
      items,
      pending_total: round2(items.filter((item) => !item.charged_this_month).reduce((sum, item) => sum + item.amount, 0)),
      monthly_total: round2(items.reduce((sum, item) => sum + item.amount, 0)),
      insight: insight ?? null,
    } satisfies RecurringSummary);
  } catch (error) {
    console.error("Falha ao calcular recorrências:", error);
    res.status(500).json({ error: "Falha ao calcular recorrências." });
  }
});

/** POST /recurring/insight — a IA analisa as recorrências (o que revisar, cancelar ou renegociar). */
recurringRouter.post("/insight", async (req, res) => {
  const userId = req.userId!;
  try {
    const previous = await getInsight(userId, "recurring");
    if (cooldownActive(previous)) {
      return res.status(429).json({ error: "Aguarde alguns segundos para gerar outra análise." });
    }

    const now = new Date();
    const current = currentMonthUtc();
    const [rows, spend] = await Promise.all([
      loadRecurringRows(userId, now),
      loadSpendRows(userId, addMonths(current, -3)),
    ]);
    const items = detectRecurring(rows, now);
    if (items.length === 0) return res.status(422).json({ error: "Ainda não há recorrências detectadas." });

    const ai = await reserveAi(userId, "insight", 1);
    if (!ai.ok) return res.status(429).json({ error: AI_LIMIT_MESSAGE[ai.reason] });
    const months = [addMonths(current, -3), addMonths(current, -2), addMonths(current, -1)];
    const incomes = months.map((m) => spend.filter((r) => r.month === m).reduce((sum, r) => sum + r.income, 0));
    const withIncome = incomes.filter((v) => v > 0);
    const avgIncome = withIncome.length > 0 ? withIncome.reduce((a, b) => a + b, 0) / withIncome.length : 0;

    const content = await generateRecurringInsight(items, avgIncome);
    res.json(await saveInsight(userId, "recurring", content, "ai_recurring", previous));
  } catch (error) {
    console.error("Falha ao analisar recorrências:", error);
    res.status(500).json({ error: "Falha ao gerar a análise." });
  }
});
