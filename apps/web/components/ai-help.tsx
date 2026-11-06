import type { ReactNode } from "react";

/** Explicação de como a IA funciona, recolhida: a tela vai direto ao resultado. */
export function AiHelp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="ai-help">
      <summary>{label}</summary>
      <p>{children}</p>
    </details>
  );
}
