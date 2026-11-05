"use client";

import { useState, useTransition } from "react";
import { generateAiAction, type AiKind } from "@/app/(app)/actions";
import { AiBot } from "@/components/ai-bot";

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
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          setFailure(null);
          startTransition(async () => {
            const result = await generateAiAction(kind, month);
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
