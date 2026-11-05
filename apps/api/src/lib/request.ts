import type { Request } from "express";

/**
 * IP real do cliente, ou null quando não há como saber. Nunca confiar
 * cegamente em headers de IP:
 * - `cf-connecting-ip`: a Cloudflare sempre o define com o IP que observou na
 *   conexão, sobrescrevendo o que o cliente tentar forjar;
 * - `x-azulito-client-ip`: o web repassa o IP real nos endpoints de login.
 *   Só é confiável porque a api não tem domínio público (só service binding).
 *
 * Sem nenhum dos dois (chamadas de dados vindas do web), devolve null em vez
 * de um valor compartilhado: um contador único por "IP desconhecido" faria um
 * usuário pesado derrubar todos os outros. Essas chamadas são limitadas por
 * usuário, depois da autenticação (ver middleware/auth.ts). `x-forwarded-for`
 * não é usado de propósito: é falsificável.
 */
export function getClientIp(req: Request): string | null {
  for (const name of ["cf-connecting-ip", "x-azulito-client-ip"]) {
    const value = req.headers[name];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}
