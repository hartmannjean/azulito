import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/pluggy/client";
import { syncConnectionTransactions } from "@/lib/pluggy/sync";
import { pluggyWebhookSchema } from "@/lib/validations/pluggy";
import { apiRateLimiter, checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request";

/**
 * POST /api/pluggy/webhook — recebe notificações da Pluggy quando um Item
 * conectado tem dados novos. Rota PÚBLICA por natureza (fica fora do
 * middleware de auth em `lib/supabase/middleware.ts`) porque quem chama é a
 * Pluggy, não um usuário logado — a autenticidade da requisição é garantida
 * pela verificação de assinatura HMAC abaixo, não por sessão.
 *
 * TODO(pluggy): confirmar o nome do header de assinatura e o formato exato
 * do payload contra a documentação oficial antes de habilitar em produção.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(apiRateLimiter, `pluggy-webhook:${ip}`);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-pluggy-signature");

  const isValid = await verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const parsed = pluggyWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { event, itemId } = parsed.data;

  // Só nos importa eventos que indicam dados novos disponíveis para buscar.
  if (event !== "item/updated" && event !== "transactions/created") {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();

  const { data: connection, error: connectionError } = await admin
    .from("bank_connections")
    .select("id, user_id, pluggy_item_id")
    .eq("pluggy_item_id", itemId)
    .maybeSingle();

  if (connectionError || !connection) {
    // Item desconhecido por aqui: não é um erro nosso, só não há o que
    // sincronizar (ex: webhook de teste, ou conexão já removida).
    return NextResponse.json({ received: true });
  }

  try {
    await syncConnectionTransactions(admin, connection);
  } catch {
    // Resposta genérica: não expor detalhes internos, mas sinalizar falha
    // para a Pluggy poder re-tentar a entrega do webhook.
    return NextResponse.json({ error: "Falha ao processar webhook." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
