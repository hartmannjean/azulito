"use client";

// Sem estado em React de propósito: qual ícone mostrar depende só do
// atributo `data-theme` (setado pelo script inline em `layout.tsx` antes do
// primeiro paint) via CSS puro — ver `.theme-toggle` em globals.css. Isso
// evita ler `document` num efeito só pra decidir o ícone inicial, o que
// causaria mismatch de hidratação (servidor não sabe a preferência salva no
// localStorage do browser).
export function ThemeToggle({ label }: { label: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("azulito-theme", next);
    } catch {
      // Preferência de tema é cosmética — se o storage falhar (modo
      // privado, quota), a troca ainda funciona nesta sessão.
    }
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label}>
      <span className="theme-toggle-icon theme-toggle-icon-dark" aria-hidden="true">🌙</span>
      <span className="theme-toggle-icon theme-toggle-icon-light" aria-hidden="true">☀️</span>
    </button>
  );
}
