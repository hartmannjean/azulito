import { Router } from "express";
import { addMonths, buildCardComparison, type CardComparison, type CardRow } from "@azulito/shared";
import { getDb } from "../lib/db.js";

export const cardRouter = Router();

/** Hoje (AAAA-MM-DD) no horário de Brasília: à noite o UTC já virou o dia e o corte ficaria um dia à frente. */
function todayInBrazil(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/**
 * GET /card/comparison — compras no cartão deste mês até hoje × mês passado
 * até o mesmo dia (ver buildCardComparison em @azulito/shared). Usa a data da
 * COMPRA, não o mês da fatura, e deixa as parcelas de compras antigas de fora.
 */
cardRouter.get("/comparison", async (req, res) => {
  const userId = req.userId!;
  const today = todayInBrazil();
  const since = `${addMonths(today.slice(0, 7), -1)}-01`;
  const db = getDb();

  try {
    const [rows, latest] = await Promise.all([
      db
        .prepare(
          `select t.transaction_date as date, t.amount, t.description, t.category
           from transactions t join accounts a on a.id = t.account_id
           where t.user_id = ? and a.kind = 'credit_card' and t.excluded = 0
             and t.transaction_date >= ? and t.transaction_date <= ?
           order by t.transaction_date limit 5000`,
        )
        .bind(userId, since, today)
        .all<CardRow>(),
      db
        .prepare(
          `select max(t.transaction_date) as date
           from transactions t join accounts a on a.id = t.account_id
           where t.user_id = ? and a.kind = 'credit_card' and t.excluded = 0 and t.transaction_date <= ?`,
        )
        .bind(userId, today)
        .first<{ date: string | null }>(),
    ]);

    const comparison = buildCardComparison({
      today,
      dataUntil: latest?.date ?? null,
      rows: rows.results.map((r) => ({ ...r, amount: Number(r.amount) })),
    });
    res.json(comparison satisfies CardComparison);
  } catch (error) {
    console.error("Falha ao comparar o cartão:", error);
    res.status(500).json({ error: "Falha ao comparar o cartão." });
  }
});
