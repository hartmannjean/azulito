"use client";

import { useEffect, useState, useTransition } from "react";
import { undoActionAction } from "@/app/(app)/actions";

const VISIBLE_MS = 15_000;
const DONE_MS = 4_000;

/**
 * Aviso "Desfazer" logo depois de qualquer ação. O layout o renderiza com a
 * última ação do histórico (toda ação revalida o layout), então nenhum botão
 * do app precisa saber dele. Dura ~15 s; depois disso o Histórico continua
 * permitindo desfazer.
 */
export function UndoBar({
  id,
  message,
  ageMs,
  undone,
  labels,
}: {
  id: string;
  message: string;
  /** Idade da ação no momento em que a página foi renderizada. */
  ageMs: number;
  undone: boolean;
  labels: { undo: string; undone: string; dismiss: string; failed: string };
}) {
  const [hidden, setHidden] = useState(ageMs >= VISIBLE_MS);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Já nasce oculto quando passou da janela (ver o estado inicial); aqui só agenda o fim.
    const remaining = undone ? DONE_MS : VISIBLE_MS - ageMs;
    const timer = setTimeout(() => setHidden(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [id, undone, ageMs]);

  if (hidden) return null;

  return (
    <div className="undo-bar" role="status" aria-live="polite">
      <span className="undo-message">{undone ? labels.undone : message}</span>
      {undone ? null : (
        <button
          type="button"
          className="button small"
          disabled={pending}
          onClick={() => {
            setFailed(false);
            startTransition(async () => {
              const result = await undoActionAction(id);
              if (!result.ok) setFailed(true);
            });
          }}
        >
          {labels.undo}
        </button>
      )}
      {failed ? <span className="form-error inline">{labels.failed}</span> : null}
      <button type="button" className="link-button" onClick={() => setHidden(true)} aria-label={labels.dismiss}>
        ✕
      </button>
    </div>
  );
}
