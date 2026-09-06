import type { CategoryBreakdown as CategoryBreakdownItem } from "@azulito/shared";
import { formatCurrency } from "@/lib/format";

const COLORS = ["#4f8dfd", "#3ecf8e", "#ff6b6b", "#f7b955", "#b98af7", "#4fd1c5"];

export function CategoryBreakdown({ categories }: { categories: CategoryBreakdownItem[] }) {
  return (
    <section className="chart-card">
      <h2 className="chart-heading">Maiores gastos do mês</h2>
      {categories.length === 0 ? (
        <p className="empty-state">Nenhuma despesa neste mês.</p>
      ) : (
        <ul className="category-bars">
          {categories.slice(0, 6).map((item, index) => (
            <li key={item.category} className="category-bar-row">
              <div className="category-bar-label">
                <span>{item.category}</span>
                <span className="category-bar-value">{formatCurrency(item.total)}</span>
              </div>
              <div className="category-bar-track">
                <div
                  className="category-bar-fill"
                  style={{ width: `${item.percentage}%`, background: COLORS[index % COLORS.length] }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
