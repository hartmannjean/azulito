import type { MonthlyTrendPoint } from "@azulito/shared";
import { formatCurrency, formatMonthShort } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

const WIDTH = 480;
const HEIGHT = 200;
const PADDING_X = 8;
const PADDING_Y = 12;

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]!;
    const next = points[i + 1]!;
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1]!;
  d += ` T ${last.x} ${last.y}`;
  return d;
}

function toPoints(values: number[], max: number): { x: number; y: number }[] {
  const usableWidth = WIDTH - PADDING_X * 2;
  const usableHeight = HEIGHT - PADDING_Y * 2;
  const step = values.length > 1 ? usableWidth / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: PADDING_X + index * step,
    y: PADDING_Y + usableHeight - (value / max) * usableHeight,
  }));
}

export function TrendChart({
  trend,
  locale,
  dict,
}: {
  trend: MonthlyTrendPoint[];
  locale: Locale;
  dict: Dictionary;
}) {
  const trendDict = dict.trend;

  if (trend.length === 0) {
    return (
      <section className="chart-card">
        <h2 className="chart-heading">{trendDict.heading(0)}</h2>
        <p className="empty-state">{trendDict.empty}</p>
      </section>
    );
  }

  const max = Math.max(1, ...trend.flatMap((point) => [point.income, point.expenses]));
  const incomePoints = toPoints(
    trend.map((point) => point.income),
    max,
  );
  const expensePoints = toPoints(
    trend.map((point) => point.expenses),
    max,
  );

  const incomeArea = `${buildSmoothPath(incomePoints)} L ${incomePoints[incomePoints.length - 1]!.x} ${HEIGHT} L ${incomePoints[0]!.x} ${HEIGHT} Z`;
  const expenseLine = buildSmoothPath(expensePoints);

  return (
    <section className="chart-card">
      <h2 className="chart-heading">{trendDict.heading(trend.length)}</h2>
      <svg
        className="trend-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={trendDict.ariaLabel}
      >
        <defs>
          <linearGradient id="trend-income-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--positive)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            className="trend-gridline"
            x1={PADDING_X}
            x2={WIDTH - PADDING_X}
            y1={PADDING_Y + (HEIGHT - PADDING_Y * 2) * fraction}
            y2={PADDING_Y + (HEIGHT - PADDING_Y * 2) * fraction}
          />
        ))}

        <path d={incomeArea} fill="url(#trend-income-fill)" stroke="none" />
        <path
          d={buildSmoothPath(incomePoints)}
          fill="none"
          stroke="var(--positive)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={expenseLine}
          fill="none"
          stroke="var(--danger)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {incomePoints.map((point, index) => (
          <circle key={`income-${trend[index]!.month}`} cx={point.x} cy={point.y} r="3" fill="var(--positive)">
            <title>
              {trendDict.incomeTooltip(
                formatMonthShort(trend[index]!.month, locale),
                formatCurrency(trend[index]!.income, locale),
              )}
            </title>
          </circle>
        ))}
        {expensePoints.map((point, index) => (
          <circle key={`expense-${trend[index]!.month}`} cx={point.x} cy={point.y} r="3" fill="var(--danger)">
            <title>
              {trendDict.expenseTooltip(
                formatMonthShort(trend[index]!.month, locale),
                formatCurrency(trend[index]!.expenses, locale),
              )}
            </title>
          </circle>
        ))}
      </svg>
      <div className="trend-labels">
        {trend.map((point) => (
          <span key={point.month} className="trend-label">
            {formatMonthShort(point.month, locale)}
          </span>
        ))}
      </div>
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot income" aria-hidden="true" /> {dict.summary.income}
        </span>
        <span className="legend-item">
          <span className="legend-dot expense" aria-hidden="true" /> {dict.summary.expenses}
        </span>
      </div>
    </section>
  );
}
