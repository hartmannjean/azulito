"use client";

import { useState, useTransition } from "react";
import type { ImportDetails } from "@azulito/shared";
import { loadImportDetailsAction } from "@/app/(app)/actions";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import type { Locale } from "@/lib/i18n/locale";

export type ImportDetailsLabels = {
  view: string;
  hide: string;
  loading: string;
  error: string;
  /** Textos com marcadores ({start}, {end}, {count}, {income}, {expenses}); funções não atravessam Server -> Client. */
  period: string;
  totals: string;
  excluded: string;
  notInApp: string;
  uncategorized: string;
  truncated: string;
  columns: { date: string; description: string; category: string; amount: string };
};

/** Abre/fecha o conteúdo de um arquivo OFX importado (relido do arquivo original). */
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{([a-z]+)\}/g, (_, key: string) => String(values[key] ?? ""));

export function ImportDetailsToggle({
  id,
  locale,
  labels,
}: {
  id: string;
  locale: Locale;
  labels: ImportDetailsLabels;
}) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<ImportDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (details) return;
    setFailed(false);
    startTransition(async () => {
      const result = await loadImportDetailsAction(id);
      if (result) setDetails(result);
      else setFailed(true);
    });
  }

  return (
    <div className="import-details">
      <button type="button" className="button secondary small" onClick={toggle} aria-expanded={open}>
        {open ? labels.hide : labels.view}
      </button>
      {open ? (
        <div className="import-body">
          {pending ? <p className="muted-cell">{labels.loading}</p> : null}
          {failed ? (
            <p role="alert" className="form-error">
              {labels.error}
            </p>
          ) : null}
          {details ? (
            <>
              <p className="muted-cell block">
                {details.period_start && details.period_end
                  ? `${fill(labels.period, { start: formatDate(details.period_start, locale), end: formatDate(details.period_end, locale) })} · `
                  : ""}
                {fill(labels.totals, {
                  count: details.total,
                  income: formatCurrency(details.income, locale),
                  expenses: formatCurrency(details.expenses, locale),
                })}
              </p>
              <div className="table-scroll">
                <table className="tx-table plain-table">
                  <thead>
                    <tr>
                      <th>{labels.columns.date}</th>
                      <th>{labels.columns.description}</th>
                      <th>{labels.columns.category}</th>
                      <th className="num">{labels.columns.amount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.transactions.map((tx, index) => (
                      <tr key={`${tx.date}-${index}`} className={tx.excluded || !tx.in_app ? "excluded" : undefined}>
                        <td className="nowrap">{formatDate(tx.date, locale)}</td>
                        <td className="tx-desc">
                          <span title={tx.description}>{tx.description}</span>
                          {tx.excluded ? <span className="chip muted">{labels.excluded}</span> : null}
                          {!tx.in_app ? <span className="chip muted">{labels.notInApp}</span> : null}
                        </td>
                        <td className="nowrap muted-cell">
                          {tx.category
                            ? `${getCategoryIcon(tx.category) ?? ""} ${translateCategory(tx.category, locale) ?? tx.category}`.trim()
                            : labels.uncategorized}
                        </td>
                        <td className={`num nowrap ${tx.amount < 0 ? "negative" : "positive"}`}>
                          {formatCurrency(tx.amount, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {details.truncated ? <p className="muted-cell">{labels.truncated}</p> : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
