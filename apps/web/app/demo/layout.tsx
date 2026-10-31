import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Demonstração PÚBLICA (fora do Cloudflare Access): só mostra dados
 * fictícios de `lib/demo-data.ts`. Nenhuma página aqui lê a API, o banco ou
 * a identidade do usuário.
 */
export default async function DemoLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <AppShell email={null} locale={locale} dict={dict} demo>
      <div className="demo-banner" role="note">
        <span>{dict.demo.banner}</span>
        <a href="/dashboard" className="button small">
          {dict.landing.login}
        </a>
      </div>
      {children}
    </AppShell>
  );
}
