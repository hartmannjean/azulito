import Link from "next/link";
import type { TransactionsSummary } from "@azulito/shared";
import { formatCurrency, formatMonthLabel, percentChange, shiftMonth } from "@/lib/format";

function DeltaBadge({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) {
    return <span className="delta-badge neutral">novo</span>;
  }
  if (value === 0) {
    return <span className="delta-badge neutral">= mês anterior</span>;
  }
  const isGood = invert ? value < 0 : value > 0;
  const arrow = value > 0 ? "↑" : "↓";
  return (
    <span className={`delta-badge ${isGood ? "good" : "bad"}`}>
      {arrow} {Math.abs(value)}% vs mês anterior
    </span>
  );
}

export function MonthSummary({
  summary,
  previous,
}: {
  summary: TransactionsSummary;
  previous: TransactionsSummary | null;
}) {
  const previousMonth = shiftMonth(summary.month, -1);
  const nextMonth = shiftMonth(summary.month, 1);

  const incomeDelta = previous ? percentChange(summary.income, previous.income) : null;
  const expensesDelta = previous ? percentChange(summary.expenses, previous.expenses) : null;
  const balanceDelta = previous ? percentChange(summary.balance, previous.balance) : null;

  return (
    <section className="month-summary">
      <div className="month-nav">
        <Link href={`/dashboard?month=${previousMonth}`} className="month-nav-arrow" aria-label="Mês anterior">
          ‹
        </Link>
        <h2>{formatMonthLabel(summary.month)}</h2>
        <Link href={`/dashboard?month=${nextMonth}`} className="month-nav-arrow" aria-label="Próximo mês">
          ›
        </Link>
      </div>
      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-icon income" aria-hidden="true">
            ↑
          </span>
          <div>
            <span className="summary-label">Receitas</span>
            <span className="summary-value positive">{formatCurrency(summary.income)}</span>
            <DeltaBadge value={incomeDelta} />
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-icon expense" aria-hidden="true">
            ↓
          </span>
          <div>
            <span className="summary-label">Despesas</span>
            <span className="summary-value negative">{formatCurrency(summary.expenses)}</span>
            <DeltaBadge value={expensesDelta} invert />
          </div>
        </div>
        <div className="summary-card summary-card-balance">
          <span className="summary-icon balance" aria-hidden="true">
            =
          </span>
          <div>
            <span className="summary-label">Saldo</span>
            <span className={`summary-value ${summary.balance >= 0 ? "positive" : "negative"}`}>
              {formatCurrency(summary.balance)}
            </span>
            <DeltaBadge value={balanceDelta} />
          </div>
        </div>
      </div>
    </section>
  );
}
