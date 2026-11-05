import type { CSSProperties } from "react";
import { getDemoData, getDemoForecast } from "@/lib/demo-data";
import { formatCurrency, formatMonthLabel, percentChange } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { Icon } from "./icons";

const W = 640;
const H = 190;
const PAD = 14;

/** Curva suave (bézier) e área de um gráfico de linha simples, em coordenadas do SVG. */
function chartPaths(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (W - PAD * 2) / Math.max(1, values.length - 1);
  const points = values.map((value, index) => ({
    x: PAD + index * step,
    y: PAD + (H - PAD * 2) - ((value - min) / range) * (H - PAD * 2),
  }));

  let line = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const mid = ((a.x + b.x) / 2).toFixed(1);
    line += ` C ${mid} ${a.y.toFixed(1)}, ${mid} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  const last = points[points.length - 1]!;
  const area = `${line} L ${last.x.toFixed(1)} ${H} L ${points[0]!.x.toFixed(1)} ${H} Z`;
  return { line, area, last };
}

/**
 * Prévia do produto para as telas públicas: uma janela com o painel (dados
 * FICTÍCIOS da demonstração) e cartões de vidro flutuando em volta. Só HTML,
 * SVG e CSS: nada aqui lê dado de usuário nem chama a api.
 */
export function ProductShowcase({
  locale,
  dict,
  compact = false,
}: {
  locale: Locale;
  dict: Dictionary;
  compact?: boolean;
}) {
  const t = dict.landing.showcase;
  const demo = getDemoData();
  const salary = getDemoForecast().salary;
  const { line, area, last } = chartPaths(demo.trend.map((point) => point.balance));
  const delta = percentChange(demo.summary.balance, demo.previousSummary.balance);
  const money = (value: number) => formatCurrency(value, locale);

  return (
    <div className="mk-scene">
      <div className="mk-scene-in">
        <div className="mk-window">
          <div className="mk-win-bar">
            <i />
            <i />
            <i />
            <span className="mk-win-title">{t.overview}</span>
            <span className="mk-win-chip">{formatMonthLabel(demo.month, locale)}</span>
          </div>

          <div className="mk-balance-label">{t.balance}</div>
          <div className="mk-balance">
            {money(demo.summary.balance)}
            {delta !== null ? (
              <span className="mk-delta">
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(0)}%
              </span>
            ) : null}
          </div>

          <svg className="mk-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true">
            <defs>
              <linearGradient id="mk-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="mk-line-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2d6bff" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
            <path className="area" d={area} fill="url(#mk-area-fill)" />
            <path className="line" d={line} fill="none" stroke="url(#mk-line-stroke)" strokeWidth="3.5" strokeLinecap="round" />
            <circle className="dot" cx={last.x} cy={last.y} r="6" fill="#38bdf8" stroke="#fff" strokeWidth="2.5" />
          </svg>

          <div className="mk-kpis">
            <div className="mk-kpi">
              <small>{t.income}</small>
              <b className="pos">{money(demo.summary.income)}</b>
            </div>
            <div className="mk-kpi">
              <small>{t.expenses}</small>
              <b className="neg">{money(demo.summary.expenses)}</b>
            </div>
            <div className="mk-kpi">
              <small>{t.balance}</small>
              <b>{money(demo.summary.balance)}</b>
            </div>
          </div>
        </div>

        <div className="mk-float mk-f-salary">
          <span className="mk-ico pos">
            <Icon name="wallet" />
          </span>
          <div>
            <strong>{money(salary?.amount ?? 0)}</strong>
            <small>
              {t.salaryTitle} · {t.salaryWhen.replace("{day}", String(salary?.day ?? 5))}
            </small>
          </div>
        </div>

        <div className="mk-float mk-f-budget">
          <div className="mk-ring-wrap">
            <div className="mk-ring" style={{ "--p": 78, "--ring": "var(--warn)" } as CSSProperties} />
            <b>78%</b>
          </div>
          <div>
            <strong>{t.budgetTitle}</strong>
            <small>{t.budgetUsed.replace("{pct}", "78")}</small>
          </div>
        </div>

        {compact ? null : (
          <>
            <div className="mk-float mk-f-ai">
              <span className="mk-ico">
                <Icon name="spark" />
              </span>
              <div>
                <strong>{t.aiTitle}</strong>
                <small>{t.aiText}</small>
              </div>
            </div>

            <div className="mk-float mk-f-card">
              <span className="mk-ico warn">
                <Icon name="card" />
              </span>
              <div>
                <strong>{t.cardTitle}</strong>
                <small>{t.cardClosing.replace("{days}", "3")}</small>
              </div>
            </div>
          </>
        )}
      </div>
      <p className="mk-note">{t.demoNote}</p>
    </div>
  );
}
