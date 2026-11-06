"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NavIconGlyph, type NavIcon } from "@/components/nav-icons";

export type { NavIcon } from "@/components/nav-icons";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: NavIcon;
  exact?: boolean;
  /** No celular vai para a folha "Mais" em vez da barra inferior. */
  secondary?: boolean;
  /** Entrada da administração: no celular é a aba que leva ao painel; no desktop encabeça os filhos. */
  hub?: boolean;
  /** Item dentro da administração: aparece só na barra lateral (no celular, o painel lista). */
  child?: boolean;
  /** Outros caminhos que também marcam este item como ativo. */
  alsoActive?: string[];
};



/**
 * Menu do app. No desktop é a lista da sidebar; no celular vira uma barra
 * inferior flutuante (itens principais) + folha "Mais" com os demais.
 */
export function SidebarNav({
  items,
  label,
  moreLabel,
}: {
  items: NavItem[];
  label: string;
  moreLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const isActive = (item: NavItem) =>
    (item.alsoActive?.some(under) ?? false) || (item.exact ? pathname === item.href : under(item.href));

  const secondary = items.filter((i) => i.secondary);
  const moreActive = secondary.some(isActive);

  return (
    <nav className="side-nav" aria-label={label}>
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`side-nav-link${active ? " active" : ""}${item.secondary ? " is-secondary" : ""}${item.hub ? " is-hub" : ""}${item.child ? " is-child" : ""}`}
            aria-current={active ? (item.hub && pathname !== item.href ? "true" : "page") : undefined}
            onClick={() => setOpen(false)}
          >
            <span className="side-nav-icon" aria-hidden="true">
              <NavIconGlyph name={item.icon} />
            </span>
            <span className="side-nav-label">{item.label}</span>
            <span className="side-nav-short">{item.short}</span>
          </Link>
        );
      })}

      {secondary.length > 0 ? (
        <>
          <button
            type="button"
            className={`side-nav-link nav-more-btn${moreActive || open ? " active" : ""}`}
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="side-nav-icon" aria-hidden="true">
              <NavIconGlyph name="more" />
            </span>
            <span className="side-nav-short">{moreLabel}</span>
          </button>

          {open ? (
            <div className="nav-sheet-root">
              <button
                type="button"
                className="nav-sheet-backdrop"
                aria-label={moreLabel}
                onClick={() => setOpen(false)}
              />
              <div className="nav-sheet" role="dialog" aria-label={moreLabel}>
                <span className="nav-sheet-handle" aria-hidden="true" />
                <div className="nav-sheet-grid">
                  {secondary.map((item) => {
                    const active = isActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-sheet-item${active ? " active" : ""}`}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                      >
                        <span className="nav-sheet-icon" aria-hidden="true">
                          <NavIconGlyph name={item.icon} />
                        </span>
                        <span>{item.short}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </nav>
  );
}
