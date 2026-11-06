"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AiBot } from "@/components/ai-bot";

/**
 * Fala da IA: robozinho ao lado de um balão. O texto vem resumido (poucas
 * linhas) e o botão "Ler mais" só aparece quando o texto realmente passa do
 * limite. `compact` tira o robô (para listas com várias falas).
 */
export function AiSays({
  children,
  label,
  compact = false,
  moreLabel,
  lessLabel,
}: {
  children: ReactNode;
  label?: string;
  compact?: boolean;
  moreLabel: string;
  lessLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [expanded, children]);

  return (
    <div className={`ai-says${compact ? " compact" : ""}`}>
      {compact ? null : <AiBot size={40} />}
      <div className="ai-says-bubble">
        {label ? <span className="ai-says-label">{label}</span> : null}
        <div ref={textRef} className={`ai-says-text${expanded ? "" : " clamped"}`}>
          {children}
        </div>
        {overflowing || expanded ? (
          <button type="button" className="ai-says-toggle" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? lessLabel : moreLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
