import { addMonths } from "./savings.js";
import type { CardComparison } from "./types.js";

export type CardRow = {
  /** Data da COMPRA (AAAA-MM-DD), não o mês da fatura. */
  date: string;
  amount: number;
  description: string;
  category: string | null;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const daysInMonth = (month: string) => {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
};
const pad = (value: number) => String(value).padStart(2, "0");

const INSTALLMENT = /parcela\s+(\d+)\/(\d+)/i;
/**
 * Parcela de uma compra de meses anteriores (2/10, 3/3...): o banco a lança com
 * a data do início do ciclo, mas a compra foi feita antes. Não é compra nova.
 */
export function isOldInstallment(description: string): boolean {
  const match = INSTALLMENT.exec(description);
  return match !== null && Number(match[1]) > 1;
}

type Bucket = { purchases: number; count: number; installments: number; refunds: number };
const emptyBucket = (): Bucket => ({ purchases: 0, count: 0, installments: 0, refunds: 0 });

/**
 * Compras no cartão deste mês até hoje contra as do mês passado até o MESMO
 * dia. Função pura (sem banco). Conta pela data da compra e só compras novas:
 * parcelas de compras antigas e estornos ficam à parte.
 *
 * Se o último dado importado do cartão é anterior a hoje, compara até essa
 * data (senão o mês atual pareceria "gastar menos" só porque falta importar).
 */
export function buildCardComparison(input: {
  /** Hoje, AAAA-MM-DD. */
  today: string;
  /** Data da transação mais recente do cartão (qualquer mês), se houver. */
  dataUntil: string | null;
  rows: CardRow[];
}): CardComparison {
  const current = input.today.slice(0, 7);
  const previous = addMonths(current, -1);
  const currentStart = `${current}-01`;

  const hasCurrentData = input.dataUntil !== null && input.dataUntil >= currentStart;
  const cutoffDate = hasCurrentData && input.dataUntil! < input.today ? input.dataUntil! : input.today;
  const cutoffDay = Number(cutoffDate.slice(8, 10));
  const previousCutoffDay = Math.min(cutoffDay, daysInMonth(previous));
  const previousCutoff = `${previous}-${pad(previousCutoffDay)}`;

  const cur = emptyBucket();
  const prev = emptyBucket();
  let previousFull = 0;
  const byCategory = new Map<string, { current: number; previous: number }>();
  const curDaily = new Array<number>(cutoffDay).fill(0);
  const prevDaily = new Array<number>(daysInMonth(previous)).fill(0);

  for (const row of input.rows) {
    const month = row.date.slice(0, 7);
    const day = Number(row.date.slice(8, 10));
    const inCurrent = month === current && row.date <= cutoffDate;
    const inPrevious = month === previous;
    if (!inCurrent && !inPrevious) continue;
    const inPreviousSameDay = inPrevious && row.date <= previousCutoff;
    const bucket = inCurrent ? cur : inPreviousSameDay ? prev : null;

    if (row.amount > 0) {
      if (bucket) bucket.refunds += row.amount;
      continue;
    }
    const value = -row.amount;
    if (isOldInstallment(row.description)) {
      if (bucket) bucket.installments += value;
      continue;
    }

    if (inPrevious) previousFull += value;
    if (bucket) {
      bucket.purchases += value;
      bucket.count += 1;
      const key = row.category ?? "Other";
      const entry = byCategory.get(key) ?? { current: 0, previous: 0 };
      if (inCurrent) entry.current += value;
      else entry.previous += value;
      byCategory.set(key, entry);
    }
    if (inCurrent) curDaily[day - 1]! += value;
    else prevDaily[day - 1]! += value;
  }

  const cumulative = (values: number[]) => {
    let total = 0;
    return values.map((v) => round2((total += v)));
  };
  const finish = (b: Bucket) => ({
    purchases: round2(b.purchases),
    count: b.count,
    installments: round2(b.installments),
    refunds: round2(b.refunds),
  });

  const delta = round2(cur.purchases - prev.purchases);
  return {
    current_month: current,
    previous_month: previous,
    cutoff_day: cutoffDay,
    cutoff_date: cutoffDate,
    data_until: input.dataUntil,
    stale: input.dataUntil === null || input.dataUntil < input.today,
    no_data_this_month: !hasCurrentData,
    current: finish(cur),
    previous: finish(prev),
    previous_full: round2(previousFull),
    delta: {
      amount: delta,
      percent: prev.purchases > 0 ? Math.round((delta / prev.purchases) * 1000) / 10 : null,
    },
    categories: [...byCategory.entries()]
      .map(([category, v]) => ({
        category,
        current: round2(v.current),
        previous: round2(v.previous),
        delta: round2(v.current - v.previous),
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6),
    daily: { current: cumulative(curDaily), previous: cumulative(prevDaily) },
  };
}
