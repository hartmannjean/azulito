import type { NextRequest } from "next/server";

/**
 * Extrai o IP do cliente a partir dos headers que a Vercel injeta
 * (`x-forwarded-for`). Nunca confiar em `request.ip` sozinho pois nem todo
 * ambiente o popula; e nunca usar isso para nada além de rate limiting —
 * headers de IP podem ser forjados por quem não passa por um proxy confiável.
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
