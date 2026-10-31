"use client";

import { useState, useTransition } from "react";
import { setCategory } from "@/app/(app)/actions";

export type CategoryOption = { value: string; label: string };

/**
 * Troca a categoria de uma transação. A Server Action grava via apps/api e
 * revalida as páginas; a correção também vira regra para o mesmo
 * estabelecimento (ver PATCH /transactions/:id).
 */
export function CategorySelect({
  transactionId,
  current,
  options,
  uncategorizedLabel,
  errorLabel,
}: {
  transactionId: string;
  current: string | null;
  options: CategoryOption[];
  uncategorizedLabel: string;
  errorLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(current ?? "");
  const [failed, setFailed] = useState(false);

  function onChange(next: string) {
    const previous = value;
    setValue(next);
    setFailed(false);
    startTransition(async () => {
      const result = await setCategory(transactionId, next);
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
        {value === "" ? <option value="">{uncategorizedLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
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
