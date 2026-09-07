import type { Transaction } from "@azulito/shared";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

export function TransactionList({
  transactions,
  locale,
  dict,
}: {
  transactions: Transaction[];
  locale: Locale;
  dict: Dictionary["transactions"];
}) {
  if (transactions.length === 0) {
    return <p className="empty-state">{dict.empty}</p>;
  }

  return (
    <ul className="transaction-list">
      {transactions.map((transaction) => {
        const isNegative = transaction.amount < 0;
        const icon = getCategoryIcon(transaction.category);
        return (
          <li key={transaction.id} className="transaction-item">
            <span className={`transaction-avatar ${isNegative ? "negative" : "positive"}`} aria-hidden="true">
              {icon ?? transaction.description.charAt(0).toUpperCase()}
            </span>
            <div className="transaction-info">
              <span className="transaction-description">{transaction.description}</span>
              <span className="transaction-meta">
                {formatDate(transaction.transaction_date, locale)}
                {transaction.category ? (
                  <span className="transaction-category">{translateCategory(transaction.category, locale)}</span>
                ) : null}
              </span>
            </div>
            <span className={`transaction-amount ${isNegative ? "negative" : "positive"}`}>
              {formatCurrency(transaction.amount, locale, transaction.currency_code)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
