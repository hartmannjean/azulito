import { useId } from "react";

export function LogoMark({ size = 34 }: { size?: number }) {
  // Id único por instância: com ids repetidos o gradiente apontava para o primeiro
  // logo da página, que pode estar escondido (display: none) e então não pintava.
  const gradientId = `logo-gradient-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect width="34" height="34" rx="10" fill={`url(#${gradientId})`} />
      <path
        d="M7 20c2.5-6.5 5.5-8.5 8-5s5.2 3.2 7.5-3.5"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="22.5" cy="11.5" r="1.9" fill="white" />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--logo-grad-a)" />
          <stop offset="100%" stopColor="var(--logo-grad-b)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ size = 34, withName = true }: { size?: number; withName?: boolean }) {
  return (
    <div className="brand">
      <LogoMark size={size} />
      {withName ? <span className="brand-name">Azulito</span> : null}
    </div>
  );
}
