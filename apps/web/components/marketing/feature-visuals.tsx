import { currentMonth, formatCurrency, formatMonthShort, shiftMonth } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { translateCategory } from "@/lib/i18n/category-names";
import type { Locale } from "@/lib/i18n/locale";
import { Icon } from "./icons";

type Props = { locale: Locale; dict: Dictionary };

/** Cada visual é um "momento do produto" com dados FICTÍCIOS, só em HTML e CSS. */

export function ForecastVisual({ locale, dict }: Props) {
  const t = dict.landing.panelCards;
  const months = [0, 1, 2].map((i) => shiftMonth(currentMonth(), i));
  const income = [82, 78, 78];
  const expenses = [54, 61, 49];
  return (
    <div className="mk-visual">
      <h4>{t.forecastTitle}</h4>
      <div className="mk-bars">
        {months.map((month, i) => (
          <div className="mk-bar-col" key={month}>
            <div className="mk-bar-pair">
              <i style={{ height: `${income[i]}%` }} />
              <i className="out" style={{ height: `${expenses[i]}%` }} />
            </div>
            <span>{formatMonthShort(month, locale)}</span>
          </div>
        ))}
      </div>
      <span className="mk-pill">
        <Icon name="check" size={14} />
        {t.forecastIncome} · {formatCurrency(9500, locale)} · {t.forecastNote}
      </span>
    </div>
  );
}

export function CategorizeVisual({ locale, dict }: Props) {
  const t = dict.landing.panelCards;
  const money = (value: number) => formatCurrency(value, locale);
  return (
    <div className="mk-visual">
      <div className="mk-tx hot">
        <span className="mk-ico">
          <Icon name="spark" size={18} />
        </span>
        <div className="who">
          <b>{t.txMarket}</b>
          <small>
            {t.txAi} · {t.txRule}
          </small>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="amt">-{money(184.9)}</div>
          <span className="mk-chip">{translateCategory("Groceries", locale)}</span>
        </div>
      </div>
      <div className="mk-tx">
        <span className="mk-ico warn">
          <Icon name="card" size={18} />
        </span>
        <div className="who">
          <b>Posto Rio Azul</b>
          <small>{t.txAi}</small>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="amt">-{money(220)}</div>
          <span className="mk-chip warn">{translateCategory("Gas stations", locale)}</span>
        </div>
      </div>
      <div className="mk-tx">
        <span className="mk-ico pos">
          <Icon name="wallet" size={18} />
        </span>
        <div className="who">
          <b>Salário Empresa</b>
          <small>{t.txAi}</small>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="amt" style={{ color: "var(--positive)" }}>
            +{money(6500)}
          </div>
          <span className="mk-chip pos">{translateCategory("Income", locale)}</span>
        </div>
      </div>
    </div>
  );
}

export function BudgetVisual({ locale, dict }: Props) {
  const t = dict.landing.panelCards;
  const money = (value: number) => formatCurrency(value, locale);
  const rows = [
    { name: translateCategory("Groceries", locale), spent: 780, limit: 1000, tone: "" },
    { name: translateCategory("Eating out", locale), spent: 480, limit: 500, tone: "warn" },
    { name: translateCategory("Transportation", locale), spent: 336, limit: 300, tone: "over" },
  ];
  return (
    <div className="mk-visual">
      {rows.map((row) => {
        const pct = Math.round((row.spent / row.limit) * 100);
        const left = row.limit - row.spent;
        return (
          <div className="mk-meter-row" key={row.name}>
            <div className="mk-meter-head">
              <span>{row.name}</span>
              <small>
                {left >= 0 ? t.budgetLeft.replace("{amount}", money(left).replace(/^R\$\s?/, "")) : `+${money(-left)}`} · {pct}%
              </small>
            </div>
            <div className="mk-meter">
              <i className={row.tone} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RecurringVisual({ locale, dict }: Props) {
  const t = dict.landing.panelCards;
  const money = (value: number) => formatCurrency(value, locale);
  return (
    <div className="mk-visual">
      <h4>{t.recurringTitle}</h4>
      <div className="mk-tx">
        <span className="mk-ico">
          <Icon name="repeat" size={18} />
        </span>
        <div className="who">
          <b>Streaming Plus</b>
          <small>{t.recurringUp}</small>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="amt">{money(39.9)}</div>
          <span className="mk-chip warn">+12%</span>
        </div>
      </div>
      <div className="mk-tx">
        <span className="mk-ico">
          <Icon name="repeat" size={18} />
        </span>
        <div className="who">
          <b>Música Já Premium</b>
          <small>{t.recurringPending}</small>
        </div>
        <div className="amt">{money(21.9)}</div>
      </div>
      <div className="mk-tx">
        <span className="mk-ico">
          <Icon name="repeat" size={18} />
        </span>
        <div className="who">
          <b>Plano Móvel Conecta</b>
          <small>{t.recurringPending}</small>
        </div>
        <div className="amt">{money(59.9)}</div>
      </div>
    </div>
  );
}
