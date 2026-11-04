"use client";

import { useActionState, useRef } from "react";
import { createScheduledAction, type ScheduledState } from "@/app/(app)/actions";
import type { CategoryOption } from "@/components/category-select";

/** Cadastra um boleto a pagar ou uma entrada prevista. */
export function ScheduledForm({
  options,
  today,
  labels,
}: {
  options: CategoryOption[];
  /** AAAA-MM-DD, valor inicial do vencimento. */
  today: string;
  labels: {
    kindExpense: string;
    kindIncome: string;
    description: string;
    amount: string;
    dueDate: string;
    category: string;
    none: string;
    add: string;
    added: string;
  };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ScheduledState, FormData>(
    async (prev, formData) => {
      const result = await createScheduledAction(prev, formData);
      if (result.saved) formRef.current?.reset();
      return result;
    },
    {},
  );

  return (
    <form ref={formRef} action={formAction} className="card-cycle-form scheduled-form">
      <label>
        <span className="sr-only">{labels.kindExpense}</span>
        <select name="kind" defaultValue="expense">
          <option value="expense">{labels.kindExpense}</option>
          <option value="income">{labels.kindIncome}</option>
        </select>
      </label>
      <label>
        {labels.description}
        <input name="description" type="text" required maxLength={80} autoComplete="off" />
      </label>
      <label>
        {labels.amount}
        <input name="amount" type="text" inputMode="decimal" required placeholder="0,00" />
      </label>
      <label>
        {labels.dueDate}
        <input name="due_date" type="date" required defaultValue={today} />
      </label>
      <label>
        {labels.category}
        <select name="category" defaultValue="">
          <option value="">{labels.none}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="button" disabled={pending}>
        {labels.add}
      </button>
      {state.saved ? <span className="muted-cell">{labels.added}</span> : null}
      {state.error ? (
        <span role="alert" className="form-error inline">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
