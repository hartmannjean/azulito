"use client";

import { useActionState } from "react";
import { saveSavingsAction, type SavingsState } from "@/app/(app)/actions";

/** Saldo das caixinhas no fim de um mês (ou de hoje, no mês corrente). */
export function SavingsForm({
  defaultMonth,
  maxMonth,
  labels,
}: {
  defaultMonth: string;
  maxMonth: string;
  labels: { month: string; balance: string; save: string; saved: string };
}) {
  const [state, formAction, pending] = useActionState<SavingsState, FormData>(saveSavingsAction, {});

  return (
    <form action={formAction} className="card-cycle-form">
      <label>
        {labels.month}
        <input name="month" type="month" required defaultValue={defaultMonth} max={maxMonth} />
      </label>
      <label>
        {labels.balance}
        <input name="balance" type="text" inputMode="decimal" required placeholder="0,00" />
      </label>
      <button type="submit" className="button" disabled={pending}>
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
