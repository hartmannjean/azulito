"use client";

import { useState, useTransition } from "react";
import { runCategorize, type CategorizeState } from "@/app/(app)/actions";

export function CategorizeButton({
  label,
  runningLabel,
  className = "button secondary",
}: {
  label: string;
  runningLabel: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CategorizeState>({});

  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => startTransition(async () => setState(await runCategorize()))}
      >
        {pending ? runningLabel : label}
      </button>
      {state.message ? <p className="transaction-meta">{state.message}</p> : null}
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
