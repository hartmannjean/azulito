"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const SEARCH_DEBOUNCE_MS = 400;

/**
 * Barra de filtros sem botão: escolher num dropdown, marcar o checkbox ou
 * escolher o mês aplica o filtro na hora; no campo de busca aplica ao parar
 * de digitar (ou no Enter). O estado vive na URL — a página do servidor
 * relê os parâmetros — então voltar/recarregar mantém o filtro.
 *
 * `children` são os filtros principais (sempre visíveis). `extra` são os
 * demais: no celular ficam atrás do botão "Mais filtros"; no desktop aparecem
 * todos na mesma barra (a regra de layout está no CSS, `.filter-extra`).
 */
export function AutoSubmitForm({
  basePath,
  className,
  clearLabel,
  extra,
  moreLabel,
  extraActive = 0,
  children,
}: {
  basePath: string;
  className?: string;
  /** Texto do botão que limpa todos os filtros. */
  clearLabel: string;
  extra?: ReactNode;
  moreLabel?: string;
  /** Quantos filtros de `extra` estão ativos (abre o painel e vira o contador do botão). */
  extraActive?: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(extraActive > 0);
  const panelId = useId();

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value !== "") params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  const clearButton = (
    <button
      type="button"
      className="button secondary small filter-clear"
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (!form) return;
        if (timer.current) clearTimeout(timer.current);
        for (const element of Array.from(form.elements)) {
          if (element instanceof HTMLInputElement && element.type === "checkbox") element.checked = false;
          // Rádios mantêm o `value`; só volta a marcar a opção "todas" (valor vazio).
          else if (element instanceof HTMLInputElement && element.type === "radio") element.checked = element.value === "";
          else if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) element.value = "";
        }
        router.push(basePath);
      }}
    >
      {clearLabel}
    </button>
  );

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
      {extra ? (
        <>
          <button
            type="button"
            className="filter-more-btn"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            <span>{moreLabel}</span>
            {extraActive > 0 ? <span className="filter-more-count">{extraActive}</span> : null}
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="filter-more-chevron">
              <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* Os campos são não controlados: só navegar para a URL limpa deixaria os valores antigos na tela. */}
          <div id={panelId} className={`filter-extra${open ? " is-open" : ""}`}>
            {extra}
            {clearButton}
          </div>
        </>
      ) : (
        clearButton
      )}
    </form>
  );
}
