"use client";

import { useState, useTransition } from "react";
import { setReferenceMonth } from "@/app/(app)/actions";
import { formatMonthLabel, shiftMonth } from "@/lib/format";
import type { Locale } from "@/lib/i18n/locale";

/**
 * Escolhe em que mês a transação conta nas somas. "Automático" (valor vazio)
 * segue a regra padrão — mês da data, ou mês do vencimento da fatura no
 * cartão; qualquer outro valor é uma correção manual (ex.: o salário recebido
 * dia 20 que paga as contas do mês seguinte).
 */
export function ReferenceMonthSelect({
  transactionId,
  effectiveMonth,
  referenceMonth,
  locale,
  autoLabel,
  autoPlainLabel,
  errorLabel,
}: {
  transactionId: string;
  effectiveMonth: string;
  referenceMonth: string | null;
  locale: Locale;
  autoLabel: (month: string) => string;
  autoPlainLabel: string;
  errorLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(referenceMonth ?? "");
  const [failed, setFailed] = useState(false);

  // Meses ao redor do efetivo; o já escolhido sempre entra na lista.
  const months = new Set<string>();
  for (let delta = -3; delta <= 3; delta++) months.add(shiftMonth(effectiveMonth, delta));
  if (referenceMonth) months.add(referenceMonth);
  const ordered = [...months].sort();

  function onChange(next: string) {
    const previous = value;
    setValue(next);
    setFailed(false);
    startTransition(async () => {
      const result = await setReferenceMonth(transactionId, next === "" ? null : next);
      if (!result.ok) {
        setValue(previous);
        setFailed(true);
      }
    });
  }

  return (
    <span className="category-select-wrap">
      <select
        className="category-select"
        value={value}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
        aria-label={errorLabel}
      >
        <option value="">
          {value === "" ? autoLabel(formatMonthLabel(effectiveMonth, locale)) : autoPlainLabel}
        </option>
        {ordered.map((month) => (
          <option key={month} value={month}>
            {formatMonthLabel(month, locale)}
          </option>
        ))}
      </select>
      {failed ? (
        <span role="alert" className="form-error inline">
          {errorLabel}
        </span>
      ) : null}
    </span>
  );
}
