import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PublicHeader } from "@/components/public-header";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/** Política de privacidade: PÚBLICA, para qualquer pessoa ler antes de criar a conta. */
export default async function PrivacyPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.privacyPage;

  // E-mail de contato configurável (vars do wrangler), para não fixar um dado pessoal no código.
  let contact = process.env.CONTACT_EMAIL;
  if (!contact) {
    try {
      contact = (getCloudflareContext().env as { CONTACT_EMAIL?: string }).CONTACT_EMAIL;
    } catch {
      // Fora do runtime da Cloudflare.
    }
  }

  return (
    <div className="landing">
      <PublicHeader locale={locale} dict={dict} />
      <main className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">{t.title}</h1>
            <p className="page-subtitle">{t.updated}</p>
          </div>
        </header>

        {t.sections.map((section) => (
          <section key={section.title} className="chart-card">
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}

        <section className="chart-card">
          <h2>{t.contactLabel}</h2>
          <p>{contact ? <a href={`mailto:${contact}`}>{contact}</a> : t.contactMissing}</p>
        </section>

        <p>
          <Link href="/">{t.back}</Link>
        </p>
      </main>
    </div>
  );
}
