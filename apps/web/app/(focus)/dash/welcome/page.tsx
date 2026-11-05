import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";
import { Logo } from "@/components/logo";
import { fetchSettings } from "@/lib/api-client";
import { requireSession } from "@/lib/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Perguntas iniciais, logo depois de criar a conta: salário e ciclo do cartão
 * (tudo opcional, dá para pular). Quem já respondeu ou pulou volta ao painel.
 */
export default async function WelcomePage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const session = await requireSession();

  const settings = await fetchSettings(session.cookie).catch(() => null);
  if (settings?.onboarded) redirect("/dash");

  const t = dict.welcome;
  const firstName = session.name?.split(" ")[0] ?? null;

  return (
    <main className="welcome-card">
      <header className="welcome-head">
        <Logo />
        <h1>{firstName ? t.title.replace("{name}", firstName) : t.titleNoName}</h1>
        <p>{t.subtitle}</p>
      </header>

      <SettingsForm
        mode="welcome"
        locale={locale}
        initial={{
          salary_amount: settings?.salary_amount ?? null,
          salary_day: settings?.salary_day ?? null,
          card_closing_day: settings?.card_closing_day ?? null,
          card_due_day: settings?.card_due_day ?? null,
        }}
        labels={{ ...t, saved: dict.accountPage.settingsSaved }}
      />
    </main>
  );
}
