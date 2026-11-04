import { Router } from "express";
import { getDb } from "../lib/db.js";
import { undoAction } from "../lib/history.js";

export const historyRouter = Router();

const ID_PATTERN = /^[0-9a-f]{32}$/;

/** GET /history?limit=N — ações recentes (sem o payload de desfazer). */
historyRouter.get("/", async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  try {
    const { results } = await getDb()
      .prepare(
        `select id, kind, meta, created_at, undone_at from action_log
         where user_id = ? order by created_at desc limit ?`,
      )
      .bind(req.userId!, limit)
      .all<{ id: string; kind: string; meta: string; created_at: string; undone_at: string | null }>();

    res.json({
      now: new Date().toISOString(),
      actions: results.map((row) => {
        let meta: unknown = {};
        try {
          meta = JSON.parse(row.meta);
        } catch {
          // meta ilegível só empobrece a mensagem
        }
        return { id: row.id, kind: row.kind, meta, created_at: row.created_at, undone_at: row.undone_at };
      }),
    });
  } catch (error) {
    console.error("Falha ao buscar o histórico:", error);
    res.status(500).json({ error: "Falha ao buscar o histórico." });
  }
});

/** POST /history/:id/undo — desfaz uma ação. */
historyRouter.post("/:id/undo", async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    return res.status(400).json({ error: "Ação inválida." });
  }
  try {
    const result = await undoAction(req.userId!, id);
    if (result === "not_found") return res.status(404).json({ error: "Ação não encontrada." });
    if (result === "already_undone") return res.status(409).json({ error: "Essa ação já foi desfeita." });
    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao desfazer:", error);
    res.status(500).json({ error: "Falha ao desfazer." });
  }
});
