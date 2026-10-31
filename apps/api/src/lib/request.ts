import type { Request } from "express";

/**
 * Nunca confiar cegamente em headers de IP. Rodando em Workers, a Cloudflare
 * sempre define `cf-connecting-ip` com o IP que ela mesma observou na
 * conexão, sobrescrevendo qualquer valor que o cliente tente forjar — por
 * isso é a fonte preferida. `x-forwarded-for` fica só como fallback
 * (ex: desenvolvimento local).
 */
export function getClientIp(req: Request): string {
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  if (typeof cfConnectingIp === "string" && cfConnectingIp.length > 0) {
    return cfConnectingIp;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return req.ip ?? "unknown";
}
