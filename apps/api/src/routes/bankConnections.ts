import { Router } from "express";
import { getDb } from "../lib/db.js";

export const bankConnectionsRouter = Router();

/** GET /bank-connections — lista as contas conectadas do usuário autenticado. */
bankConnectionsRouter.get("/", async (req, res) => {
  try {
    const { results } = await getDb()
      .prepare("select id, institution_name, status from bank_connections where user_id = ?")
      .bind(req.userId!)
      .all();
    res.json({ connections: results });
  } catch (error) {
    console.error("Falha ao buscar conexões bancárias:", error);
    res.status(500).json({ error: "Falha ao buscar conexões bancárias." });
  }
});
