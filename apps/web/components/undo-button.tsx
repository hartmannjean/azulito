"use client";

import { useState, useTransition } from "react";
import { undoActionAction } from "@/app/(app)/actions";

/** Desfaz uma ação da lista do Histórico. */
export function UndoButton({ id, label, failedLabel }: { id: string; label: string; failedLabel: string }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <span>
      <button
        type="button"
        className="button secondary small"
        disabled={pending}
        onClick={() => {
          setFailed(false);
          startTransition(async () => {
            const result = await undoActionAction(id);
            if (!result.ok) setFailed(true);
          });
        }}
      >
        {label}
      </button>
      {failed ? <span className="form-error inline">{failedLabel}</span> : null}
    </span>
  );
}
