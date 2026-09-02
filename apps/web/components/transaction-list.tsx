import type { Transaction } from "@azulito/shared";
import { formatCurrency, formatDate } from "@/lib/format";

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <p className="empty-state">
        Nenhuma transação ainda. Conecte sua conta do Nubank para começar a
        ver seus dados aqui.
      </p>
    );
  }

  return (
    <ul className="transaction-list">
      {transactions.map((transaction) => (
        <li key={transaction.id} className="transaction-item">
          <div>
            <div>{transaction.description}</div>
            <div className="transaction-meta">
              {formatDate(transaction.transaction_date)}
              {transaction.category ? ` · ${transaction.category}` : ""}
            </div>
          </div>
          <div
            className={`transaction-amount ${transaction.amount < 0 ? "negative" : "positive"}`}
          >
            {formatCurrency(transaction.amount, transaction.currency_code)}
          </div>
        </li>
      ))}
    </ul>
  );
}
