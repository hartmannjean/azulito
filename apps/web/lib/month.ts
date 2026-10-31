import "server-only";
import { fetchTransactionsTrend } from "@/lib/api-client";
import { currentMonth } from "@/lib/format";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Mês exibido: o `?month=` da URL quando válido; senão o mês mais recente
 * COM movimentação (quem importa extratos antigos não vê um mês zerado ao
 * abrir); senão o mês corrente.
 */
export async function resolveMonth(accessJwt: string, param: string | undefined): Promise<string> {
  if (param && MONTH_PATTERN.test(param)) return param;
  try {
    const { trend } = await fetchTransactionsTrend(accessJwt, 6);
    const latest = [...trend].reverse().find((point) => point.income + point.expenses > 0);
    return latest?.month ?? currentMonth();
  } catch {
    return currentMonth();
  }
}
