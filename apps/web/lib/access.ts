import "server-only";
import { headers } from "next/headers";
import { ACCESS_JWT_HEADER, verifyAccessJwt, type AccessIdentity } from "@azulito/shared";

export type VerifiedAccess = AccessIdentity & { jwt: string };

/**
 * Identidade do usuário logado, vinda do JWT do Cloudflare Access (que
 * protege este app na borda). O JWT é VERIFICADO aqui (assinatura, emissor,
 * audiência) em vez de só confiar no header: um acesso que contorne o Access
 * (ex: URL workers.dev esquecida ligada) não consegue forjar a identidade.
 * Devolve null se não houver identidade válida. O mesmo JWT é repassado à
 * apps/api, que o verifica de novo.
 */
export async function getAccess(): Promise<VerifiedAccess | null> {
  const jwt = (await headers()).get(ACCESS_JWT_HEADER);
  const identity = await verifyAccessJwt(
    jwt,
    process.env.CF_ACCESS_TEAM_DOMAIN,
    process.env.CF_ACCESS_AUD,
  );
  return identity && jwt ? { ...identity, jwt } : null;
}

/** Como `getAccess`, mas interrompe a renderização se não houver identidade válida. */
export async function requireAccess(): Promise<VerifiedAccess> {
  const access = await getAccess();
  if (!access) throw new Error("Não autenticado.");
  return access;
}
