"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestPluggyConnectToken } from "@/lib/api-client";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Chamada pelo `ConnectBankButton` (Client Component). Roda no servidor da
 * apps/web: lê o access token da sessão (cookie httpOnly, inacessível ao
 * client-side JS) e só então chama a apps/api — o token nunca precisa
 * trafegar até o browser para esta ação funcionar.
 */
export async function requestConnectToken(): Promise<{ accessToken?: string; error?: string }> {
  const dict = getDictionary(await getLocale());

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: dict.auth.errors.notAuthenticated };
  }

  try {
    const accessToken = await requestPluggyConnectToken(session.access_token);
    return { accessToken };
  } catch {
    return { error: dict.auth.errors.connectFailed };
  }
}
