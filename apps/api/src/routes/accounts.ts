import { Router } from "express";
import { updateCardCycleSchema } from "@azulito/shared";
import { getDb } from "../lib/db.js";
import { logAction } from "../lib/history.js";

export const accountsRouter = Router();

/** GET /accounts — contas/cartões importados do usuário autenticado. */
accountsRouter.get("/", async (req, res) => {
  try {
    const { results } = await getDb()
      .prepare(
        `select a.id, a.institution_name, a.kind, a.closing_day, a.due_day,
                (select max(created_at) from imports i where i.account_id = a.id) as last_import_at
         from accounts a
         where a.user_id = ?
         order by a.created_at`,
      )
      .bind(req.userId!)
      .all();
    res.json({ accounts: results });
  } catch (error) {
    console.error("Falha ao buscar contas:", error);
    res.status(500).json({ error: "Falha ao buscar contas." });
  }
});

/**
 * PATCH /accounts/:id — ajusta fechamento e vencimento da fatura (só cartão).
 * Os padrões vêm do OFX/estimativa; aqui o usuário corrige.
 */
accountsRouter.patch("/:id", async (req, res) => {
  const parsed = updateCardCycleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });

  try {
    const previous = await getDb()
      .prepare("select closing_day, due_day from accounts where id = ? and user_id = ? and kind = 'credit_card'")
      .bind(req.params.id, req.userId!)
      .first<{ closing_day: number | null; due_day: number | null }>();
    const result = await getDb()
      .prepare(
        "update accounts set closing_day = ?, due_day = ? where id = ? and user_id = ? and kind = 'credit_card'",
      )
      .bind(parsed.data.closing_day, parsed.data.due_day, req.params.id, req.userId!)
      .run();
    if (result.meta.changes === 0) return res.status(404).json({ error: "Cartão não encontrado." });
    if (previous) {
      await logAction(
        req.userId!,
        "card_cycle",
        { closing: parsed.data.closing_day, due: parsed.data.due_day },
        [{ op: "card_cycle", account_id: req.params.id, closing_day: previous.closing_day, due_day: previous.due_day }],
      );
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao atualizar o cartão:", error);
    res.status(500).json({ error: "Falha ao atualizar o cartão." });
  }
});
