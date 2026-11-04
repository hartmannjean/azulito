"use client";

import { useActionState } from "react";
import { saveCardCycleAction, type CardCycleState } from "@/app/(app)/actions";

/** Dia do fechamento e do vencimento da fatura de um cartão. */
export function CardCycleForm({
  accountId,
  closingDay,
  dueDay,
  labels,
}: {
  accountId: string;
  closingDay: number | null;
  dueDay: number | null;
  labels: { closing: string; due: string; save: string; saved: string };
}) {
  const [state, formAction, pending] = useActionState<CardCycleState, FormData>(saveCardCycleAction, {});

  return (
    <form action={formAction} className="card-cycle-form">
      <input type="hidden" name="account_id" value={accountId} />
      <label>
        {labels.closing}
        <input name="closing_day" type="number" min="1" max="31" step="1" required defaultValue={closingDay ?? ""} />
      </label>
      <label>
        {labels.due}
        <input name="due_day" type="number" min="1" max="31" step="1" required defaultValue={dueDay ?? ""} />
      </label>
      <button type="submit" className="button secondary" disabled={pending}>
        {labels.save}
      </button>
      {state.saved ? <span className="muted-cell">{labels.saved}</span> : null}
      {state.error ? (
        <span role="alert" className="form-error inline">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
