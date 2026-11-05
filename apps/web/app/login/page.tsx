import Link from "next/link";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PublicHeader } from "@/components/public-header";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Página PÚBLICA de entrada e cadastro (a conta é criada no primeiro login por
 * código de e-mail). Quem já tem sessão válida vai direto para o painel.
 */
export default async function LoginPage() {
  if (await getSession()) redirect("/dash");

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.signIn;

  // A chave pública do Turnstile fica em `vars` do wrangler (não é segredo).
  let siteKey = process.env.TURNSTILE_SITE_KEY;
  if (!siteKey) {
    try {
      siteKey = (getCloudflareContext().env as { TURNSTILE_SITE_KEY?: string }).TURNSTILE_SITE_KEY;
    } catch {
      // Fora do runtime da Cloudflare.
    }
  }

  return (
    <div className="landing">
      <PublicHeader locale={locale} dict={dict} />

      <main className="center-notice">
        <div className="chart-card">
          <h1>{t.heading}</h1>
          <p>{t.intro}</p>
          {siteKey ? (
            <LoginForm
              siteKey={siteKey}
              labels={{
                emailLabel: t.emailLabel,
                sendCode: t.sendCode,
                sending: t.sending,
                codeLabel: t.codeLabel,
                codeSent: t.codeSent("{email}"),
                verify: t.verify,
                verifying: t.verifying,
                useAnotherEmail: t.useAnotherEmail,
                passkey: t.passkey,
                or: t.or,
                humanCheck: t.humanCheck,
                errors: t.errors,
              }}
            />
          ) : (
            <p role="alert" className="form-error">
              {t.errors.captcha}
            </p>
          )}
          <p>
            <Link href="/">{t.home}</Link> · <Link href="/privacidade">{dict.common.privacy}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
