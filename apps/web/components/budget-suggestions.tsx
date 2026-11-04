"use client";

import { useTransition } from "react";
import { acceptBudgetSuggestionAction, dismissBudgetSuggestionAction } from "@/app/(app)/actions";

export type SuggestionCardData = {
  category: string;
  limit: number;
  /** Já formatado no servidor (categoria traduzida, valores em moeda). */
  title: string;
  change: string;
  reason: string;
  average: string;
};

/**
 * Sugestões da IA como cartões "apagados": ficam em segundo plano até você
 * aplicar (vira o limite do orçamento, com desfazer) ou ignorar.
 */
export function BudgetSuggestionCard({
  data,
  labels,
  disabled = false,
}: {
  data: SuggestionCardData;
  labels: { accept: string; dismiss: string };
  /** Demonstração: os botões ficam desligados (nada é gravado). */
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="chart-card suggestion-card">
      <div className="budget-card-top">
        <h3>{data.title}</h3>
        <span className="chip muted">{data.change}</span>
      </div>
      <p className="muted-cell block">{data.reason}</p>
      <p className="muted-cell block">{data.average}</p>
      <div className="suggestion-actions">
        <button
          type="button"
          className="button small"
          disabled={pending || disabled}
          onClick={() => startTransition(() => acceptBudgetSuggestionAction(data.category, data.limit))}
        >
          {labels.accept}
        </button>
        <button
          type="button"
          className="button secondary small"
          disabled={pending || disabled}
          onClick={() => startTransition(() => dismissBudgetSuggestionAction(data.category))}
        >
          {labels.dismiss}
        </button>
      </div>
    </section>
  );
}
