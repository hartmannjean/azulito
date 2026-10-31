import { createRemoteJWKSet, jwtVerify } from "jose";

/** Header que o Cloudflare Access injeta em toda requisição autenticada. */
export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

export type AccessIdentity = {
  userId: string;
  email: string | null;
};

const jwksByTeam = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  let jwks = jwksByTeam.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksByTeam.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Valida o JWT do Cloudflare Access: assinatura (JWKS do time), emissor e
 * audiência (AUD da aplicação Access). Sem checar `aud`, um JWT de OUTRA
 * aplicação Access do mesmo time seria aceito. Qualquer falha (token
 * inválido, expirado, config ausente, rede) devolve null — auth falha
 * FECHADA, sem diferenciar a causa para quem chamou.
 */
export async function verifyAccessJwt(
  token: string | null | undefined,
  teamDomain: string | undefined,
  audience: string | undefined,
): Promise<AccessIdentity | null> {
  if (!token || !teamDomain || !audience) return null;

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience,
    });
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch (error) {
    console.error("falha ao validar JWT do Cloudflare Access:", error);
    return null;
  }
}
