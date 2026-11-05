import type { Transaction } from "@azulito/shared";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import { CategorySelect } from "@/components/category-select";
import { CategoryOptionsProvider } from "@/components/category-options-context";
import { ReferenceMonthSelect } from "@/components/reference-month-select";
import { buildCategoryOptions } from "@/lib/category-options";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

/** Tabela de transações em largura total, com edição de categoria por linha. */
export function TransactionTable({
  transactions,
  locale,
  dict,
  readOnly = false,
  customCategories = [],
}: {
  transactions: Transaction[];
  customCategories?: string[];
  locale: Locale;
  dict: Dictionary["txPage"];
  readOnly?: boolean;
}) {
  if (transactions.length === 0) {
    return <p className="empty-state">{dict.empty}</p>;
  }

  const options = buildCategoryOptions(locale, customCategories);

  const sourceLabel = { ai: dict.sourceAi, rule: dict.sourceRule, user: dict.sourceUser } as const;

  return (
    <CategoryOptionsProvider options={options}>
    <div className="table-scroll">
      <table className="tx-table" role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader">{dict.columns.date}</th>
            <th role="columnheader">{dict.columns.description}</th>
            <th role="columnheader">{dict.columns.account}</th>
            <th role="columnheader">{dict.columns.category}</th>
            <th role="columnheader">{dict.columns.refMonth}</th>
            <th role="columnheader" className="num">
              {dict.columns.amount}
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {transactions.map((tx) => (
            <tr key={tx.id} role="row" className={tx.excluded ? "excluded" : undefined}>
              <td role="cell" className="nowrap tx-date">{formatDate(tx.transaction_date, locale)}</td>
              <td role="cell" className="tx-desc">
                <span title={tx.description}>{tx.description}</span>
                {tx.excluded ? <span className="chip muted">{dict.excluded}</span> : null}
              </td>
              <td role="cell" className="nowrap muted-cell tx-account">
                {tx.institution_name}
              </td>
              <td role="cell" className="tx-cat">
                {readOnly ? (
                  <span className="category-static">
                    {tx.category
                      ? `${getCategoryIcon(tx.category) ?? ""} ${translateCategory(tx.category, locale) ?? tx.category}`.trim()
                      : dict.uncategorized}
                  </span>
                ) : (
                  <CategorySelect
                    key={`${tx.id}:${tx.category ?? ""}`}
                    transactionId={tx.id}
                    current={tx.category}
                    uncategorizedLabel={dict.uncategorized}
                    errorLabel={dict.categoryError}
                  />
                )}
                {!readOnly && tx.category_source ? (
                  <span className={`chip source-${tx.category_source}`}>{sourceLabel[tx.category_source]}</span>
                ) : null}
              </td>
              <td role="cell" className="nowrap tx-ref">
                {readOnly || tx.excluded ? (
                  <span className="muted-cell">{formatMonthLabel(tx.effective_month, locale)}</span>
                ) : (
                  <ReferenceMonthSelect
                    key={`${tx.id}:${tx.reference_month ?? ""}:${tx.effective_month}`}
                    transactionId={tx.id}
                    effectiveMonth={tx.effective_month}
                    referenceMonth={tx.reference_month}
                    locale={locale}
                    autoLabel={dict.refAuto(formatMonthLabel(tx.effective_month, locale))}
                    autoPlainLabel={dict.refAutoPlain}
                    errorLabel={dict.refError}
                  />
                )}
              </td>
              <td role="cell" className={`num nowrap tx-amount-cell ${tx.amount < 0 ? "negative" : "positive"}`}>
                {formatCurrency(tx.amount, locale, tx.currency_code)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </CategoryOptionsProvider>
  );
}
