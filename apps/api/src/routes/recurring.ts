import { Router } from "express";
import { getDb } from "../lib/db.js";
import { merchantKey } from "../lib/merchant.js";

export const recurringRouter = Router();

const LOOKBACK_MONTHS = 6;
const MIN_MONTHS = 3;
// Quanto o valor pode variar em relação à mediana para contar como "o mesmo
// gasto" (assinaturas têm reajuste, contas de consumo oscilam um pouco).
const AMOUNT_TOLERANCE = 0.25;

type Row = {
  merchant_key: string | null;
  description: string;
  category: string | null;
  amount: number;
  transaction_date: string;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * GET /recurring — gastos que se repetem todo mês: mesmo estabelecimento, em
 * pelo menos MIN_MONTHS meses distintos da janela, com valor parecido, e que
 * apareceram nos últimos 2 meses (senão a assinatura provavelmente acabou).
 * Heurística sobre os dados importados — não é uma lista de assinaturas
 * confirmada pelo banco.
 */
recurringRouter.get("/", async (req, res) => {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - LOOKBACK_MONTHS, 1))
    .toISOString()
    .slice(0, 10);

  try {
    const { results } = await getDb()
      .prepare(
        `select merchant_key, description, category, amount, transaction_date
         from transactions
         where user_id = ? and excluded = 0 and amount < 0 and transaction_date >= ?
         order by transaction_date`,
      )
      .bind(req.userId!, since)
      .all<Row>();

    const groups = new Map<string, Row[]>();
    for (const row of results) {
      const key = row.merchant_key ?? merchantKey(row.description);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      .toISOString()
      .slice(0, 7);

    const items = [];
    for (const rows of groups.values()) {
      const months = new Set(rows.map((row) => row.transaction_date.slice(0, 7)));
      if (months.size < MIN_MONTHS) continue;

      const amounts = rows.map((row) => -row.amount);
      const typical = median(amounts);
      const similar = amounts.filter((a) => Math.abs(a - typical) <= typical * AMOUNT_TOLERANCE);
      if (similar.length < MIN_MONTHS) continue;

      const last = rows[rows.length - 1]!;
      const lastMonth = last.transaction_date.slice(0, 7);
      if (lastMonth !== currentMonth && lastMonth !== previousMonth) continue;

      items.push({
        merchant: last.description,
        category: last.category,
        amount: Math.round(typical * 100) / 100,
        months_seen: months.size,
        last_date: last.transaction_date,
        charged_this_month: months.has(currentMonth),
      });
    }

    items.sort((a, b) => b.amount - a.amount);
    const round = (value: number) => Math.round(value * 100) / 100;

    res.json({
      items,
      pending_total: round(
        items.filter((item) => !item.charged_this_month).reduce((sum, item) => sum + item.amount, 0),
      ),
      monthly_total: round(items.reduce((sum, item) => sum + item.amount, 0)),
    });
  } catch (error) {
    console.error("Falha ao calcular recorrências:", error);
    res.status(500).json({ error: "Falha ao calcular recorrências." });
  }
});
