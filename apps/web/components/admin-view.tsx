import Link from "next/link";
import { NavIconGlyph, type NavIcon } from "@/components/nav-icons";
import type { Dictionary } from "@/lib/i18n/dictionary";

/** Painel de administração: porta de entrada para orçamentos, categorias, contas, histórico e conta. */
export function AdminView({ base, dict, demo = false }: { base: string; dict: Dictionary; demo?: boolean }) {
  const cards: { href: string; icon: NavIcon; title: string; text: string }[] = [
    { href: `${base}/budgets`, icon: "target", title: dict.nav.budgets, text: dict.adminPage.cards.budgets },
    { href: `${base}/categories`, icon: "tag", title: dict.nav.categories, text: dict.adminPage.cards.categories },
    { href: `${base}/accounts`, icon: "wallet", title: dict.nav.accounts, text: dict.adminPage.cards.accounts },
    ...(demo
      ? []
      : [
          { href: `${base}/history`, icon: "history" as const, title: dict.nav.history, text: dict.adminPage.cards.history },
          { href: `${base}/account`, icon: "user" as const, title: dict.adminPage.account, text: dict.adminPage.cards.account },
        ]),
  ];

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{dict.adminPage.title}</h1>
          <p className="page-subtitle">{dict.adminPage.subtitle}</p>
        </div>
      </header>

      <ul className="admin-grid">
        {cards.map((card) => (
          <li key={card.href}>
            <Link href={card.href} className="admin-card">
              <span className="admin-card-icon" aria-hidden="true">
                <NavIconGlyph name={card.icon} />
              </span>
              <span className="admin-card-body">
                <strong>{card.title}</strong>
                <span>{card.text}</span>
              </span>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="admin-card-chevron">
                <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
