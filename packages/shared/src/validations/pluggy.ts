import { z } from "zod";

// Formato confirmado contra a documentação oficial da Pluggy
// (https://docs.pluggy.ai/docs/webhooks). `clientUserId` só vem preenchido
// em eventos disparados por uma conexão nova (ex: item/created) — é o
// `user.id` do Supabase que passamos em `createConnectToken`.
export const pluggyWebhookSchema = z.object({
  event: z.string(),
  itemId: z.string(),
  clientUserId: z.string().optional(),
});

export type PluggyWebhookPayload = z.infer<typeof pluggyWebhookSchema>;
