"use client";

import { useActionState } from "react";
import { saveBudgetAction, type BudgetState } from "@/app/(app)/actions";
import type { CategoryOption } from "@/components/category-select";

export function BudgetForm({
  options,
  labels,
}: {
  options: CategoryOption[];
  labels: { category: string; limit: string; save: string };
}) {
  const [state, formAction, pending] = useActionState<BudgetState, FormData>(saveBudgetAction, {});

  return (
    <form action={formAction} className="stack-form">
      <label>
        {labels.category}
        <select name="category" required defaultValue="">
          <option value="" disabled />
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {labels.limit}
        <input name="limit" type="number" inputMode="decimal" min="1" step="0.01" required />
      </label>
      <button type="submit" className="button" disabled={pending}>
        {labels.save}
      </button>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
