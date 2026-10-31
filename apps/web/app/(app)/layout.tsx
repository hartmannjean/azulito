import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { getAccess } from "@/lib/access";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Casca do app: sidebar fixa + área de conteúdo em largura total. O
 * Cloudflare Access já barra quem não está logado antes de chegar aqui; o
 * `getAccess()` é defesa em profundidade (acesso que contorne o Access).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const access = await getAccess();

  if (!access) {
    return (
      <main className="center-notice">
        <p role="alert" className="form-error">
          {dict.auth.errors.notAuthenticated}
        </p>
      </main>
    );
  }

  const items: NavItem[] = [
    { href: "/dashboard", label: dict.nav.overview, icon: "▦" },
    { href: "/transactions", label: dict.nav.transactions, icon: "☰" },
    { href: "/budgets", label: dict.nav.budgets, icon: "◔" },
    { href: "/recurring", label: dict.nav.recurring, icon: "↻" },
    { href: "/accounts", label: dict.nav.accounts, icon: "⇪" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo />
        </div>
        <SidebarNav items={items} />
        <div className="sidebar-footer">
          {access.email ? <span className="sidebar-user">{access.email}</span> : null}
          <div className="sidebar-actions">
            <LanguageToggle
              locale={locale}
              switchToEnglishLabel={dict.common.switchToEnglish}
              switchToPortugueseLabel={dict.common.switchToPortuguese}
            />
            <ThemeToggle label={dict.common.toggleTheme} />
            <a href="/cdn-cgi/access/logout" className="button secondary small">
              {dict.dashboard.logout}
            </a>
          </div>
        </div>
      </aside>
      <div className="app-main">{children}</div>
    </div>
  );
}
