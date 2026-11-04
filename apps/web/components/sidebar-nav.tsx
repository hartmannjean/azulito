"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; short: string; icon: string; exact?: boolean };

/** Menu lateral; o item da rota atual recebe `aria-current` e destaque. */
export function SidebarNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav className="side-nav" aria-label={label}>
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`side-nav-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="side-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="side-nav-label">{item.label}</span>
            <span className="side-nav-short">{item.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
