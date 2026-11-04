import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

/** Casca do app: sidebar fixa + área de conteúdo em largura total. */
export function AppShell({
  email,
  locale,
  dict,
  children,
  demo = false,
}: {
  email: string | null;
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
  demo?: boolean;
}) {
  const base = demo ? "/demo" : "/dash";
  const short = dict.nav.short;
  const items: NavItem[] = [
    { href: base, label: dict.nav.overview, short: short.overview, icon: "▦", exact: true },
    { href: `${base}/transactions`, label: dict.nav.transactions, short: short.transactions, icon: "☰" },
    { href: `${base}/budgets`, label: dict.nav.budgets, short: short.budgets, icon: "◔" },
    { href: `${base}/categories`, label: dict.nav.categories, short: short.categories, icon: "#" },
    { href: `${base}/recurring`, label: dict.nav.recurring, short: short.recurring, icon: "↻" },
    { href: `${base}/accounts`, label: dict.nav.accounts, short: short.accounts, icon: "⇪" },
  ];

  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">
        {dict.common.skipToContent}
      </a>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo />
        </div>
        <SidebarNav items={items} label={dict.nav.label} />
        <div className="sidebar-footer">
          {demo ? <span className="sidebar-user">{dict.demo.badge}</span> : null}
          {!demo && email ? <span className="sidebar-user">{email}</span> : null}
          <div className="sidebar-actions">
            <LanguageToggle
              locale={locale}
              switchToEnglishLabel={dict.common.switchToEnglish}
              switchToPortugueseLabel={dict.common.switchToPortuguese}
            />
            <ThemeToggle label={dict.common.toggleTheme} />
            {demo ? (
              <a href="/dash" className="button secondary small">
                {dict.landing.login}
              </a>
            ) : (
              <a href="/cdn-cgi/access/logout" className="button secondary small">
                {dict.dashboard.logout}
              </a>
            )}
          </div>
        </div>
      </aside>
      <div className="app-main" id="conteudo" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
