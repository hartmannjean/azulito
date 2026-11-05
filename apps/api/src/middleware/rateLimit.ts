import type { Request, Response, NextFunction } from "express";
import { env } from "cloudflare:workers";
import { getClientIp } from "../lib/request.js";

/**
 * Rate limit por IP aplicado a toda rota da API (montado em src/app.ts antes
 * das rotas). Usa o binding nativo de rate limiting dos Workers: o contador
 * fica na própria borda, sem ida à rede. O Upstash foi trocado por isso
 * porque, sem as credenciais configuradas, o cliente dele fazia retries por
 * ~4,4 s em TODA requisição antes de desistir.
 *
 * Chamadas do apps/web chegam por service binding, sem `cf-connecting-ip`,
 * e dividem um mesmo contador; requisições públicas sempre trazem o IP real
 * (a Cloudflare sobrescreve o header). Falha ABERTA se o binding faltar ou
 * der erro: indisponibilidade do limitador não pode derrubar a API.
 */
export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const limiter = env.RATE_LIMITER;
  const ip = getClientIp(req);
  if (limiter && ip) {
    try {
      const { success } = await limiter.limit({ key: `api:${ip}` });
      if (!success) {
        res.setHeader("Retry-After", "60");
        return res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
      }
    } catch (error) {
      console.error("rate limit indisponível, deixando requisição passar:", error);
    }
  }

  next();
}
