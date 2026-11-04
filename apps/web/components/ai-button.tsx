"use client";

import { useState, useTransition } from "react";
import { generateAiAction, type AiKind } from "@/app/(app)/actions";

/** Botão genérico de "gerar com IA" (sugestões de orçamento, recorrências, revisão do mês). */
export function AiButton({
  kind,
  month,
  label,
  runningLabel,
  errorLabel,
  className = "button",
}: {
  kind: AiKind;
  month?: string;
  label: string;
  runningLabel: string;
  errorLabel: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          setFailed(false);
          startTransition(async () => {
            const result = await generateAiAction(kind, month);
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
