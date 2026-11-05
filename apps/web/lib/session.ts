import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { apiRequest } from "@/lib/api-client";

export type Session = { userId: string; email: string | null; cookie: string };

/**
 * Só os cookies de sessão do Azulito seguem para a apps/api (nunca os demais
 * cookies do navegador, como tema e idioma).
 */
const AUTH_COOKIE = /^(__Secure-)?azulito\./;

export function pickAuthCookies(rawCookieHeader: string | null): string {
  if (!rawCookieHeader) return "";
  return rawCookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => AUTH_COOKIE.test(part))
    .join("; ");
}

/**
 * Sessão do usuário logado. A validação acontece SÓ na apps/api (única fonte
 * de verdade): o web não decodifica nem confia no cookie sozinho — pergunta à
 * api quem é o dono dele. Devolve null se não houver sessão válida. O mesmo
 * cookie é repassado em cada chamada de dados, e a api valida de novo.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const cookie = pickAuthCookies((await headers()).get("cookie"));
  if (!cookie) return null;

  try {
    const response = await apiRequest("/me", { headers: { cookie }, cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { id?: unknown; email?: unknown };
    if (typeof body.id !== "string" || body.id.length === 0) return null;
    return { userId: body.id, email: typeof body.email === "string" ? body.email : null, cookie };
  } catch (error) {
    console.error("Falha ao validar a sessão:", error);
    return null;
  }
});

/** Como `getSession`, mas interrompe a renderização se não houver sessão válida. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado.");
  return session;
}
