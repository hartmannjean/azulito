import { z } from "zod";

const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD.")
  .refine((value) => new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, "Data inválida.");

/** Corpo de POST /scheduled: um boleto a pagar ou uma entrada prevista. */
export const createScheduledSchema = z.object({
  kind: z.enum(["expense", "income"]),
  description: z.string().trim().min(1).max(80),
  amount: z.number().positive().max(10_000_000),
  due_date: dueDateSchema,
  category: z.string().trim().max(60).nullable().optional(),
});

/** Corpo de PATCH /scheduled/:id. */
export const updateScheduledSchema = z.object({ paid: z.boolean() });
