import type { MonthlyTrendPoint } from "@azulito/shared";
import { formatCurrency, formatMonthShort } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

const WIDTH = 900;
const HEIGHT = 240;
const PAD_TOP = 28;
const PAD_BOTTOM = 34;
const PAD_X = 12;

/** Barras do saldo (receita − despesa) mês a mês: verde acima de zero, vermelho abaixo. */
export function BalanceChart({
  trend,
  locale,
  dict,
}: {
  trend: MonthlyTrendPoint[];
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.charts;
  if (trend.length === 0) return null;

  const max = Math.max(1, ...trend.map((p) => Math.abs(p.balance)));
  const hasNegative = trend.some((p) => p.balance < 0);
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  // Zero no meio quando há saldo negativo; embaixo caso contrário.
  const zeroY = PAD_TOP + (hasNegative ? plotHeight / 2 : plotHeight);
  const scale = (hasNegative ? plotHeight / 2 : plotHeight) / max;
  const slot = (WIDTH - PAD_X * 2) / trend.length;
  const barWidth = Math.min(64, slot * 0.55);

  return (
    <section className="chart-card">
      <h2 className="chart-heading">{t.balanceHeading}</h2>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t.balanceHeading} className="bar-chart">
        <line x1={PAD_X} x2={WIDTH - PAD_X} y1={zeroY} y2={zeroY} className="chart-axis" />
        {trend.map((point, index) => {
          const height = Math.abs(point.balance) * scale;
          const x = PAD_X + index * slot + (slot - barWidth) / 2;
          const positive = point.balance >= 0;
          const y = positive ? zeroY - height : zeroY;
          return (
            <g key={point.month}>
              <title>{`${formatMonthShort(point.month, locale)}: ${formatCurrency(point.balance, locale)}`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, height)}
                rx={6}
                className={positive ? "bar-positive" : "bar-negative"}
              />
              <text
                x={x + barWidth / 2}
                y={positive ? y - 6 : y + height + 14}
                textAnchor="middle"
                className="chart-value"
              >
                {formatCurrency(point.balance, locale)}
              </text>
              <text x={x + barWidth / 2} y={HEIGHT - 10} textAnchor="middle" className="chart-label">
                {formatMonthShort(point.month, locale)}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
