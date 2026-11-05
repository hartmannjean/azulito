"use client";

import { useActionState, useState } from "react";
import { saveSettingsAction, completeWelcomeAction, skipWelcomeAction, type SettingsState } from "@/app/(app)/settings-actions";
import { formatCurrency } from "@/lib/format";
import type { Locale } from "@/lib/i18n/locale";

type Labels = {
  salaryTitle: string;
  salaryHint: string;
  salaryAmount: string;
  salaryDay: string;
  cardTitle: string;
  cardHint: string;
  cardClosing: string;
  cardDue: string;
  optional: string;
  save: string;
  saving: string;
  saved: string;
  skip: string;
  later: string;
  previewTitle: string;
  previewEmpty: string;
  previewSalary: string;
  previewSalaryNoDay: string;
};

export type SettingsInitial = {
  salary_amount: number | null;
  salary_day: number | null;
  card_closing_day: number | null;
  card_due_day: number | null;
};

/** "5.432,10" ou "5432.10" → número; vazio ou inválido → null (só para a prévia). */
function previewMoney(text: string): number | null {
  const cleaned = text.replace(/[R$\s]/g, "");
  if (cleaned === "") return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Preferências financeiras: salário (valor e dia) e ciclo do cartão. Usado nas
 * perguntas iniciais (`welcome`: salva e segue, ou pula) e na página Conta
 * (`account`: salva e fica). Tudo é opcional.
 */
export function SettingsForm({
  mode,
  locale,
  initial,
  labels,
}: {
  mode: "welcome" | "account";
  locale: Locale;
  initial: SettingsInitial;
  labels: Labels;
}) {
  const welcome = mode === "welcome";
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    welcome ? completeWelcomeAction : saveSettingsAction,
    {},
  );
  const [amount, setAmount] = useState(
    initial.salary_amount !== null ? String(initial.salary_amount).replace(".", ",") : "",
  );
  const [day, setDay] = useState(initial.salary_day !== null ? String(initial.salary_day) : "");

  const value = previewMoney(amount);
  const preview =
    value === null
      ? labels.previewEmpty
      : (day ? labels.previewSalary : labels.previewSalaryNoDay)
          .replace("{amount}", formatCurrency(value, locale))
          .replace("{day}", day);

  const optional = <span className="welcome-opt"> ({labels.optional})</span>;

  return (
    <form action={formAction} className="stack-form" noValidate={false}>
      <div className="welcome-grid">
        <section className="chart-card">
          <h2>{labels.salaryTitle}</h2>
          <p className="welcome-hint">{labels.salaryHint}</p>
          <div className="welcome-fields">
            <label className="wide">
              {labels.salaryAmount}
              {optional}
              <input
                name="salary_amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="5.000,00"
                maxLength={14}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label>
              {labels.salaryDay}
              {optional}
              <input
                name="salary_day"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                placeholder="5"
                value={day}
                onChange={(event) => setDay(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="chart-card">
          <h2>{labels.cardTitle}</h2>
          <p className="welcome-hint">{labels.cardHint}</p>
          <div className="welcome-fields">
            <label>
              {labels.cardClosing}
              {optional}
              <input
                name="card_closing_day"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                placeholder="2"
                defaultValue={initial.card_closing_day ?? ""}
              />
            </label>
            <label>
              {labels.cardDue}
              {optional}
              <input
                name="card_due_day"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                placeholder="9"
                defaultValue={initial.card_due_day ?? ""}
              />
            </label>
          </div>
        </section>
      </div>

      {welcome ? (
        <div className="welcome-preview" aria-live="polite">
          <div>
            <b>{labels.previewTitle}</b>
            <p>{preview}</p>
          </div>
        </div>
      ) : null}

      <div className="welcome-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? labels.saving : labels.save}
        </button>
        {welcome ? (
          <>
            <button type="submit" className="button secondary" formAction={skipWelcomeAction} formNoValidate disabled={pending}>
              {labels.skip}
            </button>
            <span className="welcome-later">{labels.later}</span>
          </>
        ) : null}
        {!welcome && state.saved ? (
          <span role="status" className="welcome-later">
            {labels.saved}
          </span>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
