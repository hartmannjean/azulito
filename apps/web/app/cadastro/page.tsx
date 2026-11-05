import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Página PÚBLICA de criação de conta: pede o nome, o e-mail e o aceite da política
 * de privacidade. É o único caminho que cria conta (o login comum não cria).
 */
export default async function SignUpPage() {
  if (await getSession()) redirect("/dash");

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.signUp;
  const s = dict.signIn;
  const siteKey = getTurnstileSiteKey();

  return (
    <AuthShell locale={locale} dict={dict} panelTitle={t.panelTitle} panelText={t.panelText}>
      <h1>{t.heading}</h1>
      <p className="lead">{t.intro}</p>

      {siteKey ? (
        <AuthForm
          mode="signup"
          siteKey={siteKey}
          privacyHref="/privacidade"
          signupHref="/cadastro"
          labels={{
            nameLabel: t.nameLabel,
            emailLabel: t.emailLabel,
            sendCode: t.submit,
            sending: t.sending,
            codeLabel: s.codeLabel,
            codeSent: s.codeSent("{email}"),
            verify: s.verify,
            verifying: s.verifying,
            useAnotherEmail: s.useAnotherEmail,
            passkey: s.passkey,
            or: s.or,
            humanCheck: s.humanCheck,
            acceptPrefix: t.acceptPrefix,
            acceptLink: t.acceptLink,
            createAccount: s.createAccount,
            errors: { ...s.errors, ...t.errors },
          }}
        />
      ) : (
        <p role="alert" className="form-error">
          {s.errors.captcha}
        </p>
      )}

      <p className="auth-switch">
        {t.haveAccount} <Link href="/login">{t.login}</Link>
      </p>
      <p className="auth-foot">
        <Link href="/">{s.home}</Link> · <Link href="/privacidade">{dict.common.privacy}</Link>
      </p>
    </AuthShell>
  );
}
