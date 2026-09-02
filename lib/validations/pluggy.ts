import { z } from "zod";

/**
 * TODO(pluggy): confirmar o formato exato do payload de webhook contra a
 * documentação oficial da Pluggy antes de ir para produção. Esta é uma
 * estrutura mínima plausível (evento + id do Item afetado).
 */
export const pluggyWebhookSchema = z.object({
  event: z.string(),
  itemId: z.string(),
});

export type PluggyWebhookPayload = z.infer<typeof pluggyWebhookSchema>;
