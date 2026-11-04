import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { UndoBar } from "@/components/undo-bar";
import { fetchHistory } from "@/lib/api-client";
import { describeAction } from "@/lib/history-message";
import { getAccess } from "@/lib/access";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * O Cloudflare Access já barra quem não está logado antes de chegar aqui; o
 * `getAccess()` é defesa em profundidade (acesso que contorne o Access).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const access = await getAccess();

  if (!access) {
    return (
      <main className="center-notice">
        <p role="alert" className="form-error">
          {dict.auth.errors.notAuthenticated}
        </p>
      </main>
    );
  }

  // Última ação: todo Server Action revalida o layout, então este aviso aparece
  // sozinho depois de qualquer mudança, sem cada botão precisar conhecê-lo.
  let undo: { id: string; message: string; ageMs: number; undone: boolean } | null = null;
  try {
    const { now, actions } = await fetchHistory(access.jwt, 1);
    const latest = actions[0];
    if (latest) {
      undo = {
        id: latest.id,
        message: describeAction(latest, locale, dict),
        ageMs: Math.max(0, Date.parse(now) - Date.parse(latest.created_at)),
        undone: latest.undone_at !== null,
      };
    }
  } catch (error) {
    console.error("Falha ao buscar a última ação:", error);
  }

  return (
    <AppShell email={access.email} locale={locale} dict={dict}>
      {children}
      {undo && undo.ageMs < 15_000 ? (
        <UndoBar
          key={undo.id + (undo.undone ? "-undone" : "")}
          id={undo.id}
          message={undo.message}
          ageMs={undo.ageMs}
          undone={undo.undone}
          labels={{
            undo: dict.history.undo,
            undone: dict.history.undone,
            dismiss: dict.history.dismiss,
            failed: dict.history.failed,
          }}
        />
      ) : null}
    </AppShell>
  );
}
