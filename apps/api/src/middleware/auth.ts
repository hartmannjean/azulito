import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

/**
 * Middleware CENTRAL de auth do backend — toda rota protegida é montada com
 * ele em src/app.ts (ex: `app.use("/transactions", requireAuth, ...)`).
 * Nenhuma rota deve validar sessão/token por conta própria.
 *
 * Espera `Authorization: Bearer <access_token>`, o JWT que o Supabase Auth
 * emite quando o usuário loga em apps/web. A validação é feita chamando o
 * próprio servidor de Auth do Supabase (`auth.getUser(token)`) em vez de
 * verificar a assinatura do JWT localmente — isso garante que um token
 * revogado (logout, troca de senha) é rejeitado sem que a apps/api precise
 * gerenciar rotação de chave JWT ou uma denylist própria.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  // Auth falha FECHADA: ao contrário do rate limit, se não conseguirmos
  // confirmar o token com o Supabase (token inválido, credenciais mal
  // configuradas OU um erro de rede/infra ao tentar validar), a resposta é
  // sempre a mesma 401 genérica — nunca deixar a requisição passar, e nunca
  // vazar se o problema foi o token ou uma falha nossa ao validá-lo. Por
  // isso até a construção do client entra no try, não só a chamada de rede.
  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_ANON_KEY não configurados.");
    }

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    req.userId = data.user.id;
    req.accessToken = token;
    next();
  } catch (err) {
    console.error("falha ao validar token com o Supabase Auth:", err);
    res.status(401).json({ error: "Não autenticado." });
  }
}
