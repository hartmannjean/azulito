"use client";

import { useTransition } from "react";
import { removeBudgetAction } from "@/app/(app)/actions";

export function RemoveBudgetButton({ category, label }: { category: string; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="link-button"
      disabled={pending}
      onClick={() => startTransition(() => removeBudgetAction(category))}
    >
      {label}
    </button>
  );
}
