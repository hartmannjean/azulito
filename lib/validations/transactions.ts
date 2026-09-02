import { z } from "zod";

/**
 * Query params aceitos por GET /api/transactions. Tudo que chega da query
 * string é string — coercion + limites explícitos evitam que alguém passe
 * um `limit` gigante (custo de banco) ou um `category` arbitrariamente longo.
 */
export const listTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().datetime().optional(),
  category: z.string().trim().max(60).optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
