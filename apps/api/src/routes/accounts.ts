import { Router } from "express";
import { getDb } from "../lib/db.js";

export const accountsRouter = Router();

/** GET /accounts — contas/cartões importados do usuário autenticado. */
accountsRouter.get("/", async (req, res) => {
  try {
    const { results } = await getDb()
      .prepare(
        `select a.id, a.institution_name, a.kind,
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
