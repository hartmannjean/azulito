import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { getDemoData } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/format";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Página inicial PÚBLICA (fora do Cloudflare Access). Os cards de exemplo
 * usam os dados fictícios da demonstração — nada aqui lê dados reais.
 * "Entrar" aponta para /dashboard, que o Access protege e redireciona para o
 * login; é um <a> comum (não <Link>) para não disparar prefetch de uma rota
 * protegida.
 */
export default async function LandingPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const { summary } = getDemoData();

  return (
    <div className="landing">
      <header className="landing-header">
        <Logo />
        <div className="landing-header-actions">
          <LanguageToggle
            locale={locale}
            switchToEnglishLabel={dict.common.switchToEnglish}
            switchToPortugueseLabel={dict.common.switchToPortuguese}
          />
          <ThemeToggle label={dict.common.toggleTheme} />
          <a href="/dashboard" className="button small">
            {dict.landing.login}
          </a>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-text">
            <h1>{dict.landing.heroTitle}</h1>
            <p>{dict.landing.heroSubtitle}</p>
            <div className="landing-cta">
              <a href="/dashboard" className="button">
                {dict.landing.login}
              </a>
              <a href="/demo" className="button secondary">
                {dict.landing.demo}
              </a>
            </div>
          </div>

          <div className="landing-preview" aria-hidden="true">
            <div className="summary-card summary-card-income">
              <span className="summary-label">{dict.landing.previewIncome}</span>
              <span className="summary-value positive">{formatCurrency(summary.income, locale)}</span>
            </div>
            <div className="summary-card summary-card-expense">
              <span className="summary-label">{dict.landing.previewExpenses}</span>
              <span className="summary-value negative">{formatCurrency(summary.expenses, locale)}</span>
            </div>
            <div className="summary-card summary-card-balance">
              <span className="summary-label">{dict.landing.previewBalance}</span>
              <span className="summary-value positive">{formatCurrency(summary.balance, locale)}</span>
            </div>
          </div>
        </section>

        <section className="landing-features">
          <h2>{dict.landing.featuresHeading}</h2>
          <div className="landing-feature-grid">
            {dict.landing.features.map((feature) => (
              <article key={feature.title} className="chart-card landing-feature">
                <span className="landing-feature-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">{dict.landing.privacy}</footer>
    </div>
  );
}
