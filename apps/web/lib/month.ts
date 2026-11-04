import "server-only";
import { fetchTransactionsTrend } from "@/lib/api-client";
import { currentMonth } from "@/lib/format";
import type { TransactionsTrend } from "@azulito/shared";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Mês exibido: o `?month=` da URL quando válido; senão o mês mais recente
 * COM movimentação (quem importa extratos antigos não vê um mês zerado ao
 * abrir); senão o mês corrente. Devolve também a tendência quando ela foi
 * buscada para decidir o mês, para o chamador não pedi-la de novo.
 */
export async function resolveMonthWithTrend(
  accessJwt: string,
  param: string | undefined,
): Promise<{ month: string; trend: TransactionsTrend | null }> {
  if (param && MONTH_PATTERN.test(param)) return { month: param, trend: null };
  try {
    const trend = await fetchTransactionsTrend(accessJwt, 6);
    const latest = [...trend.trend].reverse().find((point) => point.income + point.expenses > 0);
    return { month: latest?.month ?? currentMonth(), trend };
  } catch {
    return { month: currentMonth(), trend: null };
  }
}

export async function resolveMonth(accessJwt: string, param: string | undefined): Promise<string> {
  return (await resolveMonthWithTrend(accessJwt, param)).month;
}
