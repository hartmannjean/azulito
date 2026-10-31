import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getAccess } from "@/lib/access";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * O Cloudflare Access já barra quem não está logado antes de chegar aqui; o
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

  return (
    <AppShell email={access.email} locale={locale} dict={dict}>
      {children}
    </AppShell>
  );
}
