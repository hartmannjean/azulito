import type { MonthlyTrendPoint } from "@azulito/shared";
import { formatCurrency, formatMonthShort } from "@/lib/format";

export function TrendChart({ trend }: { trend: MonthlyTrendPoint[] }) {
  const max = Math.max(1, ...trend.flatMap((point) => [point.income, point.expenses]));

  return (
    <section className="chart-card">
      <h2 className="chart-heading">Receitas x despesas ({trend.length} meses)</h2>
      <div className="trend-chart">
        {trend.map((point) => (
          <div key={point.month} className="trend-column">
            <div className="trend-bars">
              <span
                className="trend-bar income"
                style={{ height: `${(point.income / max) * 100}%` }}
                title={`Receitas: ${formatCurrency(point.income)}`}
              />
              <span
                className="trend-bar expense"
                style={{ height: `${(point.expenses / max) * 100}%` }}
                title={`Despesas: ${formatCurrency(point.expenses)}`}
              />
            </div>
            <span className="trend-label">{formatMonthShort(point.month)}</span>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot income" aria-hidden="true" /> Receitas
        </span>
        <span className="legend-item">
          <span className="legend-dot expense" aria-hidden="true" /> Despesas
        </span>
      </div>
    </section>
  );
}
