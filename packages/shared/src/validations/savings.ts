import { z } from "zod";

export const savingsMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês deve estar no formato AAAA-MM.");

/** Corpo de PUT /savings: saldo das caixinhas no fim de um mês. */
export const upsertSavingsSnapshotSchema = z.object({
  month: savingsMonthSchema,
  balance: z.number().min(0).max(1_000_000_000),
});
