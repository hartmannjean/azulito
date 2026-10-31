import type { Request, Response, NextFunction } from "express";
import { ACCESS_JWT_HEADER, verifyAccessJwt } from "@azulito/shared";

/**
 * Middleware CENTRAL de auth do backend — toda rota protegida é montada com
 * ele em src/app.ts (ex: `app.use("/transactions", requireAuth, ...)`).
 * Nenhuma rota deve validar sessão/token por conta própria.
 *
 * Espera o JWT do Cloudflare Access em `Cf-Access-Jwt-Assertion`, repassado
 * por apps/web (que o recebe do Access). A assinatura, o emissor e a
 * audiência são verificados aqui — nunca confiar só na presença do header ou
 * em e-mail/ID vindos de qualquer outro lugar.
 *
 * Auth falha FECHADA: qualquer problema vira o mesmo 401 genérico.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers[ACCESS_JWT_HEADER];
  const token = typeof header === "string" ? header : null;

  const identity = await verifyAccessJwt(
    token,
    process.env.CF_ACCESS_TEAM_DOMAIN,
    process.env.CF_ACCESS_AUD,
  );

  if (!identity) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  req.userId = identity.userId;
  next();
}
