"use client";

import { useActionState, useTransition } from "react";
import { createCategoryAction, removeCategoryAction, type CategoryState } from "@/app/(app)/actions";

export function CategoryForm({ labels }: { labels: { name: string; create: string } }) {
  const [state, formAction, pending] = useActionState<CategoryState, FormData>(createCategoryAction, {});

  return (
    <form action={formAction} className="stack-form">
      <label>
        {labels.name}
        <input name="name" type="text" required maxLength={40} autoComplete="off" />
      </label>
      <button type="submit" className="button" disabled={pending}>
        {labels.create}
      </button>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function RemoveCategoryButton({ id, label, confirmLabel }: { id: string; label: string; confirmLabel: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="link-button"
      disabled={pending}
      title={confirmLabel}
      onClick={() => startTransition(() => removeCategoryAction(id))}
    >
      {label}
    </button>
  );
}
