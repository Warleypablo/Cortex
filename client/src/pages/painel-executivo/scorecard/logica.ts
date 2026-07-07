// Funções puras do scorecard: status vs. meta, delta M/M-1 e formatação de valor.
// Sem I/O, sem React — só lógica testável isoladamente (ver logica.test.ts).

import { formatCurrencyNoDecimals, formatPercent, formatDecimal } from "@/lib/utils";
import type { ScorecardDirection, ScorecardFormato } from "./tipos";

export type ScorecardStatus = "good" | "warn" | "bad" | null;

/**
 * Compara o valor atual com a meta e devolve o "farol" do scorecard.
 * - direction="up" (maior é melhor): good se atual>=meta, warn se atual>=90% da meta, senão bad.
 * - direction="down" (menor é melhor, ex. churn): good se atual<=meta, warn se atual<=110% da meta, senão bad.
 * - meta ausente (null/undefined) ou atual null → sem status (null).
 */
export function calcStatus(
  atual: number | null,
  meta: number | null | undefined,
  direction: ScorecardDirection,
): ScorecardStatus {
  if (atual === null || atual === undefined || meta === null || meta === undefined) return null;

  if (direction === "up") {
    if (atual >= meta) return "good";
    if (atual >= meta * 0.9) return "warn";
    return "bad";
  }

  // direction === "down"
  if (atual <= meta) return "good";
  if (atual <= meta * 1.1) return "warn";
  return "bad";
}

export interface DeltaM1Ponto {
  valor: number | null;
}

export interface DeltaM1Result {
  pct: number;
  dir: "up" | "down" | "flat";
}

/**
 * Compara os 2 últimos pontos VÁLIDOS (valor não-nulo) de uma série mensal ordenada
 * e devolve a variação percentual + direção. `flat` quando a variação é desprezível
 * (|pct| < 0.05) ou quando o ponto-base é 0 (evita divisão por zero / infinito).
 * null se a série tiver menos de 2 pontos válidos.
 */
export function deltaM1(serie?: DeltaM1Ponto[] | null): DeltaM1Result | null {
  if (!serie) return null;

  const validos = serie.filter((p) => p.valor !== null && p.valor !== undefined);
  if (validos.length < 2) return null;

  const [base, atual] = validos.slice(-2).map((p) => p.valor as number);

  if (base === 0) return { pct: 0, dir: "flat" };

  const pct = ((atual - base) / base) * 100;
  if (Math.abs(pct) < 0.05) return { pct, dir: "flat" };
  return { pct, dir: pct > 0 ? "up" : "down" };
}

/** Formata um valor numérico conforme o formato do scorecard. null/undefined/NaN → "—". */
export function formatValor(v: number | null | undefined, formato: ScorecardFormato): string {
  if (v === null || v === undefined || isNaN(v)) return "—";

  switch (formato) {
    case "brl":
      return formatCurrencyNoDecimals(v);
    case "pct":
      return formatPercent(v, 1);
    case "int":
      return new Intl.NumberFormat("pt-BR").format(Math.round(v));
    case "meses":
      return `${formatDecimal(v, 1)} meses`;
    default:
      return String(v);
  }
}
