import type { ReactNode } from "react";

/**
 * Um gráfico SVG com viewBox largo some no celular (o texto de 12px vira ~4px).
 * Por isso cada gráfico é desenhado duas vezes, na proporção certa de cada tela,
 * e o CSS mostra só uma (a outra fica `display: none`, então o leitor de tela lê uma vez só).
 * A versão `mobile` usa rótulos compactos (ex.: "2,7 mil").
 */
export function DualChart({ desktop, mobile }: { desktop: ReactNode; mobile: ReactNode }) {
  return (
    <>
      <div className="chart-desktop">{desktop}</div>
      <div className="chart-mobile">{mobile}</div>
    </>
  );
}
