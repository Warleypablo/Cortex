/** Direção que conta como melhora. Churn e estoque melhoram caindo. */
export type Direcao = "up" | "down";

export function classesDelta(delta: number | null, melhor: Direcao | undefined): string {
  if (delta == null || delta === 0 || !melhor) return "text-gray-400 dark:text-zinc-500";
  const bom = melhor === "up" ? delta > 0 : delta < 0;
  return bom ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

export function textoDelta(delta: number | null, percentual = false): string {
  if (delta == null) return "—";
  const sinal = delta > 0 ? "+" : "";
  const n = delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return percentual ? `${sinal}${n} p.p.` : `${sinal}${n}%`;
}

export function CelulaDelta({
  delta,
  melhor,
  percentual = false,
}: {
  delta: number | null;
  melhor: Direcao | undefined;
  /** true quando a linha já é um percentual: o Δ vira p.p. */
  percentual?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium ${classesDelta(
        delta,
        melhor,
      )}`}
    >
      {textoDelta(delta, percentual)}
    </td>
  );
}
