import type { MonthlyTrendPoint } from "@azulito/shared";
import { formatCurrency, formatMonthLabel, formatMonthShort } from "@/lib/format";
import { TrendChartClient, type TrendColumn } from "@/components/trend-chart-client";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

const WIDTH = 900;
const HEIGHT = 250;
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
  basePath = null,
  selectedMonth = "",
}: {
  trend: MonthlyTrendPoint[];
  locale: Locale;
  dict: Dictionary;
  /** "/dash": clicar num mês abre o painel daquele mês. null = só passar o mouse. */
  basePath?: string | null;
  selectedMonth?: string;
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

  const compact = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
  const gridFractions = [0.25, 0.5, 0.75];
  const gridLabels = gridFractions.map((fraction) => ({
    y: ((PADDING_Y + (HEIGHT - PADDING_Y * 2) * fraction) / HEIGHT) * 100,
    text: locale.startsWith("pt") ? compact.format(max * (1 - fraction)).replace(/(d).(d)/, "$1,$2") : compact.format(max * (1 - fraction)),
  }));
  const averageBalance = trend.reduce((sum, point) => sum + point.income - point.expenses, 0) / trend.length;

  const columns: TrendColumn[] = trend.map((point, index) => {
    const balance = point.income - point.expenses;
    const title = formatMonthLabel(point.month, locale);
    return {
      month: point.month,
      short: formatMonthShort(point.month, locale),
      title,
      x: (incomePoints[index]!.x / WIDTH) * 100,
      incomeY: (incomePoints[index]!.y / HEIGHT) * 100,
      expenseY: (expensePoints[index]!.y / HEIGHT) * 100,
      incomeText: formatCurrency(point.income, locale),
      expenseText: formatCurrency(point.expenses, locale),
      balanceText: formatCurrency(balance, locale),
      balancePositive: balance >= 0,
      href: basePath ? `${basePath}?month=${point.month}` : null,
      ariaLabel: `${title}: ${trendDict.incomeTooltip(title, formatCurrency(point.income, locale))}; ${trendDict.expenseTooltip(title, formatCurrency(point.expenses, locale))}`,
    };
  });

  return (
    <section className="chart-card">
      <div className="trend-head">
        <h2 className="chart-heading">{trendDict.heading(trend.length)}</h2>
        <span className={`trend-chip ${averageBalance >= 0 ? "positive" : "negative"}`}>
          {trendDict.average} <b>{formatCurrency(averageBalance, locale)}</b>
        </span>
      </div>
      <TrendChartClient
        columns={columns}
        selectedMonth={selectedMonth}
        incomeLine={buildSmoothPath(incomePoints)}
        incomeArea={incomeArea}
        expenseLine={expenseLine}
        gridLabels={gridLabels}
        gridLines={gridFractions.map((fraction) => PADDING_Y + (HEIGHT - PADDING_Y * 2) * fraction)}
        viewBox={{ width: WIDTH, height: HEIGHT }}
        labels={{
          income: dict.summary.income,
          expenses: dict.summary.expenses,
          balance: dict.summary.balance,
          hint: trendDict.hint,
          ariaLabel: trendDict.ariaLabel,
        }}
      />
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
