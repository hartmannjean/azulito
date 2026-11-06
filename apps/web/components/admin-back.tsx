import Link from "next/link";

/** Atalho para voltar ao painel de administração, no alto das telas que moram nele. */
export function AdminBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="back-link">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{label}</span>
    </Link>
  );
}
