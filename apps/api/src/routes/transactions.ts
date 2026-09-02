import { Router } from "express";
import { listTransactionsQuerySchema } from "@azulito/shared";
import { createUserScopedClient } from "../lib/supabaseForUser.js";

export const transactionsRouter = Router();

/**
 * GET /transactions — lista as transações do usuário autenticado.
 * Montada com `requireAuth` em src/app.ts; aqui já podemos confiar em
 * `req.userId`/`req.accessToken`.
 */
transactionsRouter.get("/", async (req, res) => {
  const parsed = listTransactionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos.", issues: parsed.error.flatten() });
  }

  const { limit, cursor, category } = parsed.data;
  const supabase = createUserScopedClient(req.accessToken!);

  let query = supabase
    .from("transactions")
    // RLS (via createUserScopedClient) já restringe a linhas do próprio
    // usuário; o filtro abaixo é defesa em profundidade, não a única barreira.
    .select("id, description, amount, currency_code, transaction_date, category")
    .eq("user_id", req.userId!)
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("transaction_date", cursor);
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: "Falha ao buscar transações." });
  }

  res.json({ transactions: data });
});
