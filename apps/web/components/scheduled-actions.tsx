"use client";

import { useTransition } from "react";
import { markScheduledPaidAction, removeScheduledAction } from "@/app/(app)/actions";

/** Marcar como paga/recebida (ou desmarcar) e remover um lançamento cadastrado. */
export function ScheduledActions({
  id,
  paid,
  labels,
}: {
  id: string;
  paid: boolean;
  labels: { markPaid: string; unmark: string; remove: string };
}) {
  const [pending, startTransition] = useTransition();

  return (
    <span className="mini-row-actions">
      <button
        type="button"
        className="link-button"
        disabled={pending}
        onClick={() => startTransition(() => markScheduledPaidAction(id, !paid))}
      >
        {paid ? labels.unmark : labels.markPaid}
      </button>
      <button
        type="button"
        className="link-button"
        disabled={pending}
        onClick={() => startTransition(() => removeScheduledAction(id))}
      >
        {labels.remove}
      </button>
    </span>
  );
}
