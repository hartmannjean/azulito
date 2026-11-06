import { CATEGORIES, type UserCategory } from "@azulito/shared";
import { AdminBack } from "@/components/admin-back";
import { CategoryForm, RemoveCategoryButton } from "@/components/category-manager";
import { RenameCategory } from "@/components/rename-category";
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
      <AdminBack href={demo ? "/demo/admin" : "/dash/admin"} label={dict.nav.admin} />
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
                      <span className="mini-row-actions">
                        <RenameCategory
                          key={category.id + category.name}
                          id={category.id}
                          name={category.name}
                          labels={{ rename: t.rename, save: t.save, cancel: t.cancel }}
                        />
                        <RemoveCategoryButton id={category.id} label={t.remove} confirmLabel={t.removeHint} />
                      </span>
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
          </section>

          <section className="chart-card cat-fixed">
            <h2 className="chart-heading">{t.fixedHeading}</h2>
            <ul className="cat-tiles">
              {CATEGORIES.map((category) => (
                <li key={category} className="cat-tile">
                  <span className="cat-tile-icon" aria-hidden="true">
                    {getCategoryIcon(category)}
                  </span>
                  <span>{translateCategory(category, locale)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
