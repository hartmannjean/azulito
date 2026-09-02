import type { NextRequest } from "next/server";

/**
 * Extrai o IP do cliente a partir dos headers que a Vercel injeta
 * (`x-forwarded-for`). Nunca confiar em `request.ip` sozinho pois nem todo
 * ambiente o popula; e nunca usar isso para nada além de rate limiting —
 * headers de IP podem ser forjados por quem não passa por um proxy confiável.
 */
export function getClientIp(request: NextRequest): string {
  return extractIp(request.headers);
}

/**
 * Mesma extração de IP, mas a partir do objeto `Headers` retornado por
 * `headers()` de "next/headers" — necessário em Server Actions, que não têm
 * acesso a um `NextRequest`.
 */
export function getClientIpFromHeaders(headersList: Headers): string {
  return extractIp(headersList);
}

function extractIp(headersList: Headers): string {
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return headersList.get("x-real-ip") ?? "unknown";
}
