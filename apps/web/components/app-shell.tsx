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
  const base = demo ? "/demo" : "";
  const items: NavItem[] = [
    { href: demo ? "/demo" : "/dashboard", label: dict.nav.overview, icon: "▦", exact: demo },
    { href: `${base}/transactions`, label: dict.nav.transactions, icon: "☰" },
    { href: `${base}/budgets`, label: dict.nav.budgets, icon: "◔" },
    { href: `${base}/recurring`, label: dict.nav.recurring, icon: "↻" },
    { href: `${base}/accounts`, label: dict.nav.accounts, icon: "⇪" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo />
        </div>
        <SidebarNav items={items} />
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
              <a href="/dashboard" className="button secondary small">
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
      <div className="app-main">{children}</div>
    </div>
  );
}
