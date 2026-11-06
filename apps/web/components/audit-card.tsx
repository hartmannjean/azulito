import Link from "next/link";
import type { AuditItem, AuditResult } from "@azulito/shared";
import { AiButton } from "@/components/ai-button";
import { AiSays } from "@/components/ai-says";
import { AiHelp } from "@/components/ai-help";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

/**
 * Revisão do mês pela IA: confere se os números do dashboard fazem sentido.
 * Os achados vêm de verificações em código; a IA dá o parecer e aponta
 * transações suspeitas. É só leitura — nada é alterado sozinho.
 */
export function AuditCard({
  audit,
  month,
  transactionsPath,
  locale,
  dict,
  demo = false,
}: {
  demo?: boolean;
  audit: AuditResult | null;
  month: string;
  /** "/dash/transactions": cada item abre a lista já filtrada pela descrição. */
  transactionsPath: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.audit;
  const sameMonth = audit?.month === month;

  const itemRow = (item: AuditItem) => (
    <li key={`${item.id}-${item.reason ?? ""}`} className="audit-item">
      <div>
        <Link
          href={`${transactionsPath}?month=${audit?.month ?? month}&q=${encodeURIComponent(item.description.slice(0, 30))}&excluded=1`}
          className="card-link"
        >
          {item.description}
        </Link>
        <span className="muted-cell"> · {formatDate(item.date, locale)}</span>
        {item.reason ? <p className="muted-cell block">{item.reason}</p> : null}
      </div>
      <span className={`nowrap ${item.amount < 0 ? "negative" : "positive"}`}>{formatCurrency(item.amount, locale)}</span>
    </li>
  );

  return (
    <section className="chart-card">
      <h2 className="chart-heading">{t.heading}</h2>
      <AiHelp label={dict.common.howItWorks}>{t.help}</AiHelp>

      {audit ? (
        <>
          <p className="muted-cell block">
            {t.reviewed(formatMonthLabel(audit.month, locale), formatDate(audit.created_at, locale))}
            {sameMonth ? "" : ` ${t.otherMonth}`}
          </p>
          <AiSays moreLabel={dict.common.readMore} lessLabel={dict.common.readLess}>
            <p className="insight-text">{audit.verdict}</p>
          </AiSays>

          {audit.ai_items.length > 0 ? (
            <>
              <h3 className="audit-sub">{t.aiItems}</h3>
              <ul className="audit-list">{audit.ai_items.map(itemRow)}</ul>
            </>
          ) : null}

          {audit.findings.length > 0 ? (
            <>
              <h3 className="audit-sub">{t.checks}</h3>
              {audit.findings.map((finding) => (
                <details key={finding.type} className="audit-finding">
                  <summary>{finding.title}</summary>
                  <p className="muted-cell block">{finding.detail}</p>
                  {finding.items.length > 0 ? <ul className="audit-list">{finding.items.map(itemRow)}</ul> : null}
                </details>
              ))}
            </>
          ) : (
            <p className="muted-cell block">{t.noFindings}</p>
          )}
        </>
      ) : (
        <p className="muted-cell block">{t.none}</p>
      )}

      {demo ? (
        <button type="button" className="button" disabled title={dict.demo.disabledHint}>
          {t.refresh(formatMonthLabel(month, locale))}
        </button>
      ) : (
        <AiButton
          kind="audit"
          month={month}
          label={audit ? t.refresh(formatMonthLabel(month, locale)) : t.button(formatMonthLabel(month, locale))}
          runningLabel={t.running}
          errorLabel={t.failed}
        />
      )}
    </section>
  );
}
