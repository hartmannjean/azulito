import { TransactionTable } from "@/components/transaction-table";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import { formatCurrency } from "@/lib/format";
import { groupByCategory } from "@/lib/group-transactions";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import type { Transaction } from "@azulito/shared";

/**
 * Extrato agrupado por categoria. Cada grupo é um <details>: abre e fecha sem
 * JavaScript, funciona com teclado e leitor de tela. Dentro dele vai a mesma
 * tabela da lista, então dá para recategorizar ali mesmo.
 */
export function CategoryGroups({
  transactions,
  locale,
  dict,
  readOnly,
  customCategories,
}: {
  transactions: Transaction[];
  locale: Locale;
  dict: Dictionary;
  readOnly: boolean;
  customCategories: string[];
}) {
  const t = dict.txPage;
  if (transactions.length === 0) return <p className="empty-state">{t.empty}</p>;

  const groups = groupByCategory(transactions);
  const totalSpend = groups.reduce((sum, group) => sum + group.spend, 0);
  const currency = transactions[0]?.currency_code;

  return (
    <div className="cat-groups">
      {groups.map((group) => {
        const name = group.category ? (translateCategory(group.category, locale) ?? group.category) : t.others;
        const icon = (group.category ? getCategoryIcon(group.category) : null) ?? "🗂️";
        const counted = group.spend > 0 || group.income > 0;
        const net = group.income - group.spend;
        const share = totalSpend > 0 && group.spend > 0 ? `${Math.round((group.spend / totalSpend) * 100)}%` : null;
        return (
          <details key={group.category ?? "__none__"} className="cat-group">
            <summary>
              <span className="cat-group-icon" aria-hidden="true">
                {icon}
              </span>
              <span className="cat-group-main">
                <strong>{name}</strong>
                <span className="cat-group-meta">
                  {t.groupCount(group.items.length)}
                  {share ? ` · ${t.groupShare(share)}` : ""}
                </span>
                {share ? (
                  <span className="cat-group-bar" aria-hidden="true">
                    <span style={{ width: share }} />
                  </span>
                ) : null}
              </span>
              <span className={`cat-group-total ${counted ? (net < 0 ? "negative" : "positive") : "muted-cell"}`}>
                {formatCurrency(counted ? net : group.all, locale, currency)}
              </span>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="cat-group-chevron">
                <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <TransactionTable
              transactions={group.items}
              locale={locale}
              dict={dict.txPage}
              readOnly={readOnly}
              customCategories={customCategories}
            />
          </details>
        );
      })}
    </div>
  );
}
