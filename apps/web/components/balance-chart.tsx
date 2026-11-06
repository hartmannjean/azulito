import type { MonthlyTrendPoint } from "@azulito/shared";
import { DualChart } from "@/components/dual-chart";
import { formatCompactNumber, formatCurrency, formatMonthShort } from "@/lib/format";
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

  const svg = (width: number, height: number, compact: boolean) => {
    const plotHeight = height - PAD_TOP - PAD_BOTTOM;
    // Zero no meio quando há saldo negativo; embaixo caso contrário.
    const zeroY = PAD_TOP + (hasNegative ? plotHeight / 2 : plotHeight);
    const scale = (hasNegative ? plotHeight / 2 : plotHeight) / max;
    const padX = compact ? 10 : PAD_X;
    const slot = (width - padX * 2) / trend.length;
    const barWidth = Math.min(compact ? 34 : 64, slot * (compact ? 0.62 : 0.55));
    return (
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.balanceHeading} className="bar-chart">
        <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} className="chart-axis" />
        {trend.map((point, index) => {
          const barHeight = Math.abs(point.balance) * scale;
          const x = padX + index * slot + (slot - barWidth) / 2;
          const positive = point.balance >= 0;
          const y = positive ? zeroY - barHeight : zeroY;
          const value = compact ? formatCompactNumber(point.balance, locale) : formatCurrency(point.balance, locale);
          return (
            <g key={point.month}>
              <title>{`${formatMonthShort(point.month, locale)}: ${formatCurrency(point.balance, locale)}`}</title>
              <rect x={x} y={y} width={barWidth} height={Math.max(2, barHeight)} rx={6} className={positive ? "bar-positive" : "bar-negative"} />
              <text x={x + barWidth / 2} y={positive ? y - 6 : y + barHeight + 14} textAnchor="middle" className="chart-value">
                {value}
              </text>
              <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" className="chart-label">
                {formatMonthShort(point.month, locale)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <section className="chart-card">
      <h2 className="chart-heading">{t.balanceHeading}</h2>
      <DualChart desktop={svg(WIDTH, HEIGHT, false)} mobile={svg(340, 270, true)} />
    </section>
  );
}
