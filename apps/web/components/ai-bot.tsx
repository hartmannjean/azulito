/**
 * Robozinho do Azulito: marca tudo o que vem da IA (falas, sugestões, botões).
 * SVG puro, sem imagem externa; os olhos piscam só por CSS (desligado com
 * prefers-reduced-motion). `animated={false}` para usar dentro de botões.
 */
export function AiBot({ size = 28, animated = true, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <svg
      className={`ai-bot${animated ? " animated" : ""} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="ai-bot-head" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c3d4ff" />
        </linearGradient>
        <linearGradient id="ai-bot-chest" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#073bbd" />
        </linearGradient>
      </defs>
      <line x1="24" y1="9.5" x2="24" y2="5.5" stroke="#073bbd" strokeWidth="1.8" strokeLinecap="round" />
      <circle className="ai-bot-led" cx="24" cy="4" r="3" fill="#67e8f9" />
      <circle cx="5.5" cy="24.5" r="5" fill="#073bbd" />
      <circle cx="5.5" cy="24.5" r="2.6" fill="none" stroke="#67e8f9" strokeWidth="1.6" />
      <circle cx="42.5" cy="24.5" r="5" fill="#073bbd" />
      <circle cx="42.5" cy="24.5" r="2.6" fill="none" stroke="#67e8f9" strokeWidth="1.6" />
      <rect x="7" y="9.5" width="34" height="29" rx="14" fill="url(#ai-bot-head)" stroke="#9db7f5" strokeWidth="0.8" />
      <rect x="11" y="14.5" width="26" height="19" rx="9" fill="#06113a" />
      <g className="ai-bot-eyes" fill="none" stroke="#67e8f9" strokeWidth="2.1" strokeLinecap="round">
        <path d="M15.2 24.2c1.2-3.4 4.8-3.4 6 0" />
        <path d="M26.8 24.2c1.2-3.4 4.8-3.4 6 0" />
      </g>
      <path d="M20.6 28.3c2 1.8 4.8 1.8 6.8 0" fill="none" stroke="#67e8f9" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="13" y="38.5" width="22" height="8" rx="4" fill="url(#ai-bot-chest)" />
      <path d="M19.5 44l3-3 2 2 4-4.2" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
