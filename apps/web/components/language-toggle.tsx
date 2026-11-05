"use client";

import { useRouter } from "next/navigation";
import { FlagBR, FlagUS } from "@/components/flags";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/locale";

/**
 * Dois botões com bandeira: escolhe o idioma direto. Troca o cookie de idioma e
 * força um refresh — o idioma é lido nos Server Components (`getLocale()`), então
 * só um `router.refresh()` faz o resto da árvore recarregar com o dicionário
 * certo, sem precisar de contexto de React nem duplicar o dicionário no client.
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

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="theme-toggle lang-toggle" role="group" aria-label="Idioma / Language">
      <button
        type="button"
        className={`lang-option${locale === "pt-BR" ? " active" : ""}`}
        onClick={() => choose("pt-BR")}
        aria-pressed={locale === "pt-BR"}
        aria-label={switchToPortugueseLabel}
        title="Português (Brasil)"
      >
        <FlagBR />
      </button>
      <button
        type="button"
        className={`lang-option${locale === "en" ? " active" : ""}`}
        onClick={() => choose("en")}
        aria-pressed={locale === "en"}
        aria-label={switchToEnglishLabel}
        title="English"
      >
        <FlagUS />
      </button>
    </div>
  );
}
