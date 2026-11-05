import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Página PÚBLICA de entrada. Só entra quem já tem conta (o login nunca cria conta;
 * criar é na página de cadastro). Quem já tem sessão válida vai direto ao painel.
 */
export default async function LoginPage() {
  if (await getSession()) redirect("/dash");

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.signIn;
  const siteKey = getTurnstileSiteKey();

  return (
    <AuthShell locale={locale} dict={dict} panelTitle={t.panelTitle} panelText={t.panelText}>
      <h1>{t.heading}</h1>
      <p className="lead">{t.intro}</p>

      {siteKey ? (
        <AuthForm
          mode="login"
          siteKey={siteKey}
          privacyHref="/privacidade"
          signupHref="/cadastro"
          labels={{
            nameLabel: dict.signUp.nameLabel,
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
            acceptPrefix: dict.signUp.acceptPrefix,
            acceptLink: dict.signUp.acceptLink,
            createAccount: t.createAccount,
            errors: { ...t.errors, ...dict.signUp.errors },
          }}
        />
      ) : (
        <p role="alert" className="form-error">
          {t.errors.captcha}
        </p>
      )}

      <p className="auth-switch">
        {t.noAccount} <Link href="/cadastro">{t.createAccount}</Link>
      </p>
      <p className="auth-foot">
        <Link href="/">{t.home}</Link> · <Link href="/privacidade">{dict.common.privacy}</Link>
      </p>
    </AuthShell>
  );
}
