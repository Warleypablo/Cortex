import type { CSSProperties, ReactNode } from "react";
import type { Qoq } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Kit de identidade visual do deck trimestral.
// Todos os slides dedicados consomem estes ingredientes para manter o mesmo DNA:
// accents canônicos, count-up, entrance em stagger, badges QoQ, barras que crescem.
// ─────────────────────────────────────────────────────────────────────────────

export const ACCENT = {
  mrr: "#34d399",      // emerald — receita recorrente
  vendas: "#38bdf8",   // sky — vendas
  churn: "#f87171",    // red — churn/perdas
  pontual: "#a855f7",  // purple — pontual
  cyan: "#22d3ee",     // cyan — totais/tech
  amber: "#fbbf24",    // amber — atenção/pausados
} as const;

export function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return formatBRL(v);
}

export function fmtK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(Math.round(v));
}

/** Entrada padrão dos blocos: fade + sobe, com atraso incremental. Espalhe no elemento raiz do bloco. */
export function entrance(delayMs: number) {
  return {
    className: "animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none",
    style: { animationDelay: `${delayMs}ms`, animationFillMode: "both" as const },
  };
}

/**
 * Props de entrada já MESCLADAS com className/style locais.
 *
 * ⚠️ Use isto em vez de `<div {...entrance(n)} className="...">`: o spread vem
 * ANTES, então o className local sobrescreve o da animação e ela nunca roda
 * (o mesmo vale para o style, que carrega o animationDelay).
 */
export function entranceWith(delayMs: number, className = "", style?: CSSProperties) {
  const e = entrance(delayMs);
  return {
    className: `${e.className} ${className}`.trim(),
    style: { ...e.style, ...style },
  };
}

/** Badge de variação QoQ com cor semântica (betterDirection decide o que é verde). */
export function QoqBadge({ q, sufixo = "QoQ" }: { q: Qoq; sufixo?: string }) {
  if (!q.anterior) return null;
  const pct = ((q.atual - q.anterior) / Math.abs(q.anterior)) * 100;
  const positivo = pct >= 0;
  const bom = q.betterDirection === "up" ? positivo : !positivo;
  return (
    <span className={`text-xs font-bold tabular-nums rounded-full px-2 py-0.5 ${bom ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
      {positivo ? "▲" : "▼"} {Math.abs(pct).toFixed(1).replace(".", ",")}% {sufixo}
    </span>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-zinc-400">{label}</span>
    </span>
  );
}

/** Keyframes compartilhados (growX p/ barras). Renderize UMA vez por slide que usar barras. */
export function DeckKeyframes() {
  return (
    <style>{`
      @keyframes deckGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @media (prefers-reduced-motion: reduce) {
        .deck-grow { animation: none !important; transform: scaleX(1) !important; }
      }
    `}</style>
  );
}

/** Barra horizontal que cresce da esquerda na entrada. width = fração 0-100 (%). */
export function GrowBar({
  widthPct,
  delayMs,
  children,
  className = "",
  style,
}: {
  widthPct: number;
  delayMs: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`deck-grow h-full flex ${className}`}
      style={{
        ...style,
        width: `${Math.max(Math.min(widthPct, 100), 0)}%`,
        transformOrigin: "left",
        animation: `deckGrowX 600ms ease-out ${delayMs}ms both`,
      }}
    >
      {children}
    </div>
  );
}

export const TOOLTIP_STYLE = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
} as const;
