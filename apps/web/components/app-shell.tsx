import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
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
  // Orçamentos, categorias, contas e histórico ficam dentro da administração: um item só
  // no menu principal (e na barra de baixo do celular) em vez de oito.
  const admin: NavItem[] = [
    { href: `${base}/budgets`, label: dict.nav.budgets, short: short.budgets, icon: "target", child: true },
    { href: `${base}/categories`, label: dict.nav.categories, short: short.categories, icon: "tag", child: true },
    { href: `${base}/accounts`, label: dict.nav.accounts, short: short.accounts, icon: "wallet", child: true },
    ...(demo
      ? []
      : [{ href: `${base}/history`, label: dict.nav.history, short: short.history, icon: "history" as const, child: true }]),
  ];
  const items: NavItem[] = [
    { href: base, label: dict.nav.overview, short: short.overview, icon: "home", exact: true },
    { href: `${base}/transactions`, label: dict.nav.transactions, short: short.transactions, icon: "list" },
    { href: `${base}/savings`, label: dict.nav.savings, short: short.savings, icon: "piggy" },
    { href: `${base}/recurring`, label: dict.nav.recurring, short: short.recurring, icon: "repeat" },
    {
      href: `${base}/admin`,
      label: dict.nav.admin,
      short: short.admin,
      icon: "sliders",
      hub: true,
      alsoActive: [...admin.map((item) => item.href), ...(demo ? [] : [`${base}/account`])],
    },
    ...admin,
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
        <SidebarNav items={items} label={dict.nav.label} moreLabel={dict.nav.more} />
        <div className="sidebar-footer">
          {demo ? <span className="sidebar-user">{dict.demo.badge}</span> : null}
          {!demo && email ? (
            <Link href="/dash/account" className="sidebar-user">
              {email}
            </Link>
          ) : null}
          <div className="sidebar-actions">
            <LanguageToggle
              locale={locale}
              switchToEnglishLabel={dict.common.switchToEnglish}
              switchToPortugueseLabel={dict.common.switchToPortuguese}
            />
            <ThemeToggle label={dict.common.toggleTheme} />
            {demo ? (
              <a href="/dash" className="button secondary small demo-login">
                {dict.landing.login}
              </a>
            ) : (
              <SignOutButton label={dict.dashboard.logout} />
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
