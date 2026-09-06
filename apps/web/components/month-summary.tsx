import Link from "next/link";
import type { TransactionsSummary } from "@azulito/shared";
import { formatCurrency, formatMonthLabel, shiftMonth } from "@/lib/format";

export function MonthSummary({ summary }: { summary: TransactionsSummary }) {
  const previous = shiftMonth(summary.month, -1);
  const next = shiftMonth(summary.month, 1);

  return (
    <section className="month-summary">
      <div className="month-nav">
        <Link href={`/dashboard?month=${previous}`} className="month-nav-arrow" aria-label="Mês anterior">
          ‹
        </Link>
        <h2>{formatMonthLabel(summary.month)}</h2>
        <Link href={`/dashboard?month=${next}`} className="month-nav-arrow" aria-label="Próximo mês">
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
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-icon expense" aria-hidden="true">
            ↓
          </span>
          <div>
            <span className="summary-label">Despesas</span>
            <span className="summary-value negative">{formatCurrency(summary.expenses)}</span>
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
          </div>
        </div>
      </div>
    </section>
  );
}
