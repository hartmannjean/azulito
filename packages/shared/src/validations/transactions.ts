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
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  /** "__none__" = sem categoria. */
  category: z.string().trim().max(60).optional(),
  month: monthSchema.optional(),
  q: z.string().trim().max(80).optional(),
  account_id: z.string().trim().max(64).optional(),
  type: z.enum(["income", "expense"]).optional(),
  sort: z.enum(["date", "amount"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
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

/** Corpo de PATCH /transactions/:id. */
export const updateCategorySchema = z.object({
  category: z.string().trim().max(60),
});

/** Corpo de PUT /budgets. */
export const upsertBudgetSchema = z.object({
  category: z.string().trim().max(60),
  monthly_limit: z.number().positive().max(10_000_000),
});
