import type { SavingsOverview } from "@azulito/shared";
import { formatCurrency, formatMonthShort } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

const WIDTH = 900;
const HEIGHT = 260;
const PAD_TOP = 26;
const PAD_BOTTOM = 34;
const PAD_X = 36;

type Point = { month: string; value: number; forecast: boolean };

/** Saldo das caixinhas mês a mês (linha) e a previsão (tracejado). */
export function SavingsChart({
  overview,
  locale,
  dict,
}: {
  overview: SavingsOverview;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.charts;
  const actual: Point[] = overview.months
    .filter((m) => m.closing !== null)
    .map((m) => ({ month: m.month, value: m.closing as number, forecast: false }));
  const projected: Point[] = overview.forecast.map((f) => ({ month: f.month, value: f.balance, forecast: true }));
  const all = [...actual, ...projected];
  if (actual.length === 0) return null;

  const max = Math.max(1, ...all.map((p) => p.value));
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = all.length > 1 ? (WIDTH - PAD_X * 2) / (all.length - 1) : 0;
  const at = (index: number, value: number) => ({
    x: PAD_X + index * step,
    y: PAD_TOP + plotHeight - (value / max) * plotHeight,
  });
  const coords = all.map((p, i) => ({ ...at(i, p.value), p }));
  const line = (items: typeof coords) => items.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const actualCoords = coords.filter((c) => !c.p.forecast);
  // O tracejado começa no último ponto real para a linha não ficar quebrada.
  const forecastCoords = [actualCoords[actualCoords.length - 1]!, ...coords.filter((c) => c.p.forecast)];

  return (
    <section className="chart-card">
      <h2 className="chart-heading">{t.savingsHeading}</h2>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t.savingsHeading} className="line-chart">
        <line x1={PAD_X} x2={WIDTH - PAD_X} y1={PAD_TOP + plotHeight} y2={PAD_TOP + plotHeight} className="chart-axis" />
        <path d={line(actualCoords)} className="line-actual" fill="none" />
        {forecastCoords.length > 1 ? <path d={line(forecastCoords)} className="line-forecast" fill="none" /> : null}
        {coords.map((c) => (
          <g key={c.p.month}>
            <title>{`${formatMonthShort(c.p.month, locale)}: ${formatCurrency(c.p.value, locale)}`}</title>
            <circle cx={c.x} cy={c.y} r={4.5} className={c.p.forecast ? "dot-forecast" : "dot-actual"} />
            <text x={c.x} y={c.y - 10} textAnchor="middle" className="chart-value">
              {formatCurrency(c.p.value, locale)}
            </text>
            <text x={c.x} y={HEIGHT - 10} textAnchor="middle" className="chart-label">
              {formatMonthShort(c.p.month, locale)}
            </text>
          </g>
        ))}
      </svg>
      <p className="chart-legend">
        <span className="legend-line actual" /> {t.actualLegend} <span className="legend-line forecast" /> {t.forecastLegend}
      </p>
    </section>
  );
}
