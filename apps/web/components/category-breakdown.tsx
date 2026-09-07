import type { CategoryBreakdown as CategoryBreakdownItem } from "@azulito/shared";
import { formatCurrency } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

const COLORS = [
  "#2dd4bf",
  "#ff7a59",
  "#f5c26b",
  "#5b8fa8",
  "#8fd6c1",
  "#c97b63",
];

export function CategoryBreakdown({
  categories,
  locale,
  dict,
}: {
  categories: CategoryBreakdownItem[];
  locale: Locale;
  dict: Dictionary["categories"];
}) {
  return (
    <section className="chart-card">
      <h2 className="chart-heading">{dict.heading}</h2>
      {categories.length === 0 ? (
        <p className="empty-state">{dict.empty}</p>
      ) : (
        <ul className="category-bars">
          {categories.slice(0, 6).map((item, index) => (
            <li key={item.category} className="category-bar-row">
              <div className="category-bar-label">
                <span>
                  <span className="category-icon" aria-hidden="true">
                    {getCategoryIcon(item.category)}
                  </span>
                  {translateCategory(item.category, locale)}
                </span>
                <span className="category-bar-value">{formatCurrency(item.total, locale)}</span>
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
