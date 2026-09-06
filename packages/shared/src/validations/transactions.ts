import { z } from "zod";

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês deve estar no formato AAAA-MM.");

/**
 * Query params aceitos por GET /transactions na apps/api. Compartilhado para
 * que o client em apps/web monte a query string de forma consistente com o
 * que o backend realmente valida.
 */
export const listTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().datetime().optional(),
  category: z.string().trim().max(60).optional(),
  month: monthSchema.optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

/** Query params de GET /transactions/summary e /transactions/categories. */
export const monthSummaryQuerySchema = z.object({
  month: monthSchema,
});

export type MonthSummaryQuery = z.infer<typeof monthSummaryQuerySchema>;

/** Query params de GET /transactions/trend. */
export const trendQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(12).default(6),
});

export type TrendQuery = z.infer<typeof trendQuerySchema>;
