import Link from "next/link";
import { shiftMonth } from "@/lib/format";
import { dateFormat } from "@/lib/intl-cache";
import type { Locale } from "@/lib/i18n/locale";

function parts(month: string, locale: Locale) {
  const date = new Date(`${month}-01T00:00:00Z`);
  return {
    name: dateFormat(locale, { month: "long", timeZone: "UTC" }).format(date),
    short: dateFormat(locale, { month: "short", timeZone: "UTC" }).format(date).replace(".", ""),
    year: dateFormat(locale, { year: "numeric", timeZone: "UTC" }).format(date),
  };
}

const MONTHS_BACK = 11;

/**
 * Seletor de mês: setas, mês em destaque, atalho "mês atual" e uma grade para
 * pular direto a um dos últimos meses (<details>, sem JavaScript). Em
 * demonstração (`navigable={false}`) tudo fica desligado.
 */
export function MonthNav({
  month,
  basePath,
  locale,
  labels,
  navigable = true,
}: {
  month: string;
  /** "/dash" ou "/dash/budgets": o destino leva `?month=AAAA-MM`. */
  basePath: string;
  locale: Locale;
  labels: { previous: string; next: string; current: string; pick: string };
  navigable?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 7);
  const href = (target: string) => `${basePath}?month=${target}`;
  const shown = parts(month, locale);
  const choices = Array.from({ length: MONTHS_BACK + 2 }, (_, index) => shiftMonth(today, index - MONTHS_BACK));
  const years = Array.from(new Set(choices.map((choice) => choice.slice(0, 4))));

  return (
    <div className="mnav">
      <div className={`mnav-pill${navigable ? "" : " disabled"}`}>
        <Link href={href(shiftMonth(month, -1))} className="mnav-arrow" aria-label={labels.previous} aria-disabled={!navigable}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <details className="mnav-pick">
          <summary aria-label={labels.pick}>
            <span className="mnav-name">{shown.name}</span>
            <span className="mnav-year">{shown.year}</span>
          </summary>
          {navigable ? (
            <div className="mnav-pop">
              {years.map((year) => (
                <div key={year}>
                  <span className="mnav-pop-year">{year}</span>
                  <div className="mnav-grid">
                    {choices
                      .filter((choice) => choice.startsWith(year))
                      .map((choice) => (
                        <Link
                          key={choice}
                          href={href(choice)}
                          className={`mnav-cell${choice === month ? " selected" : ""}${choice === today ? " today" : ""}`}
                        >
                          {parts(choice, locale).short}
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </details>

        <Link href={href(shiftMonth(month, 1))} className="mnav-arrow" aria-label={labels.next} aria-disabled={!navigable}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {navigable && month !== today ? (
        <Link href={href(today)} className="mnav-today">
          {labels.current}
        </Link>
      ) : null}
    </div>
  );
}
