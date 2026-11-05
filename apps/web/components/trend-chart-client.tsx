"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type TrendColumn = {
  month: string;
  /** Rótulo curto do eixo ("out"). */
  short: string;
  /** Título da dica ("Outubro de 2026"). */
  title: string;
  /** Posição do ponto no gráfico, em % da largura e da altura. */
  x: number;
  incomeY: number;
  expenseY: number;
  incomeText: string;
  expenseText: string;
  balanceText: string;
  balancePositive: boolean;
  /** Destino ao clicar; null quando a página não navega (demonstração). */
  href: string | null;
  ariaLabel: string;
};

export type TrendLabels = {
  income: string;
  expenses: string;
  balance: string;
  hint: string;
  ariaLabel: string;
};

/**
 * Receitas x despesas por mês, interativo: passar o mouse ou focar uma coluna
 * (teclado) mostra os valores do mês; clicar abre aquele mês no painel.
 * Os textos chegam prontos do servidor (o dicionário tem funções).
 */
export function TrendChartClient({
  columns,
  selectedMonth,
  incomeLine,
  incomeArea,
  expenseLine,
  gridLabels,
  gridLines,
  viewBox,
  labels,
}: {
  columns: TrendColumn[];
  selectedMonth: string;
  incomeLine: string;
  incomeArea: string;
  expenseLine: string;
  gridLabels: { y: number; text: string }[];
  gridLines: number[];
  viewBox: { width: number; height: number };
  labels: TrendLabels;
}) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const focused = columns.find((column) => column.month === (active ?? selectedMonth)) ?? null;
  const clickable = columns.some((column) => column.href !== null);

  return (
    <>
      <div className="trend-plot" onMouseLeave={() => setActive(null)}>
        <svg
          className="trend-svg"
          viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={labels.ariaLabel}
        >
          <defs>
            <linearGradient id="trend-income-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--positive)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="trend-income-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
            <linearGradient id="trend-expense-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
          </defs>
          {gridLines.map((y) => (
            <line key={y} className="trend-gridline" x1={0} x2={viewBox.width} y1={y} y2={y} />
          ))}
          <path d={incomeArea} fill="url(#trend-income-fill)" stroke="none" className="fade-area" />
          <path
            d={incomeLine}
            pathLength={1}
            className="draw-line"
            fill="none"
            stroke="url(#trend-income-stroke)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={expenseLine}
            pathLength={1}
            className="draw-line delay"
            fill="none"
            stroke="url(#trend-expense-stroke)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>

        {gridLabels.map((label) => (
          <span key={label.y} className="trend-ylabel" style={{ top: `${label.y}%` }} aria-hidden="true">
            {label.text}
          </span>
        ))}

        {columns.map((column) => (
          <span key={`pt-${column.month}`} aria-hidden="true">
            <span className="trend-pt income" style={{ left: `${column.x}%`, top: `${column.incomeY}%` }} />
            <span className="trend-pt expense" style={{ left: `${column.x}%`, top: `${column.expenseY}%` }} />
          </span>
        ))}

        {focused ? (
          <>
            <span className="trend-guide" style={{ left: `${focused.x}%` }} aria-hidden="true" />
            <span className="trend-dot income" style={{ left: `${focused.x}%`, top: `${focused.incomeY}%` }} aria-hidden="true" />
            <span className="trend-dot expense" style={{ left: `${focused.x}%`, top: `${focused.expenseY}%` }} aria-hidden="true" />
          </>
        ) : null}

        {columns.map((column) => (
          <button
            key={column.month}
            type="button"
            className={`trend-col${column.month === selectedMonth ? " selected" : ""}`}
            style={{ left: `${column.x}%` }}
            aria-label={column.ariaLabel}
            aria-current={column.month === selectedMonth ? "date" : undefined}
            onMouseEnter={() => setActive(column.month)}
            onFocus={() => setActive(column.month)}
            onBlur={() => setActive(null)}
            onClick={() => column.href && router.push(column.href)}
            data-static={column.href === null ? "" : undefined}
          />
        ))}

        {focused && active ? (
          <div
            className={`trend-tip${focused.x < 18 ? " left" : focused.x > 82 ? " right" : ""}`}
            style={{ left: `${focused.x}%` }}
            role="status"
          >
            <b>{focused.title}</b>
            <span>
              <i className="legend-dot income" /> {labels.income} <em>{focused.incomeText}</em>
            </span>
            <span>
              <i className="legend-dot expense" /> {labels.expenses} <em>{focused.expenseText}</em>
            </span>
            <span className="trend-tip-balance">
              {labels.balance} <em className={focused.balancePositive ? "positive" : "negative"}>{focused.balanceText}</em>
            </span>
          </div>
        ) : null}
      </div>

      <div className="trend-labels">
        {columns.map((column) => (
          <span key={column.month} className={`trend-label${column.month === (active ?? selectedMonth) ? " active" : ""}`}>
            {column.short}
          </span>
        ))}
      </div>
      {clickable ? <p className="trend-hint">{labels.hint}</p> : null}
    </>
  );
}
