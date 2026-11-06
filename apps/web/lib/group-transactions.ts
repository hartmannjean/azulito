import type { Transaction } from "@azulito/shared";

export type TransactionGroup = {
  /** Categoria da transação; `null` agrupa o que não tem categoria. */
  category: string | null;
  items: Transaction[];
  /** Soma das saídas e das entradas que contam (o que está fora das somas não entra). */
  spend: number;
  income: number;
  /** Soma de tudo, inclusive o que está fora das somas (para o grupo só de itens excluídos). */
  all: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Agrupa por categoria, na ordem do maior gasto para o menor; "sem categoria"
 * vai sempre por último. Itens fora das somas aparecem dentro do grupo mas não
 * entram nos totais, como no resto do app.
 */
export function groupByCategory(transactions: Transaction[]): TransactionGroup[] {
  const groups = new Map<string | null, TransactionGroup>();
  for (const tx of transactions) {
    const key = tx.category ?? null;
    let group = groups.get(key);
    if (!group) {
      group = { category: key, items: [], spend: 0, income: 0, all: 0 };
      groups.set(key, group);
    }
    group.items.push(tx);
    group.all += tx.amount;
    if (tx.excluded) continue;
    if (tx.amount < 0) group.spend -= tx.amount;
    else group.income += tx.amount;
  }

  const list = [...groups.values()].map((group) => ({
    ...group,
    spend: round2(group.spend),
    income: round2(group.income),
    all: round2(group.all),
  }));
  return list.sort((a, b) => {
    if ((a.category === null) !== (b.category === null)) return a.category === null ? 1 : -1;
    return b.spend - a.spend || b.income - a.income;
  });
}
