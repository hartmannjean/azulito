export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect width="34" height="34" rx="10" fill="url(#logo-gradient)" />
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
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
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
