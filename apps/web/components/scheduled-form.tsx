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
    <form ref={formRef} action={formAction} className="sched-form">
      <div className="sched-kind" role="radiogroup" aria-label={`${labels.kindExpense} / ${labels.kindIncome}`}>
        <label className="sched-kind-option expense">
          <input type="radio" name="kind" value="expense" defaultChecked />
          <span>{labels.kindExpense}</span>
        </label>
        <label className="sched-kind-option income">
          <input type="radio" name="kind" value="income" />
          <span>{labels.kindIncome}</span>
        </label>
      </div>

      <label className="sched-field wide">
        <span>{labels.description}</span>
        <input name="description" type="text" required maxLength={80} autoComplete="off" />
      </label>

      <label className="sched-field">
        <span>{labels.amount}</span>
        <span className="sched-money">
          <span aria-hidden="true">R$</span>
          <input name="amount" type="text" inputMode="decimal" required placeholder="0,00" autoComplete="off" />
        </span>
      </label>

      <label className="sched-field">
        <span>{labels.dueDate}</span>
        <input name="due_date" type="date" required defaultValue={today} />
      </label>

      <label className="sched-field wide">
        <span>{labels.category}</span>
        <select name="category" defaultValue="">
          <option value="">{labels.none}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" className="button sched-submit" disabled={pending}>
        {labels.add}
      </button>

      {state.saved ? <p className="sched-note muted-cell">{labels.added}</p> : null}
      {state.error ? (
        <p role="alert" className="sched-note form-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
