import type { Transaction } from "@azulito/shared";
import { formatCurrency, formatDate } from "@/lib/format";

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return <p className="empty-state">Nenhuma transação neste mês.</p>;
  }

  return (
    <ul className="transaction-list">
      {transactions.map((transaction) => {
        const isNegative = transaction.amount < 0;
        return (
          <li key={transaction.id} className="transaction-item">
            <span className={`transaction-avatar ${isNegative ? "negative" : "positive"}`} aria-hidden="true">
              {transaction.description.charAt(0).toUpperCase()}
            </span>
            <div className="transaction-info">
              <span className="transaction-description">{transaction.description}</span>
              <span className="transaction-meta">
                {formatDate(transaction.transaction_date)}
                {transaction.category ? (
                  <span className="transaction-category">{transaction.category}</span>
                ) : null}
              </span>
            </div>
            <span className={`transaction-amount ${isNegative ? "negative" : "positive"}`}>
              {formatCurrency(transaction.amount, transaction.currency_code)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
