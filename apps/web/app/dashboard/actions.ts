"use server";

import { requestPluggyConnectToken } from "@/lib/api-client";
import { getAccess } from "@/lib/access";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Chamada pelo `ConnectBankButton` (Client Component). Roda no servidor da
 * apps/web: lê o JWT do Cloudflare Access do request (verificado em
 * `getAccess`) e só então chama a apps/api — o JWT nunca trafega até o
 * browser por conta desta ação.
 */
export async function requestConnectToken(): Promise<{ accessToken?: string; error?: string }> {
  const dict = getDictionary(await getLocale());

  const access = await getAccess();
  if (!access) {
    return { error: dict.auth.errors.notAuthenticated };
  }

  try {
    const accessToken = await requestPluggyConnectToken(access.jwt);
    return { accessToken };
  } catch {
    return { error: dict.auth.errors.connectFailed };
  }
}
