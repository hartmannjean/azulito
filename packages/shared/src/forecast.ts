import { addMonths } from "./savings.js";
import type { ForecastMonth, ScheduledItem } from "./types.js";

export type SpendByKind = {
  month: string;
  kind: "checking" | "credit_card";
  spent: number;
  income: number;
};

export type ScheduledRow = {
  id: string;
  kind: "expense" | "income";
  description: string;
  amount: number;
  due_date: string;
  category: string | null;
  paid: boolean;
};

export type TxPoint = { date: string; amount: number };

export type RecurringPoint = {
  amount: number;
  charged_this_month: boolean;
  account_kind: "checking" | "credit_card";
};

export type CardCycle = { closing_day: number; due_day: number };

export type ForecastInput = {
  /** Hoje, AAAA-MM-DD. */
  today: string;
  months?: number;
  /** Gasto e receita por mês efetivo e tipo de conta (sem o que está fora das somas). */
  spend: SpendByKind[];
  scheduled: ScheduledRow[];
  /** Transações recentes, para reconhecer boletos já pagos. */
  transactions: TxPoint[];
  recurringExpenses: RecurringPoint[];
  recurringIncomes: RecurringPoint[];
  cards: CardCycle[];
};

const HISTORY_MONTHS = 3;
const MATCH_DAYS_BEFORE = 7;
const MATCH_DAYS_AFTER = 10;
const RECURRING_OVERLAP = 0.05;

const round2 = (value: number) => Math.round(value * 100) / 100;
const pad = (value: number) => String(value).padStart(2, "0");
const days = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/**
 * Previsão de receitas e despesas dos próximos meses. Função pura (sem banco).
 *
 * Despesas — duas leituras:
 * - comprometido: o que já é certo (lançado + boletos cadastrados + recorrentes
 *   da conta corrente que ainda não foram cobradas);
 * - projetado: o maior entre o comprometido e a média dos últimos meses, e a
 *   fatura do cartão ainda aberta também usa a média (ela ainda vai crescer).
 *
 * Receitas: só o que já tem base (recebido + cadastrado + recorrente que ainda
 * não caiu). A média histórica vai ao lado como referência, sem entrar na conta:
 * não se conta com entrada que ninguém prometeu.
 *
 * Um boleto cadastrado vira "reconhecido" quando há uma transação importada com
 * o mesmo valor perto do vencimento, e deixa de contar como pendente (o
 * pagamento já está no realizado — contar de novo duplicaria).
 */
export function buildForecast(input: ForecastInput): { months: ForecastMonth[]; items: ScheduledItem[] } {
  const current = input.today.slice(0, 7);
  const horizon = input.months ?? 3;

  // Médias dos últimos meses completos que têm dados.
  const history = [-3, -2, -1].map((delta) => addMonths(current, delta)).slice(-HISTORY_MONTHS);
  const withData = history.filter((m) => input.spend.some((r) => r.month === m && (r.spent > 0 || r.income > 0)));
  const divisor = Math.max(1, withData.length);
  const avg = (pick: (r: SpendByKind) => number, kind?: SpendByKind["kind"]) =>
    input.spend
      .filter((r) => withData.includes(r.month) && (kind === undefined || r.kind === kind))
      .reduce((sum, r) => sum + pick(r), 0) / divisor;
  const avgChecking = avg((r) => r.spent, "checking");
  const avgCard = avg((r) => r.spent, "credit_card");
  const avgIncome = avg((r) => r.income);

  // Reconhece boletos já pagos: cada transação casa com no máximo um item.
  const used = new Set<number>();
  const items: ScheduledItem[] = [...input.scheduled]
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((row) => {
      let matched = false;
      if (!row.paid) {
        const index = input.transactions.findIndex((tx, i) => {
          if (used.has(i)) return false;
          if (row.kind === "expense" ? tx.amount >= 0 : tx.amount <= 0) return false;
          if (Math.abs(Math.abs(tx.amount) - row.amount) > 0.01) return false;
          const diff = days(tx.date) - days(row.due_date);
          return diff >= -MATCH_DAYS_BEFORE && diff <= MATCH_DAYS_AFTER;
        });
        if (index >= 0) {
          used.add(index);
          matched = true;
        }
      }
      const status: ScheduledItem["status"] = row.paid ? "paid" : matched ? "matched" : "pending";
      return {
        id: row.id,
        kind: row.kind,
        description: row.description,
        amount: row.amount,
        due_date: row.due_date,
        category: row.category,
        paid: row.paid,
        status,
        overdue: status === "pending" && row.due_date < input.today,
      };
    });

  const cardClosed = (month: string): boolean =>
    input.cards.every((card) => {
      const closingMonth = card.due_day > card.closing_day ? month : addMonths(month, -1);
      return input.today >= `${closingMonth}-${pad(card.closing_day)}`;
    });

  const months: ForecastMonth[] = [];

  for (let i = 0; i < horizon; i++) {
    const month = addMonths(current, i);
    const isCurrent = month === current;
    const rows = input.spend.filter((r) => r.month === month);
    const realizedChecking = rows.filter((r) => r.kind === "checking").reduce((s, r) => s + r.spent, 0);
    const realizedCard = rows.filter((r) => r.kind === "credit_card").reduce((s, r) => s + r.spent, 0);
    const received = rows.reduce((s, r) => s + r.income, 0);

    // Pendente vencido (de meses anteriores) ainda precisa ser pago: conta no mês corrente.
    const pendingIn = (kind: "expense" | "income") =>
      items.filter(
        (item) =>
          item.kind === kind &&
          item.status === "pending" &&
          (item.due_date.slice(0, 7) === month || (isCurrent && item.due_date.slice(0, 7) < current)),
      );
    const scheduledExpenses = pendingIn("expense");
    const scheduledIncomes = pendingIn("income");

    // Recorrente já coberto por um item cadastrado de valor parecido não conta duas vezes.
    const recurringPending = (list: RecurringPoint[], scheduled: ScheduledItem[], kind: "expense" | "income") => {
      const covered = new Set<number>();
      for (const item of scheduled) {
        const index = list.findIndex(
          (r, idx) => !covered.has(idx) && Math.abs(r.amount - item.amount) <= item.amount * RECURRING_OVERLAP,
        );
        if (index >= 0) covered.add(index);
      }
      return list
        .filter((r, idx) => !covered.has(idx))
        .filter((r) => (kind === "expense" ? r.account_kind === "checking" : true))
        .filter((r) => (isCurrent ? !r.charged_this_month : true))
        .reduce((sum, r) => sum + r.amount, 0);
    };
    const recurringExpenses = recurringPending(input.recurringExpenses, scheduledExpenses, "expense");
    const recurringIncomes = recurringPending(input.recurringIncomes, scheduledIncomes, "income");

    const scheduledExpense = scheduledExpenses.reduce((s, item) => s + item.amount, 0);
    const scheduledIncome = scheduledIncomes.reduce((s, item) => s + item.amount, 0);

    const committed = realizedChecking + realizedCard + scheduledExpense + recurringExpenses;
    const projectedChecking = Math.max(realizedChecking + scheduledExpense + recurringExpenses, avgChecking);
    const projectedCard = cardClosed(month) ? realizedCard : Math.max(realizedCard, avgCard);
    const projectedExpenses = projectedChecking + projectedCard;
    const projectedIncome = received + scheduledIncome + recurringIncomes;

    months.push({
      month,
      income: {
        received: round2(received),
        scheduled: round2(scheduledIncome),
        recurring: round2(recurringIncomes),
        projected: round2(projectedIncome),
        average: round2(avgIncome),
      },
      expenses: {
        realized: round2(realizedChecking + realizedCard),
        scheduled: round2(scheduledExpense),
        recurring: round2(recurringExpenses),
        committed: round2(committed),
        projected: round2(projectedExpenses),
        average: round2(avgChecking + avgCard),
      },
      balance: round2(projectedIncome - projectedExpenses),
    });
  }

  return { months, items };
}
