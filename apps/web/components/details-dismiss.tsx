"use client";

import { useEffect } from "react";

/**
 * Faz os <details> que funcionam como popover (seletor de mês) fecharem com
 * Esc, clique fora, clique no fundo escurecido e ao escolher um link — sem isso
 * o painel ficava aberto sobre o conteúdo depois de navegar.
 */
export function DetailsDismiss({ selector }: { selector: string }) {
  useEffect(() => {
    const closeAll = () => {
      document.querySelectorAll<HTMLDetailsElement>(`${selector}[open]`).forEach((d) => {
        d.open = false;
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const owner = target.closest<HTMLDetailsElement>(selector);
      if (!owner) return closeAll();
      // Alvo é o próprio <details> quando se clica no fundo (::before); link dentro = navegou.
      if (target === owner || target.closest("a")) owner.open = false;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const open = document.querySelector<HTMLDetailsElement>(`${selector}[open]`);
      if (!open) return;
      open.open = false;
      open.querySelector<HTMLElement>("summary")?.focus();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [selector]);

  return null;
}
