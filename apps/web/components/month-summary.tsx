import Link from "next/link";
import type { CSSProperties } from "react";
import type { MonthlyTrendPoint, TransactionsSummary } from "@azulito/shared";
import { formatCurrency, formatMonthLabel, percentChange, shiftMonth } from "@/lib/format";
import { Sparkline } from "@/components/sparkline";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

function DeltaBadge({
  value,
  invert = false,
  dict,
}: {
  value: number | null;
  invert?: boolean;
  dict: Dictionary["summary"];
}) {
  if (value === null) {
    return <span className="delta-badge neutral">{dict.deltaNew}</span>;
  }
  if (value === 0) {
    return <span className="delta-badge neutral">{dict.deltaUnchanged}</span>;
  }
  const isGood = invert ? value < 0 : value > 0;
  const arrow = value > 0 ? "↑" : "↓";
  return (
    <span className={`delta-badge ${isGood ? "good" : "bad"}`}>{dict.deltaChange(arrow, Math.abs(value))}</span>
  );
}

export function MonthSummary({
  summary,
  previous,
  trend = [],
  locale,
  dict,
}: {
  summary: TransactionsSummary;
  previous: TransactionsSummary | null;
  trend?: MonthlyTrendPoint[];
  locale: Locale;
  dict: Dictionary;
}) {
  const previousMonth = shiftMonth(summary.month, -1);
  const nextMonth = shiftMonth(summary.month, 1);

  const incomeDelta = previous ? percentChange(summary.income, previous.income) : null;
  const expensesDelta = previous ? percentChange(summary.expenses, previous.expenses) : null;
  const balanceDelta = previous ? percentChange(summary.balance, previous.balance) : null;

  const incomeTrend = trend.map((point) => point.income);
  const expensesTrend = trend.map((point) => point.expenses);
  const balanceTrend = trend.map((point) => point.balance);

  return (
    <section className="month-summary">
      <div className="month-nav">
        <Link
          href={`/dashboard?month=${previousMonth}`}
          className="month-nav-arrow"
          aria-label={dict.dashboard.previousMonth}
        >
          ‹
        </Link>
        <h2>{formatMonthLabel(summary.month, locale)}</h2>
        <Link
          href={`/dashboard?month=${nextMonth}`}
          className="month-nav-arrow"
          aria-label={dict.dashboard.nextMonth}
        >
          ›
        </Link>
      </div>
      <div className="summary-cards">
        <div className="summary-card summary-card-income">
          <div className="summary-card-top">
            <span className="summary-icon income" aria-hidden="true">
              ↑
            </span>
            <div>
              <span className="summary-label">{dict.summary.income}</span>
              <span className="summary-value positive">{formatCurrency(summary.income, locale)}</span>
            </div>
          </div>
          <div className="summary-card-bottom">
            <DeltaBadge value={incomeDelta} dict={dict.summary} />
            <Sparkline data={incomeTrend} color="var(--positive)" />
          </div>
        </div>
        <div className="summary-card summary-card-expense">
          <div className="summary-card-top">
            <span className="summary-icon expense" aria-hidden="true">
              ↓
            </span>
            <div>
              <span className="summary-label">{dict.summary.expenses}</span>
              <span className="summary-value negative">{formatCurrency(summary.expenses, locale)}</span>
            </div>
          </div>
          <div className="summary-card-bottom">
            <DeltaBadge value={expensesDelta} invert dict={dict.summary} />
            <Sparkline data={expensesTrend} color="var(--danger)" />
          </div>
        </div>
        <div
          className="summary-card summary-card-balance"
          style={{ "--card-accent": summary.balance >= 0 ? "var(--positive)" : "var(--danger)" } as CSSProperties}
        >
          <div className="summary-card-top">
            <span className="summary-icon balance" aria-hidden="true">
              =
            </span>
            <div>
              <span className="summary-label">{dict.summary.balance}</span>
              <span className={`summary-value ${summary.balance >= 0 ? "positive" : "negative"}`}>
                {formatCurrency(summary.balance, locale)}
              </span>
            </div>
          </div>
          <div className="summary-card-bottom">
            <DeltaBadge value={balanceDelta} dict={dict.summary} />
            <Sparkline data={balanceTrend} color={summary.balance >= 0 ? "var(--positive)" : "var(--danger)"} />
          </div>
        </div>
      </div>
    </section>
  );
}
