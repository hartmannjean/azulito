"use client";

import { useTransition } from "react";
import { AiBot } from "@/components/ai-bot";
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

type Labels = { accept: string; dismiss: string; badge: string };

function useSuggestionActions(data: SuggestionCardData) {
  const [pending, startTransition] = useTransition();
  return {
    pending,
    accept: () => startTransition(() => acceptBudgetSuggestionAction(data.category, data.limit)),
    dismiss: () => startTransition(() => dismissBudgetSuggestionAction(data.category)),
  };
}

/**
 * Sugestão para uma categoria SEM orçamento: aparece no grid, apagada e
 * tracejada. Ao aplicar, vira um orçamento comum (mesmas cores dos outros).
 */
export function BudgetSuggestionCard({
  data,
  labels,
  disabled = false,
}: {
  data: SuggestionCardData;
  labels: Labels;
  /** Demonstração: os botões ficam desligados (nada é gravado). */
  disabled?: boolean;
}) {
  const { pending, accept, dismiss } = useSuggestionActions(data);

  return (
    <section className="chart-card budget-card suggestion-ghost">
      <div className="budget-card-top">
        <h3>{data.title}</h3>
        <span className="chip muted ai-chip">
          <AiBot size={16} animated={false} /> {labels.badge}
        </span>
      </div>
      <p className="card-highlight ghost-value">{data.change}</p>
      <div className="progress-track large ghost">
        <div className="progress-fill ghost" />
      </div>
      <p className="muted-cell block">{data.reason}</p>
      <div className="budget-card-bottom">
        <span className="muted-cell">{data.average}</span>
        <span className="suggestion-actions">
          <button type="button" className="button small" disabled={pending || disabled} onClick={accept}>
            {labels.accept}
          </button>
          <button type="button" className="button secondary small" disabled={pending || disabled} onClick={dismiss}>
            {labels.dismiss}
          </button>
        </span>
      </div>
    </section>
  );
}

/** Sugestão de novo limite para um orçamento que já existe: faixa dentro do card. */
export function BudgetSuggestionStrip({
  data,
  labels,
  disabled = false,
}: {
  data: SuggestionCardData;
  labels: Labels;
  disabled?: boolean;
}) {
  const { pending, accept, dismiss } = useSuggestionActions(data);

  return (
    <div className="suggestion-strip">
      <div>
        <span className="chip muted ai-chip">
          <AiBot size={16} animated={false} /> {labels.badge}
        </span>
        <span className="suggestion-strip-text">
          {data.change} · {data.reason}
        </span>
      </div>
      <span className="suggestion-actions">
        <button type="button" className="button small" disabled={pending || disabled} onClick={accept}>
          {labels.accept}
        </button>
        <button type="button" className="button secondary small" disabled={pending || disabled} onClick={dismiss}>
          {labels.dismiss}
        </button>
      </span>
    </div>
  );
}
