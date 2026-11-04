"use client";

import { useActionState, useState } from "react";
import { renameCategoryAction, type RenameState } from "@/app/(app)/actions";

/** Renomear inline: o botão abre um campo com o nome atual. */
export function RenameCategory({
  id,
  name,
  labels,
}: {
  id: string;
  name: string;
  labels: { rename: string; save: string; cancel: string };
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<RenameState, FormData>(
    async (prev, formData) => {
      const result = await renameCategoryAction(prev, formData);
      if (result.saved) setEditing(false);
      return result;
    },
    {},
  );

  if (!editing) {
    return (
      <button type="button" className="link-button" onClick={() => setEditing(true)}>
        {labels.rename}
      </button>
    );
  }

  return (
    <form action={formAction} className="rename-form">
      <input type="hidden" name="id" value={id} />
      <input name="name" type="text" required maxLength={40} defaultValue={name} autoComplete="off" autoFocus />
      <button type="submit" className="button small" disabled={pending}>
        {labels.save}
      </button>
      <button type="button" className="button secondary small" onClick={() => setEditing(false)}>
        {labels.cancel}
      </button>
      {state.error ? (
        <span role="alert" className="form-error inline">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
