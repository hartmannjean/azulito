import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthIllustration } from "@/components/auth-illustration";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ signup?: string }>;
}) {
  const { signup } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <main className="auth-shell">
      <div className="auth-theme-toggle">
        <LanguageToggle
          locale={locale}
          switchToEnglishLabel={dict.common.switchToEnglish}
          switchToPortugueseLabel={dict.common.switchToPortuguese}
        />
        <ThemeToggle label={dict.common.toggleTheme} />
      </div>
      <section className="auth-hero">
        <div className="auth-hero-content">
          <Logo size={38} />
          <div>
            <h1 className="auth-hero-title">{dict.auth.login.heroTitle}</h1>
            <p className="auth-hero-subtitle">{dict.auth.login.heroSubtitle}</p>
          </div>
          <ul className="auth-features">
            {dict.auth.features.map((feature) => (
              <li className="auth-feature" key={feature.text}>
                <span className="auth-feature-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                {feature.text}
              </li>
            ))}
          </ul>
        </div>
        <AuthIllustration label={dict.auth.illustrationAlt} />
      </section>

      <section className="auth-card-panel">
        <div className="auth-card">
          <div className="auth-card-brand">
            <Logo />
          </div>
          <h2>{dict.auth.login.heading}</h2>
          {signup === "success" ? <p className="form-notice">{dict.auth.login.signupSuccessNotice}</p> : null}
          <AuthForm
            action={login}
            submitLabel={dict.auth.login.submitLabel}
            emailLabel={dict.auth.emailLabel}
            passwordLabel={dict.auth.passwordLabel}
            sendingLabel={dict.auth.sending}
          />
          <p className="auth-switch">
            {dict.auth.login.switchPrompt} <Link href="/signup">{dict.auth.login.switchLink}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
