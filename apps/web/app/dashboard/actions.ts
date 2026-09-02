"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestPluggyConnectToken } from "@/lib/api-client";

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
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    const accessToken = await requestPluggyConnectToken(session.access_token);
    return { accessToken };
  } catch {
    return { error: "Falha ao iniciar conexão com a Pluggy." };
  }
}
