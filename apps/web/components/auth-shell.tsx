import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import "@/app/marketing.css";

/**
 * Tela dividida de entrar e criar conta: à esquerda uma prévia do sistema (dados
 * FICTÍCIOS da demonstração), à direita o formulário. No celular só o formulário.
 */
export function AuthShell({
  locale,
  dict,
  panelTitle,
  panelText,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  panelTitle: string;
  panelText: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-split">
      <aside className="auth-aside">
        <Link href="/" className="auth-aside-brand" aria-label="Azulito">
          <Logo />
        </Link>
        <div className="auth-aside-text">
          <h2>{panelTitle}</h2>
          <p>{panelText}</p>
        </div>
        <ProductShowcase locale={locale} dict={dict} compact />
      </aside>

      <div className="auth-main">
        <div className="auth-main-top">
          <Link href="/" className="auth-logo" aria-label="Azulito">
            <Logo />
          </Link>
          <div className="auth-main-actions">
            <LanguageToggle
              locale={locale}
              switchToEnglishLabel={dict.common.switchToEnglish}
              switchToPortugueseLabel={dict.common.switchToPortuguese}
            />
            <ThemeToggle label={dict.common.toggleTheme} />
          </div>
        </div>
        <main className="auth-main-body">
          <div className="auth-card">{children}</div>
        </main>
      </div>
    </div>
  );
}
