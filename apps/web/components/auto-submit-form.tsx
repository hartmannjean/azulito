"use client";

import { useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const SEARCH_DEBOUNCE_MS = 400;

/**
 * Barra de filtros sem botão: escolher num dropdown, marcar o checkbox ou
 * escolher o mês aplica o filtro na hora; no campo de busca aplica ao parar
 * de digitar (ou no Enter). O estado vive na URL — a página do servidor
 * relê os parâmetros — então voltar/recarregar mantém o filtro.
 */
export function AutoSubmitForm({
  basePath,
  className,
  clearLabel,
  children,
}: {
  basePath: string;
  className?: string;
  /** Texto do botão que limpa todos os filtros. */
  clearLabel: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value !== "") params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <form
      method="get"
      action={basePath}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        apply(event.currentTarget);
      }}
      onChange={(event) => {
        const form = event.currentTarget;
        const target = event.target;
        if (timer.current) clearTimeout(timer.current);
        if (target instanceof HTMLInputElement && target.type === "search") {
          timer.current = setTimeout(() => apply(form), SEARCH_DEBOUNCE_MS);
        } else {
          apply(form);
        }
      }}
    >
      {children}
      {/* Os campos são não controlados: só navegar para a URL limpa deixaria os valores antigos na tela. */}
      <button
        type="button"
        className="button secondary small"
        onClick={(event) => {
          const form = event.currentTarget.form;
          if (!form) return;
          if (timer.current) clearTimeout(timer.current);
          for (const element of Array.from(form.elements)) {
            if (element instanceof HTMLInputElement && element.type === "checkbox") element.checked = false;
            else if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) element.value = "";
          }
          router.push(basePath);
        }}
      >
        {clearLabel}
      </button>
    </form>
  );
}
