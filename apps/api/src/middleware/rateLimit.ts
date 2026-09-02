import type { Request, Response, NextFunction } from "express";
import { apiRateLimiter, checkRateLimit } from "@azulito/shared";
import { getClientIp } from "../lib/request.js";

/**
 * Rate limit por IP aplicado a toda rota da API (montado em src/app.ts antes
 * das rotas). Vercel serverless é stateless entre invocações — por isso o
 * limitador guarda o contador no Upstash Redis (compartilhado via
 * `@azulito/shared`), não em memória do processo.
 *
 * Falha ABERTA (deixa passar) se o Upstash estiver fora do ar: uma
 * indisponibilidade do provedor de rate limit não pode derrubar a API
 * inteira. Um atacante não controla essa falha sob demanda (não é um jeito
 * confiável de burlar o limite), então o trade-off de disponibilidade vale
 * a pena aqui.
 */
export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);

  try {
    const result = await checkRateLimit(apiRateLimiter, `api:${ip}`);
    if (!result.success) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
    }
  } catch (error) {
    console.error("rate limit indisponível, deixando requisição passar:", error);
  }

  next();
}
