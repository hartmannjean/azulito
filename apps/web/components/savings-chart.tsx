import { addMonths, type SavingsOverview } from "@azulito/shared";
import { formatCurrency, formatMonthShort } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

const WIDTH = 900;
const HEIGHT = 260;
const PAD_TOP = 38;
const PAD_BOTTOM = 34;
const PAD_X = 70;

type Point = { month: string; value: number; kind: "actual" | "estimated" | "forecast" };

/**
 * Saldo das caixinhas mês a mês. O eixo é o calendário (um mês por posição),
 * então um mês sem saldo informado aparece como lacuna ou ponto estimado, e
 * não some do gráfico.
 */
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
    .map((m) => ({ month: m.month, value: m.closing as number, kind: "actual" as const }));
  if (actual.length === 0) return null;

  const forecast: Point[] = overview.forecast.map((f) => ({ month: f.month, value: f.balance, kind: "forecast" as const }));
  const lastActual = actual[actual.length - 1]!;
  // O mês corrente sem saldo informado entra como ponto estimado (o forecast começa no mês seguinte).
  const current = forecast[0] ? addMonths(forecast[0].month, -1) : null;
  const estimated: Point[] =
    current && current > lastActual.month && overview.current_balance !== null
      ? [{ month: current, value: overview.current_balance, kind: "estimated" as const }]
      : [];

  const points = [...actual, ...estimated, ...forecast];
  const first = points[0]!.month;
  const last = points[points.length - 1]!.month;
  const axis: string[] = [];
  for (let month = first; month <= last; month = addMonths(month, 1)) axis.push(month);

  const max = Math.max(1, ...points.map((p) => p.value));
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = axis.length > 1 ? (WIDTH - PAD_X * 2) / (axis.length - 1) : 0;
  const coord = (p: Point) => ({
    x: PAD_X + axis.indexOf(p.month) * step,
    y: PAD_TOP + plotHeight - (p.value / max) * plotHeight,
    p,
  });
  const coords = points.map(coord);
  const path = (items: typeof coords) => items.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  const actualCoords = coords.filter((c) => c.p.kind === "actual");
  // O tracejado (estimativa e previsão) parte do último ponto real, para a linha não ficar quebrada.
  const dashedCoords = [actualCoords[actualCoords.length - 1]!, ...coords.filter((c) => c.p.kind !== "actual")];

  return (
    <section className="chart-card">
      <h2 className="chart-heading">{t.savingsHeading}</h2>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t.savingsHeading} className="line-chart">
        <line x1={PAD_X} x2={WIDTH - PAD_X} y1={PAD_TOP + plotHeight} y2={PAD_TOP + plotHeight} className="chart-axis" />
        <path d={path(actualCoords)} pathLength={1} className="line-actual draw-line" fill="none" />
        {dashedCoords.length > 1 ? <path d={path(dashedCoords)} className="line-forecast fade-area" fill="none" /> : null}
        {coords.map((c) => (
          <g key={c.p.month}>
            <title>{`${formatMonthShort(c.p.month, locale)}: ${formatCurrency(c.p.value, locale)}`}</title>
            <circle cx={c.x} cy={c.y} r={4.5} className={c.p.kind === "actual" ? "dot-actual" : "dot-forecast"} />
            <text x={c.x} y={c.y - 10} textAnchor="middle" className="chart-value">
              {formatCurrency(c.p.value, locale)}
            </text>
          </g>
        ))}
        {axis.map((month, index) => (
          <text key={month} x={PAD_X + index * step} y={HEIGHT - 10} textAnchor="middle" className="chart-label">
            {formatMonthShort(month, locale)}
          </text>
        ))}
      </svg>
      <p className="chart-legend">
        <span className="legend-line actual" /> {t.actualLegend} <span className="legend-line forecast" /> {t.forecastLegend}
      </p>
    </section>
  );
}
