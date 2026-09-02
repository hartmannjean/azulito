import type { Request } from "express";

/**
 * Nunca confiar cegamente em headers de IP — só são confiáveis porque
 * `app.set("trust proxy", 1)` (ver src/app.ts) diz ao Express pra usar o
 * primeiro proxy à frente (a borda da Vercel) como fonte de verdade. Sem
 * isso, `x-forwarded-for` poderia ser forjado por qualquer cliente.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return req.ip ?? "unknown";
}
