/**
 * Ilustração decorativa do painel de login/cadastro — inteiramente vetorial
 * (sem imagem externa: CSP `img-src` já não permitiria host de terceiro, e
 * SVG embutido não pesa nada no bundle).
 */
export function AuthIllustration({ label }: { label: string }) {
  return (
    <svg
      className="auth-illustration"
      viewBox="0 0 440 360"
      fill="none"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="ai-card-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="ai-card-front" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#153745" />
          <stop offset="100%" stopColor="#0d2530" />
        </linearGradient>
        <linearGradient id="ai-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff9d80" />
          <stop offset="100%" stopColor="#ff7a59" />
        </linearGradient>
      </defs>

      {/* pontinhos soltos, sensação de "confete" discreto */}
      <circle cx="34" cy="60" r="3" fill="#2dd4bf" opacity="0.5" />
      <circle cx="404" cy="270" r="3" fill="#ff7a59" opacity="0.5" />
      <circle cx="380" cy="60" r="4" fill="#ffffff" opacity="0.25" />
      <circle cx="52" cy="290" r="4" fill="#ffffff" opacity="0.2" />

      {/* cartão de trás */}
      <rect
        x="70"
        y="90"
        width="220"
        height="140"
        rx="20"
        fill="url(#ai-card-back)"
        transform="rotate(-9 180 160)"
        opacity="0.9"
      />

      {/* cartão da frente */}
      <g transform="rotate(5 190 190)">
        <rect x="90" y="130" width="230" height="146" rx="20" fill="url(#ai-card-front)" stroke="#1d3646" />
        <circle cx="122" cy="164" r="12" fill="#2dd4bf" opacity="0.85" />
        <rect x="112" y="220" width="70" height="8" rx="4" fill="#eef6f5" opacity="0.35" />
        <rect x="112" y="238" width="110" height="8" rx="4" fill="#eef6f5" opacity="0.2" />
        <path
          d="M290 150c6 6 6 16 0 22"
          stroke="#ff7a59"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>

      {/* widget flutuante com mini-gráfico */}
      <g transform="translate(246 40)">
        <rect x="0" y="0" width="150" height="96" rx="16" fill="#0d2530" stroke="#1d3646" />
        <rect x="16" y="18" width="60" height="7" rx="3.5" fill="#eef6f5" opacity="0.3" />
        <path
          d="M16 70 L40 52 L64 62 L88 34 L112 46 L134 24"
          stroke="#2dd4bf"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="134" cy="24" r="4" fill="#2dd4bf" />
      </g>

      {/* moeda flutuante */}
      <g transform="translate(30 230)">
        <ellipse cx="34" cy="76" rx="30" ry="8" fill="#000000" opacity="0.18" />
        <circle cx="34" cy="34" r="34" fill="url(#ai-coin)" />
        <path
          d="M22 34c0-8 6-13 12-13s12 5 12 13-6 13-12 13-12-5-12-13Z"
          stroke="#fff"
          strokeWidth="2.4"
          opacity="0.85"
          fill="none"
        />
      </g>
    </svg>
  );
}
