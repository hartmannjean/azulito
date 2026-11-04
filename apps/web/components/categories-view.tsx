import { CATEGORIES, type UserCategory } from "@azulito/shared";
import { CategoryForm, RemoveCategoryButton } from "@/components/category-manager";
import { getCategoryIcon } from "@/lib/category-icons";
import { translateCategory } from "@/lib/i18n/category-names";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

/** Categorias próprias (criar/remover) + lista das fixas; só apresentação. */
export function CategoriesView({
  categories,
  locale,
  dict,
  loadError = false,
  demo = false,
}: {
  categories: UserCategory[];
  locale: Locale;
  dict: Dictionary;
  loadError?: boolean;
  demo?: boolean;
}) {
  const t = dict.categoriesPage;

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.nav.categories}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
      </header>

      {loadError ? (
        <p role="alert" className="form-error">
          {dict.dashboard.loadError}
        </p>
      ) : (
        <div className="grid-main">
          <section className="chart-card">
            <h2 className="chart-heading">{t.ownHeading}</h2>
            {categories.length > 0 ? (
              <ul className="mini-list">
                {categories.map((category) => (
                  <li key={category.id} className="mini-row">
                    <span className="mini-row-label">🏷️ {category.name}</span>
                    {demo ? null : (
                      <RemoveCategoryButton id={category.id} label={t.remove} confirmLabel={t.removeHint} />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state compact">{t.empty}</p>
            )}
            <p className="muted-cell">{t.help}</p>
          </section>

          <section className="chart-card">
            <h2 className="chart-heading">{t.createHeading}</h2>
            {demo ? (
              <p className="empty-state compact">{dict.demo.disabledHint}</p>
            ) : (
              <CategoryForm labels={{ name: t.name, create: t.create }} />
            )}
            <h2 className="chart-heading">{t.fixedHeading}</h2>
            <ul className="chip-list">
              {CATEGORIES.map((category) => (
                <li key={category} className="chip">
                  {getCategoryIcon(category)} {translateCategory(category, locale)}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
