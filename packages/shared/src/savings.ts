import type { SavingsForecastPoint, SavingsMonth, SavingsOverview } from "./types.js";

export function addMonths(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const FORECAST_MONTHS = 3;
const HISTORY_WINDOW = 3;
// Teto/piso do rendimento mensal usado na projeção: um mês atípico (saldo
// informado errado, aporte grande no fim do mês) não pode virar tendência.
const MAX_MONTHLY_RATE = 0.05;
const MIN_MONTHLY_RATE = -0.02;

export type SavingsFlow = { month: string; amount: number };

/**
 * Monta a visão mês a mês das caixinhas e a projeção. Função pura (sem banco)
 * para ser testada. `flows` são os movimentos de aplicação (amount < 0, saiu
 * da conta) e resgate (amount > 0) da conta corrente; `snapshots` são os
 * saldos de fim de mês informados pelo usuário; `current` é o mês corrente.
 *
 * Rendimento do mês = saldo final - saldo inicial - (aplicado - resgatado),
 * só calculável quando o saldo do mês e o do mês anterior foram informados.
 * A projeção é uma fórmula simples e transparente: saldo * (1 + rendimento
 * médio) + média mensal guardada, sobre os últimos meses completos.
 */
export function buildSavingsOverview(
  flows: SavingsFlow[],
  snapshots: Record<string, number>,
  current: string,
): Omit<SavingsOverview, "insight"> {
  const byMonth = new Map<string, { applied: number; withdrawn: number }>();
  for (const flow of flows) {
    const entry = byMonth.get(flow.month) ?? { applied: 0, withdrawn: 0 };
    if (flow.amount < 0) entry.applied -= flow.amount;
    else entry.withdrawn += flow.amount;
    byMonth.set(flow.month, entry);
  }

  const keys = [...byMonth.keys(), ...Object.keys(snapshots), current].sort();
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;

  const months: SavingsMonth[] = [];
  for (let month = first; month <= last; month = addMonths(month, 1)) {
    const entry = byMonth.get(month) ?? { applied: 0, withdrawn: 0 };
    const net = entry.applied - entry.withdrawn;
    const closing = snapshots[month] ?? null;
    const opening = snapshots[addMonths(month, -1)] ?? null;
    const gained = opening !== null && closing !== null ? closing - opening - net : null;
    months.push({
      month,
      applied: round2(entry.applied),
      withdrawn: round2(entry.withdrawn),
      net: round2(net),
      opening,
      closing,
      yield: gained === null ? null : round2(gained),
      yield_pct:
        gained !== null && opening !== null && opening > 0
          ? Math.round((gained / opening) * 10000) / 10000
          : null,
    });
  }

  const totalYield = round2(months.reduce((sum, m) => sum + (m.yield ?? 0), 0));
  const withBalance = months.filter((m) => m.closing !== null);
  const lastKnown = withBalance[withBalance.length - 1];
  if (!lastKnown) {
    return {
      months,
      current_balance: null,
      current_balance_estimated: false,
      total_yield: totalYield,
      forecast: [],
      assumptions: null,
    };
  }

  // Média guardada por mês: só meses COMPLETOS (o corrente ainda está em curso).
  const completed = months
    .filter((m) => m.month < current && (m.applied > 0 || m.withdrawn > 0))
    .slice(-HISTORY_WINDOW);
  const avgNet = completed.length > 0 ? mean(completed.map((m) => m.net)) : 0;
  const rates = months
    .filter((m) => m.yield_pct !== null)
    .slice(-HISTORY_WINDOW)
    .map((m) => m.yield_pct as number);
  const avgRate = clamp(rates.length > 0 ? mean(rates) : 0, MIN_MONTHLY_RATE, MAX_MONTHLY_RATE);

  // Saldo até hoje: o último informado, avançado pelos meses seguintes já com movimento.
  let balance = lastKnown.closing as number;
  let estimated = false;
  for (let month = addMonths(lastKnown.month, 1); month <= current; month = addMonths(month, 1)) {
    const row = months.find((m) => m.month === month);
    balance = balance * (1 + avgRate) + (row?.net ?? 0);
    estimated = true;
  }
  const currentBalance = round2(balance);

  const forecast: SavingsForecastPoint[] = [];
  for (let i = 1; i <= FORECAST_MONTHS; i++) {
    const gain = balance * avgRate;
    balance = balance + gain + avgNet;
    forecast.push({
      month: addMonths(current, i),
      net: round2(avgNet),
      yield: round2(gain),
      balance: round2(balance),
    });
  }

  return {
    months,
    current_balance: currentBalance,
    current_balance_estimated: estimated,
    total_yield: totalYield,
    forecast,
    assumptions: { avg_net: round2(avgNet), avg_rate: Math.round(avgRate * 10000) / 10000 },
  };
}
