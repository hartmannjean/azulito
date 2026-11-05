import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { Icon, type IconName } from "@/components/marketing/icons";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { BudgetVisual, CategorizeVisual, ForecastVisual, RecurringVisual } from "@/components/marketing/feature-visuals";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import "./marketing.css";

const MORE_ICONS: IconName[] = ["card", "wallet", "undo", "key", "globe", "download"];
const SECURITY_ICONS: IconName[] = ["shield", "key", "target", "download"];
const STEP_ICONS: IconName[] = ["download", "upload", "trend"];

/**
 * Tela inicial PÚBLICA. Os números e as telas mostrados são FICTÍCIOS (vêm dos
 * dados de demonstração); nada aqui lê dado de usuário nem chama a api.
 */
export default async function LandingPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.landing;
  const visuals = [ForecastVisual, CategorizeVisual, BudgetVisual, RecurringVisual];

  return (
    <div className="mk">
      <header className="mk-nav">
        <div className="mk-container mk-nav-inner">
          <Link href="/" aria-label="Azulito">
            <Logo />
          </Link>
          <nav className="mk-nav-links" aria-label="Principal">
            <a href="#recursos">{t.nav.features}</a>
            <a href="#como">{t.nav.how}</a>
            <a href="#seguranca">{t.nav.security}</a>
            <Link href="/demo">{t.nav.demo}</Link>
          </nav>
          <div className="mk-nav-actions">
            <LanguageToggle
              locale={locale}
              switchToEnglishLabel={dict.common.switchToEnglish}
              switchToPortugueseLabel={dict.common.switchToPortuguese}
            />
            <ThemeToggle label={dict.common.toggleTheme} />
            <Link href="/login" className="mk-link">
              {t.login}
            </Link>
            <Link href="/cadastro" className="button">
              {t.signup}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mk-hero">
          <div className="mk-container">
            <span className="mk-badge mk-rise">
              <i />
              {t.badge}
            </span>
            <h1 className="mk-title mk-rise" style={{ "--d": "0.08s" } as React.CSSProperties}>
              {t.heroTitleA}
              <span>{t.heroTitleB}</span>
            </h1>
            <p className="mk-sub mk-rise" style={{ "--d": "0.16s" } as React.CSSProperties}>
              {t.heroSubtitle}
            </p>
            <div className="mk-cta mk-rise" style={{ "--d": "0.24s" } as React.CSSProperties}>
              <Link href="/cadastro" className="button">
                {t.signup}
              </Link>
              <Link href="/demo" className="button secondary">
                {t.demo}
              </Link>
            </div>
            <ul className="mk-trust mk-rise" style={{ "--d": "0.32s" } as React.CSSProperties}>
              {t.trust.map((item) => (
                <li key={item}>
                  <Icon name="check" size={16} />
                  {item}
                </li>
              ))}
            </ul>

            <ProductShowcase locale={locale} dict={dict} />
          </div>
        </section>

        <p className="mk-strip">{t.stripLabel}</p>

        <section className="mk-section" id="como">
          <div className="mk-container">
            <h2 className="mk-h2 mk-reveal">{t.howHeading}</h2>
            <div className="mk-steps">
              {t.steps.map((step, index) => (
                <article className="mk-step mk-reveal" key={step.title}>
                  <div className="mk-step-n">0{index + 1}</div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  <div className="mk-more-ico" style={{ marginTop: "1.1rem", marginBottom: 0 }}>
                    <Icon name={STEP_ICONS[index]!} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-section" id="recursos">
          <div className="mk-container">
            <h2 className="mk-h2 mk-reveal">{t.nav.features}</h2>
            {t.panels.map((panel, index) => {
              const Visual = visuals[index]!;
              return (
                <article className={`mk-feature mk-reveal${index % 2 === 1 ? " reverse" : ""}`} key={panel.title}>
                  <div className="mk-feature-text">
                    <span className="mk-kicker">{panel.kicker}</span>
                    <h3>{panel.title}</h3>
                    <p>{panel.text}</p>
                  </div>
                  <Visual locale={locale} dict={dict} />
                </article>
              );
            })}

            <h2 className="mk-h2 mk-reveal" style={{ marginTop: "4rem" }}>
              {t.moreHeading}
            </h2>
            <div className="mk-more">
              {t.more.map((item, index) => (
                <article className="mk-more-item mk-reveal" key={item.title}>
                  <div className="mk-more-ico">
                    <Icon name={MORE_ICONS[index]!} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-section" id="seguranca">
          <div className="mk-container">
            <div className="mk-security mk-reveal">
              <div>
                <span className="mk-kicker">{t.nav.security}</span>
                <h2>{t.securityHeading}</h2>
                <p>{t.securityText}</p>
                <Link href="/privacidade">{t.securityLink} →</Link>
              </div>
              <ul className="mk-sec-list">
                {t.security.map((item, index) => (
                  <li className="mk-sec-item" key={item.title}>
                    <Icon name={SECURITY_ICONS[index]!} size={22} />
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mk-section">
          <div className="mk-container">
            <div className="mk-final mk-reveal">
              <h2>{t.finalTitle}</h2>
              <p>{t.finalText}</p>
              <Link href="/cadastro" className="button">
                {t.signup}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mk-container mk-footer">
        <span>{t.footer}</span>
        <nav aria-label="Rodapé">
          <Link href="/demo">{t.nav.demo}</Link>
          <Link href="/privacidade">{dict.common.privacy}</Link>
          <Link href="/login">{t.login}</Link>
          <Link href="/cadastro">{t.signup}</Link>
        </nav>
      </footer>
    </div>
  );
}
