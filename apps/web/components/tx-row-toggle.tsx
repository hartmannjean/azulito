"use client";

import { useEffect } from "react";

let users = 0;
let remove: (() => void) | null = null;

function setOpen(row: HTMLElement, open: boolean) {
  row.classList.toggle("is-open", open);
  row.querySelector(".tx-more")?.setAttribute("aria-expanded", String(open));
}

function onClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const row = target.closest<HTMLElement>(".tx-table tbody tr");
  if (!row) return;
  const button = target.closest(".tx-more");
  // Tocar num controle (categoria, mês de referência, link) não abre nem fecha o card.
  if (!button && target.closest("select, input, a, label, button")) return;
  setOpen(row, !row.classList.contains("is-open"));
}

/**
 * No celular cada transação é um card e o mês de referência fica escondido até
 * tocar no card (ou no botão de detalhes, que é o caminho por teclado/leitor de
 * tela). Um único ouvinte no documento serve todas as linhas; vários componentes
 * na mesma página compartilham esse ouvinte.
 */
export function TxRowToggle() {
  useEffect(() => {
    users += 1;
    if (users === 1) {
      document.addEventListener("click", onClick);
      remove = () => document.removeEventListener("click", onClick);
    }
    return () => {
      users -= 1;
      if (users === 0) {
        remove?.();
        remove = null;
      }
    };
  }, []);

  return null;
}
