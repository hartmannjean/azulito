import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiRateLimiter, checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request";
import { handleCorsPreflight, withCors } from "@/lib/cors";
import { createConnectToken } from "@/lib/pluggy/client";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

/**
 * POST /api/pluggy/connect-token — gera o token de uso único que o Pluggy
 * Connect Widget (rodando no client) precisa para abrir o fluxo de conexão
 * do Nubank. Protegido pelo middleware central de auth: só um usuário
 * logado pode pedir um token, e o token é sempre atrelado ao `user.id` dele.
 *
 * TODO(pluggy): este handler já está pronto para uso; o que falta é
 * `lib/pluggy/client.ts` ter credenciais reais configuradas
 * (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET) e a lógica de `createConnectToken`
 * confirmada contra a documentação oficial da Pluggy.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(apiRateLimiter, `pluggy-connect-token:${ip}`);
  if (!rateLimit.success) {
    return withCors(
      request,
      NextResponse.json({ error: "Muitas requisições." }, { status: 429 }),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withCors(request, NextResponse.json({ error: "Não autenticado." }, { status: 401 }));
  }

  try {
    const accessToken = await createConnectToken(user.id);
    return withCors(request, NextResponse.json({ accessToken }));
  } catch {
    return withCors(
      request,
      NextResponse.json({ error: "Falha ao iniciar conexão com a Pluggy." }, { status: 502 }),
    );
  }
}
