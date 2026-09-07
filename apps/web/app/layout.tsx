import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import "./globals.css";

// Auto-hospedada pelo Next no build (sem request pra Google em runtime) —
// mantém a política de não carregar recursos externos no client.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return {
    title: "Azulito",
    description: dict.common.appDescription,
  };
}

// Script inline pra aplicar o tema salvo ANTES do primeiro paint (evita
// flash de tema errado). Precisa do nonce da CSP (gerado por request em
// `proxy.ts`/`lib/csp.ts`) porque `script-src` não tem `unsafe-inline`.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('azulito-theme');var t=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [nonce, locale] = await Promise.all([
    headers().then((store) => store.get("x-nonce") ?? undefined),
    getLocale(),
  ]);

  return (
    <html lang={locale} className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
