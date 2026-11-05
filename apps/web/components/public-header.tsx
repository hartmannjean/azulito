import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

/** Cabeçalho das páginas públicas (login e política de privacidade). */
export function PublicHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="landing-header">
      <Logo />
      <div className="landing-header-actions">
        <LanguageToggle
          locale={locale}
          switchToEnglishLabel={dict.common.switchToEnglish}
          switchToPortugueseLabel={dict.common.switchToPortuguese}
        />
        <ThemeToggle label={dict.common.toggleTheme} />
      </div>
    </header>
  );
}
