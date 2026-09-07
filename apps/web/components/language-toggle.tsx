"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/locale";

/**
 * Troca o cookie de idioma e força um refresh — o idioma é lido nos Server
 * Components (`getLocale()`), então só um `router.refresh()` faz o resto da
 * árvore recarregar com o dicionário certo, sem precisar de contexto de
 * React nem duplicar o dicionário inteiro no client.
 */
export function LanguageToggle({
  locale,
  switchToEnglishLabel,
  switchToPortugueseLabel,
}: {
  locale: Locale;
  switchToEnglishLabel: string;
  switchToPortugueseLabel: string;
}) {
  const router = useRouter();
  const isPortuguese = locale === "pt-BR";

  function toggle() {
    const next: Locale = isPortuguese ? "en" : "pt-BR";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <button
      type="button"
      className="theme-toggle lang-toggle"
      onClick={toggle}
      aria-label={isPortuguese ? switchToEnglishLabel : switchToPortugueseLabel}
    >
      {isPortuguese ? "EN" : "PT"}
    </button>
  );
}
