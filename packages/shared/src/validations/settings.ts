import { z } from "zod";

const day = z.number().int().min(1).max(31);

/**
 * Preferências financeiras do usuário (perguntadas no primeiro acesso e
 * editáveis na conta). Tudo é opcional: `null` = não informado.
 * - salário: valor líquido mensal e dia em que cai; entra na previsão dos
 *   próximos meses sem precisar cadastrar a receita mês a mês;
 * - cartão: dia de fechamento e de vencimento da fatura, usados como padrão
 *   para cartões importados daqui em diante (os dois juntos ou nenhum).
 */
export const upsertSettingsSchema = z
  .object({
    salary_amount: z.number().min(0).max(10_000_000).nullable(),
    salary_day: day.nullable(),
    card_closing_day: day.nullable(),
    card_due_day: day.nullable(),
  })
  .strict()
  .refine((v) => v.salary_amount === null || v.salary_amount === 0 || v.salary_day !== null, {
    message: "Informe o dia em que o salário cai.",
    path: ["salary_day"],
  })
  .refine((v) => (v.card_closing_day === null) === (v.card_due_day === null), {
    message: "Informe o fechamento e o vencimento do cartão, ou nenhum dos dois.",
    path: ["card_due_day"],
  });

export type UpsertSettingsInput = z.infer<typeof upsertSettingsSchema>;
