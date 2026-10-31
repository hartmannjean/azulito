import type { Transaction } from "@azulito/shared";
import { CATEGORIES } from "@azulito/shared";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import { CategorySelect } from "@/components/category-select";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

/** Tabela de transações em largura total, com edição de categoria por linha. */
export function TransactionTable({
  transactions,
  locale,
  dict,
  readOnly = false,
}: {
  transactions: Transaction[];
  locale: Locale;
  dict: Dictionary["txPage"];
  readOnly?: boolean;
}) {
  if (transactions.length === 0) {
    return <p className="empty-state">{dict.empty}</p>;
  }

  const options = CATEGORIES.map((value) => ({
    value,
    label: `${getCategoryIcon(value) ?? ""} ${translateCategory(value, locale) ?? value}`.trim(),
  }));

  const sourceLabel = { ai: dict.sourceAi, rule: dict.sourceRule, user: dict.sourceUser } as const;

  return (
    <div className="table-scroll">
      <table className="tx-table">
        <thead>
          <tr>
            <th>{dict.columns.date}</th>
            <th>{dict.columns.description}</th>
            <th>{dict.columns.account}</th>
            <th>{dict.columns.category}</th>
            <th className="num">{dict.columns.amount}</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className={tx.excluded ? "excluded" : undefined}>
              <td className="nowrap">{formatDate(tx.transaction_date, locale)}</td>
              <td className="tx-desc">
                <span title={tx.description}>{tx.description}</span>
                {tx.excluded ? <span className="chip muted">{dict.excluded}</span> : null}
              </td>
              <td className="nowrap muted-cell">{tx.institution_name}</td>
              <td>
                {readOnly ? (
                  <span className="category-static">
                    {tx.category
                      ? `${getCategoryIcon(tx.category) ?? ""} ${translateCategory(tx.category, locale) ?? tx.category}`.trim()
                      : dict.uncategorized}
                  </span>
                ) : (
                  <CategorySelect
                    transactionId={tx.id}
                    current={tx.category}
                    options={options}
                    uncategorizedLabel={dict.uncategorized}
                    errorLabel={dict.categoryError}
                  />
                )}
                {!readOnly && tx.category_source ? (
                  <span className={`chip source-${tx.category_source}`}>{sourceLabel[tx.category_source]}</span>
                ) : null}
              </td>
              <td className={`num nowrap tx-amount-cell ${tx.amount < 0 ? "negative" : "positive"}`}>
                {formatCurrency(tx.amount, locale, tx.currency_code)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
