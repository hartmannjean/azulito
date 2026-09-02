import { Router } from "express";
import { createUserScopedClient } from "../lib/supabaseForUser.js";

export const bankConnectionsRouter = Router();

/** GET /bank-connections — lista as contas conectadas do usuário autenticado. */
bankConnectionsRouter.get("/", async (req, res) => {
  const supabase = createUserScopedClient(req.accessToken!);

  const { data, error } = await supabase
    .from("bank_connections")
    .select("id, institution_name, status")
    .eq("user_id", req.userId!);

  if (error) {
    return res.status(500).json({ error: "Falha ao buscar conexões bancárias." });
  }

  res.json({ connections: data });
});
