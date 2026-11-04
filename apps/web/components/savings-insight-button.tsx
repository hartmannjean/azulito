"use client";

import { useState, useTransition } from "react";
import { generateInsightAction } from "@/app/(app)/actions";

/** Pede à IA a análise de onde cortar gastos; a página recarrega com o texto novo. */
export function SavingsInsightButton({
  label,
  runningLabel,
  errorLabel,
}: {
  label: string;
  runningLabel: string;
  errorLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="button"
        disabled={pending}
        onClick={() => {
          setFailed(false);
          startTransition(async () => {
            const result = await generateInsightAction();
            if (!result.ok) setFailed(true);
          });
        }}
      >
        {pending ? runningLabel : label}
      </button>
      {failed ? (
        <p role="alert" className="form-error">
          {errorLabel}
        </p>
      ) : null}
    </div>
  );
}
