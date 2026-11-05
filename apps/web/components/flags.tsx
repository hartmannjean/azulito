/**
 * Bandeiras em SVG: o emoji de bandeira não aparece no Windows (vira as letras
 * "BR"/"US"), então o desenho vai junto no código e fica nítido em qualquer sistema.
 */
const DOTS = [1.8, 4.4, 7, 9.6].flatMap((x, row) =>
  [1.4, 3.7, 6, 8.3].map((y, col) => (row + col) % 2 === 0 ? { x, y } : null).filter((d): d is { x: number; y: number } => d !== null),
);

export function FlagBR({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 20) / 28} viewBox="0 0 28 20" aria-hidden="true" focusable="false">
      <rect width="28" height="20" rx="3" fill="#009c3b" />
      <polygon points="14,2.4 25.4,10 14,17.6 2.6,10" fill="#ffdf00" />
      <circle cx="14" cy="10" r="4.3" fill="#002776" />
      <path d="M9.8 9.3 Q14 7.9 18.2 11" stroke="#fff" strokeWidth="0.9" fill="none" />
    </svg>
  );
}

export function FlagUS({ size = 22 }: { size?: number }) {
  const stripe = 20 / 7;
  return (
    <svg width={size} height={(size * 20) / 28} viewBox="0 0 28 20" aria-hidden="true" focusable="false">
      <clipPath id="flag-us-clip">
        <rect width="28" height="20" rx="3" />
      </clipPath>
      <g clipPath="url(#flag-us-clip)">
        <rect width="28" height="20" fill="#fff" />
        {[0, 2, 4, 6].map((i) => (
          <rect key={i} y={i * stripe} width="28" height={stripe} fill="#d22030" />
        ))}
        <rect width="12.4" height={stripe * 4} fill="#2b3d8f" />
        {DOTS.map((d) => (
          <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r="0.55" fill="#fff" />
        ))}
      </g>
    </svg>
  );
}
