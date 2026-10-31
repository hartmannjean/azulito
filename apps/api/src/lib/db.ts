import { env } from "cloudflare:workers";

/**
 * Único ponto de acesso ao D1. Sem RLS aqui: toda query de uma rota
 * autenticada PRECISA filtrar por `user_id` (vindo de `req.userId`, nunca de
 * input do cliente).
 */
export function getDb(): D1Database {
  return env.DB;
}
