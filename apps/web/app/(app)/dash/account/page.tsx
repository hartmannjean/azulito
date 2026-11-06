import Link from "next/link";
import { AdminBack } from "@/components/admin-back";
import { requireSession } from "@/lib/session";
import { fetchSettings } from "@/lib/api-client";
import { SettingsForm } from "@/components/settings-form";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DeleteAccountForm, PasskeysPanel, RevokeOthersButton } from "@/components/account-panels";

/** Conta: exportar os dados, segurança (passkeys e outros dispositivos) e exclusão da conta. */
export default async function AccountPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const session = await requireSession();
  const t = dict.accountPage;
  const settings = await fetchSettings(session.cookie).catch(() => null);

  return (
    <main className="page">
      <AdminBack href="/dash/admin" label={dict.nav.admin} />
      <header className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
      </header>

      <section className="chart-card">
        <h2>{t.settingsTitle}</h2>
        <p>{t.settingsText}</p>
        <SettingsForm
          mode="account"
          locale={locale}
          initial={{
            salary_amount: settings?.salary_amount ?? null,
            salary_day: settings?.salary_day ?? null,
            card_closing_day: settings?.card_closing_day ?? null,
            card_due_day: settings?.card_due_day ?? null,
          }}
          labels={{ ...dict.welcome, save: t.settingsSave, saving: t.settingsSaving, saved: t.settingsSaved }}
        />
      </section>

      <section className="chart-card">
        <h2>{t.exportTitle}</h2>
        <p>{t.exportText}</p>
        <a href="/dash/account/export" className="button" download>
          {t.exportButton}
        </a>
      </section>

      <section className="chart-card">
        <h2>{t.securityTitle}</h2>
        <h3>{t.passkeysTitle}</h3>
        <p>{t.passkeysText}</p>
        <PasskeysPanel
          labels={{
            none: t.passkeysNone,
            add: t.passkeyAdd,
            adding: t.passkeyAdding,
            remove: t.passkeyRemove,
            added: t.passkeyAdded,
            failed: t.passkeyFailed,
          }}
        />
        <h3>{t.sessionsTitle}</h3>
        <p>{t.sessionsText}</p>
        <RevokeOthersButton labels={{ button: t.sessionsButton, done: t.sessionsDone, failed: t.sessionsFailed }} />
      </section>

      <section className="chart-card">
        <h2>{t.dangerTitle}</h2>
        <p>{t.dangerText}</p>
        {session.email ? (
          <DeleteAccountForm
            email={session.email}
            labels={{
              confirm: t.dangerConfirm,
              button: t.dangerButton,
              deleting: t.dangerDeleting,
              recentLogin: t.dangerRecentLogin,
              failed: t.dangerFailed,
            }}
          />
        ) : null}
      </section>

      <p>
        <Link href="/privacidade">{t.privacyLink}</Link>
      </p>
    </main>
  );
}
