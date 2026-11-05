"use client";

import { useState, useTransition } from "react";
import { generateInsightAction } from "@/app/(app)/actions";
import { AiBot } from "@/components/ai-bot";

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
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className="button"
        disabled={pending}
        onClick={() => {
          setFailure(null);
          startTransition(async () => {
            const result = await generateInsightAction();
            if (!result.ok) setFailure(result.error ?? errorLabel);
          });
        }}
      >
        <AiBot size={18} animated={false} className="btn-bot" />
        {pending ? runningLabel : label}
      </button>
      {failure ? (
        <p role="alert" className="form-error">
          {failure}
        </p>
      ) : null}
    </div>
  );
}
