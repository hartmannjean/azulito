export function formatCurrency(amount: number, currencyCode = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

export function formatDate(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(dateIso));
}

/** Mês atual no formato AAAA-MM, no fuso do servidor. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** AAAA-MM -> "setembro de 2026". Usa meio-dia UTC pra não cair no dia anterior por fuso. */
export function formatMonthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, mon! - 1, 12));
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Desloca um mês AAAA-MM por `delta` meses (negativo = anterior). */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, mon! - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** AAAA-MM -> "set" (abreviação de 3 letras, pra rótulo de eixo de gráfico). */
export function formatMonthShort(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, mon! - 1, 1));
  return new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
}

/**
 * Variação percentual de `current` em relação a `previous`. `null` quando o
 * mês anterior era zero e o atual não é (variação "infinita" não tem
 * percentual útil pra mostrar — vira rótulo "novo" na UI).
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
