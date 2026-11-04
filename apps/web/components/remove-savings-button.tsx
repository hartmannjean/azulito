"use client";

import { useTransition } from "react";
import { removeSavingsAction } from "@/app/(app)/actions";

export function RemoveSavingsButton({ month, label }: { month: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="link-button"
      disabled={pending}
      title={label}
      aria-label={label}
      onClick={() => startTransition(() => removeSavingsAction(month))}
    >
      ✕
    </button>
  );
}
