import { Router } from "express";
import { pluggyWebhookSchema } from "@azulito/shared";
import { getItem, verifyWebhookAuth } from "../../lib/pluggyClient.js";
import { syncConnectionTransactions } from "../../lib/pluggySync.js";
import { createAdminClient } from "../../lib/supabaseAdmin.js";

export const pluggyWebhookRouter = Router();

/**
 * POST /pluggy/webhook — recebe notificações da Pluggy quando um Item
 * conectado tem dados novos. Rota PÚBLICA por natureza (montada em
 * src/app.ts SEM `requireAuth`) porque quem chama é a Pluggy, não um usuário
 * logado — a autenticidade é garantida pelo header `X-Webhook-Secret` abaixo,
 * que precisa ser configurado como `headers` na criação da assinatura do
 * webhook (POST /webhooks da Pluggy, campo API-only) com o mesmo valor de
 * PLUGGY_WEBHOOK_SECRET.
 */
pluggyWebhookRouter.post("/", async (req, res) => {
  const secretHeader = req.headers["x-webhook-secret"];
  const secretValue = typeof secretHeader === "string" ? secretHeader : null;

  const isValid = await verifyWebhookAuth(secretValue);
  if (!isValid) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  const parsed = pluggyWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido." });
  }

  const { event, itemId, clientUserId } = parsed.data;

  const admin = createAdminClient();

  // item/created: primeira vez que este Item aparece — ainda não existe
  // bank_connection pra ele, então criamos aqui em vez de procurar uma.
  if (event === "item/created") {
    if (!clientUserId) {
      return res.status(400).json({ error: "clientUserId ausente no payload." });
    }

    try {
      const item = await getItem(itemId);
      // Upsert por pluggy_item_id: a Pluggy re-tenta a entrega em qualquer
      // resposta não-2xx, então uma segunda entrega do mesmo item/created
      // não pode virar erro de unique constraint.
      const { error } = await admin.from("bank_connections").upsert(
        {
          user_id: clientUserId,
          pluggy_item_id: itemId,
          institution_name: item.connector.name,
          status: "connected",
        },
        { onConflict: "pluggy_item_id" },
      );
      if (error) throw error;
    } catch (err) {
      console.error("Falha ao processar webhook item/created:", err);
      return res.status(500).json({ error: "Falha ao processar webhook." });
    }

    return res.json({ received: true });
  }

  // Para os demais eventos só nos importa buscar dados novos de uma conexão
  // que já existe.
  if (event !== "item/updated" && event !== "transactions/created") {
    return res.json({ received: true });
  }

  const { data: connection, error: connectionError } = await admin
    .from("bank_connections")
    .select("id, user_id, pluggy_item_id")
    .eq("pluggy_item_id", itemId)
    .maybeSingle();

  if (connectionError || !connection) {
    // Item desconhecido por aqui: não é um erro nosso, só não há o que
    // sincronizar (ex: webhook de teste, ou conexão já removida).
    return res.json({ received: true });
  }

  try {
    await syncConnectionTransactions(admin, connection);
  } catch (err) {
    // Resposta genérica: não expor detalhes internos, mas sinalizar falha
    // para a Pluggy poder re-tentar a entrega do webhook.
    console.error("Falha ao sincronizar transações do webhook:", err);
    return res.status(500).json({ error: "Falha ao processar webhook." });
  }

  res.json({ received: true });
});
