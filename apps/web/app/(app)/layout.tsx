import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UndoBar } from "@/components/undo-bar";
import { fetchHistory } from "@/lib/api-client";
import { describeAction } from "@/lib/history-message";
import { getSession } from "@/lib/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Barreira de todas as rotas privadas (/dash/*): sem sessão válida, vai para o
 * login. O `proxy.ts` só faz uma checagem otimista do cookie; quem de fato
 * valida a sessão é a apps/api, via `getSession()`.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const session = await getSession();

  if (!session) redirect("/login");

  // Última ação: todo Server Action revalida o layout, então este aviso aparece
  // sozinho depois de qualquer mudança, sem cada botão precisar conhecê-lo.
  let undo: { id: string; message: string; ageMs: number; undone: boolean } | null = null;
  try {
    const { now, actions } = await fetchHistory(session.cookie, 1);
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
    <AppShell email={session.email} locale={locale} dict={dict}>
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
