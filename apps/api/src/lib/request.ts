import type { Request } from "express";

/**
 * Nunca confiar cegamente em headers de IP. Quando o tráfego passa pela
 * Cloudflare (na frente da Vercel), `cf-connecting-ip` é a fonte mais
 * confiável: a Cloudflare sempre a define com o IP que ela mesma observou na
 * conexão, sobrescrevendo qualquer valor que o cliente tenha tentado forjar
 * — diferente de `x-forwarded-for`, cujo comportamento de acúmulo entre
 * proxies (Cloudflare -> Vercel) não é algo que valha a pena depender.
 *
 * Sem Cloudflare na frente (acesso direto ao domínio da Vercel), caímos pro
 * `x-forwarded-for`, confiável aqui porque `app.set("trust proxy", 1)` (ver
 * src/app.ts) diz ao Express pra tratar a borda da Vercel como o único
 * proxy confiável.
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
