import type { CardComparison } from "@azulito/shared";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import { DualChart } from "@/components/dual-chart";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

const PAD_TOP = 24;
const PAD_BOTTOM = 30;

/** Acumulado de compras por dia: este mês (até o corte) × mês passado (inteiro, tracejado depois do corte). */
function Chart({
  data,
  locale,
  label,
  width,
  height,
  compact,
}: {
  data: CardComparison;
  locale: Locale;
  label: string;
  width: number;
  height: number;
  compact: boolean;
}) {
  const WIDTH = width;
  const HEIGHT = height;
  const PAD_X = compact ? 24 : 40;
  const days = Math.max(data.daily.previous.length, data.cutoff_day);
  const max = Math.max(1, ...data.daily.previous, ...data.daily.current);
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = days > 1 ? (WIDTH - PAD_X * 2) / (days - 1) : 0;
  const x = (day: number) => PAD_X + (day - 1) * step;
  const y = (value: number) => PAD_TOP + plotHeight - (value / max) * plotHeight;
  const path = (values: number[], from: number, to: number) =>
    values
      .slice(from, to)
      .map((value, i) => `${i === 0 ? "M" : "L"} ${x(from + i + 1)} ${y(value)}`)
      .join(" ");

  const cutoff = data.cutoff_day;
  const lastCurrent = data.daily.current[data.daily.current.length - 1] ?? 0;
  const lastPreviousAtCutoff = data.daily.previous[Math.min(cutoff, data.daily.previous.length) - 1] ?? 0;
  const ticks = (compact ? [1, 10, 20, days] : [1, 5, 10, 15, 20, 25, days]).filter((d, i, arr) => d <= days && arr.indexOf(d) === i);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="line-chart">
      <line x1={PAD_X} x2={WIDTH - PAD_X} y1={PAD_TOP + plotHeight} y2={PAD_TOP + plotHeight} className="chart-axis" />
      <line x1={x(cutoff)} x2={x(cutoff)} y1={PAD_TOP} y2={PAD_TOP + plotHeight} className="chart-axis cutoff" />
      <path d={path(data.daily.previous, 0, Math.min(cutoff, data.daily.previous.length))} className="line-previous" fill="none" />
      {data.daily.previous.length > cutoff ? (
        <path
          d={path(data.daily.previous, Math.min(cutoff, data.daily.previous.length) - 1, data.daily.previous.length)}
          className="line-previous dashed"
          fill="none"
        />
      ) : null}
      <path d={path(data.daily.current, 0, data.daily.current.length)} className="line-actual" fill="none" />
      <circle cx={x(cutoff)} cy={y(lastCurrent)} r={5} className="dot-actual" />
      <circle cx={x(Math.min(cutoff, data.daily.previous.length))} cy={y(lastPreviousAtCutoff)} r={4.5} className="dot-previous" />
      <text x={x(cutoff)} y={y(lastCurrent) - 10} textAnchor="middle" className="chart-value">
        {formatCurrency(lastCurrent, locale)}
      </text>
      {ticks.map((d) => (
        <text key={d} x={x(d)} y={HEIGHT - 8} textAnchor="middle" className="chart-label">
          {d}
        </text>
      ))}
    </svg>
  );
}

/**
 * Compras no cartão neste mês até hoje contra o mês passado até o mesmo dia
 * (pela data da compra, só compras novas). Só apresentação: o cálculo vem da api.
 */
export function CardCompareCard({
  data,
  locale,
  dict,
}: {
  data: CardComparison;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.cardCompare;
  const money = (value: number) => formatCurrency(value, locale);
  const currentLabel = formatMonthLabel(data.current_month, locale);
  const previousLabel = formatMonthLabel(data.previous_month, locale);
  const more = data.delta.amount > 0;
  const tone = data.delta.amount === 0 ? "" : more ? "negative" : "positive";
  const sign = data.delta.amount > 0 ? "+" : data.delta.amount < 0 ? "−" : "";
  const percent =
    data.delta.percent === null
      ? ""
      : ` (${data.delta.percent > 0 ? "+" : data.delta.percent < 0 ? "−" : ""}${Math.abs(data.delta.percent).toLocaleString(locale, { maximumFractionDigits: 1 })}%)`;

  return (
    <section className="chart-card">
      <h2 className="chart-heading">{t.heading}</h2>
      <p className="muted-cell block">{t.period(data.cutoff_day, currentLabel, previousLabel)}</p>

      {data.no_data_this_month ? <p className="muted-cell block">{t.noDataThisMonth}</p> : null}
      {data.stale && data.data_until ? <p className="muted-cell block">{t.stale(formatDate(data.data_until, locale))}</p> : null}

      <div className="tx-totals card-compare-totals">
        <div className="tx-total">
          <span className="summary-label">{t.thisMonth(data.cutoff_day)}</span>
          <span className="tx-total-value">{money(data.current.purchases)}</span>
          <span className="muted-cell">{t.count(data.current.count)}</span>
        </div>
        <div className="tx-total">
          <span className="summary-label">{t.lastMonth(data.cutoff_day)}</span>
          <span className="tx-total-value">{money(data.previous.purchases)}</span>
          <span className="muted-cell">{t.count(data.previous.count)}</span>
        </div>
        <div className="tx-total">
          <span className="summary-label">{t.difference}</span>
          <span className={`tx-total-value ${tone}`}>
            {sign}
            {money(Math.abs(data.delta.amount))}
            {percent}
          </span>
          <span className="muted-cell">{data.delta.amount === 0 ? t.same : more ? t.spendingMore : t.spendingLess}</span>
        </div>
        <div className="tx-total">
          <span className="summary-label">{t.fullLastMonth}</span>
          <span className="tx-total-value">{money(data.previous_full)}</span>
        </div>
      </div>

      <DualChart
        desktop={<Chart data={data} locale={locale} label={t.chartLabel} width={900} height={220} compact={false} />}
        mobile={<Chart data={data} locale={locale} label={t.chartLabel} width={340} height={230} compact />}
      />
      <p className="chart-legend">
        <span className="legend-line actual" /> {currentLabel} <span className="legend-line previous" /> {previousLabel}
      </p>

      {data.categories.length > 0 ? (
        <>
          <h3 className="audit-sub">{t.byCategory}</h3>
          <ul className="mini-list compare-list">
            {data.categories.map((row) => {
              const rowMore = row.delta > 0;
              return (
                <li key={row.category} className="mini-row">
                  <span className="mini-row-label">
                    {getCategoryIcon(row.category) ?? ""} {translateCategory(row.category, locale) ?? row.category}
                  </span>
                  <span className="muted-cell nowrap">
                    {money(row.current)} <span aria-hidden="true">×</span> {money(row.previous)}
                  </span>
                  <span className={`nowrap ${row.delta === 0 ? "" : rowMore ? "negative" : "positive"}`}>
                    {row.delta > 0 ? "+" : row.delta < 0 ? "−" : ""}
                    {money(Math.abs(row.delta))}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <p className="tx-totals-note">
        {t.note(money(data.current.installments), money(data.previous.installments))}
      </p>
    </section>
  );
}
