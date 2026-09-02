import { z } from "zod";

/**
 * Query params aceitos por GET /transactions na apps/api. Compartilhado para
 * que o client em apps/web monte a query string de forma consistente com o
 * que o backend realmente valida.
 */
export const listTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().datetime().optional(),
  category: z.string().trim().max(60).optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
