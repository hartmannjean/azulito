import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { env } from "cloudflare:workers";
import { getAuth } from "../lib/auth.js";

/**
 * Middleware CENTRAL de auth do backend — toda rota protegida é montada com
 * ele em src/app.ts (ex: `app.use("/transactions", requireAuth, ...)`).
 * Nenhuma rota deve validar sessão por conta própria.
 *
 * Valida a sessão do Better Auth a partir do cookie repassado por apps/web
 * (service binding). `req.userId` vem SEMPRE da sessão no banco — nunca de
 * header, query ou body.
 *
 * Auth falha FECHADA: qualquer problema (sessão inválida, expirada, e-mail
 * não verificado, erro interno) vira o mesmo 401 genérico.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id || !session.user.emailVerified) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    // Limite por USUÁRIO (as chamadas do web não trazem IP, então por IP todos
    // dividiriam um contador só). Falha ABERTA: o limitador fora do ar não derruba a api.
    const limiter = env.RATE_LIMITER_USER;
    if (limiter) {
      try {
        const { success } = await limiter.limit({ key: `u:${session.user.id}` });
        if (!success) {
          res.setHeader("Retry-After", "60");
          return res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
        }
      } catch (error) {
        console.error("limite por usuário indisponível, deixando passar:", error);
      }
    }

    req.userId = session.user.id;
    req.userEmail = session.user.email;
    next();
  } catch (error) {
    console.error("falha ao validar sessão:", error);
    res.status(401).json({ error: "Não autenticado." });
  }
}
