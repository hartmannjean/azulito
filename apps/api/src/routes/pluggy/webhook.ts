import { Router } from "express";
import { pluggyWebhookSchema } from "@azulito/shared";
import { verifyWebhookSignature } from "../../lib/pluggyClient.js";
import { syncConnectionTransactions } from "../../lib/pluggySync.js";
import { createAdminClient } from "../../lib/supabaseAdmin.js";

export const pluggyWebhookRouter = Router();

/**
 * POST /pluggy/webhook — recebe notificações da Pluggy quando um Item
 * conectado tem dados novos. Rota PÚBLICA por natureza (montada em
 * src/app.ts SEM `requireAuth`) porque quem chama é a Pluggy, não um usuário
 * logado — a autenticidade é garantida pela verificação de assinatura HMAC
 * abaixo, usando o corpo cru capturado em `req.rawBody` (ver src/app.ts).
 *
 * TODO(pluggy): confirmar o nome do header de assinatura e o formato exato
 * do payload contra a documentação oficial antes de habilitar em produção.
 */
pluggyWebhookRouter.post("/", async (req, res) => {
  const signature = req.headers["x-pluggy-signature"];
  const signatureHeader = typeof signature === "string" ? signature : null;

  if (!req.rawBody) {
    return res.status(400).json({ error: "Corpo da requisição ausente." });
  }

  const isValid = await verifyWebhookSignature(req.rawBody, signatureHeader);
  if (!isValid) {
    return res.status(401).json({ error: "Assinatura inválida." });
  }

  const parsed = pluggyWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido." });
  }

  const { event, itemId } = parsed.data;

  // Só nos importa eventos que indicam dados novos disponíveis para buscar.
  if (event !== "item/updated" && event !== "transactions/created") {
    return res.json({ received: true });
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
    return res.json({ received: true });
  }

  try {
    await syncConnectionTransactions(admin, connection);
  } catch {
    // Resposta genérica: não expor detalhes internos, mas sinalizar falha
    // para a Pluggy poder re-tentar a entrega do webhook.
    return res.status(500).json({ error: "Falha ao processar webhook." });
  }

  res.json({ received: true });
});
