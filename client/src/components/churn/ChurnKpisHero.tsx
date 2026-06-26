import React from "react";
import { type ChurnContract } from "@/components/churn/types";
import { severityTextClass, severityBarClass } from "@/components/churn/severity";
import { formatCurrencyNoDecimals } from "@/lib/utils";


// ── Pure helper ─────────────────────────────────────────────────────────────
/**
 * Returns the % of churned (non-abonado) contracts classified as evitável.
 *
 * Denominator: churns não-abonados with evitabilidade_churn filled (non-null/non-empty).
 * Rationale: nulls mean "not yet classified" — including them would dilute the
 * metric; the KPI is meaningful only over the classified population.
 *
 * A contract counts as evitável if evitabilidade_churn (case-insensitive)
 * contains "evit" but NOT "inevit".
 */
export function pctEvitavel(contratos: ChurnContract[]): number {
  const churns = contratos.filter(c => c.tipo === "churn" && !c.is_abonado);
  const classified = churns.filter(c => c.evitabilidade_churn != null && c.evitabilidade_churn !== "");
  if (classified.length === 0) return 0;

  const evitaveis = classified.filter(c => {
    const val = (c.evitabilidade_churn ?? "").toLowerCase();
    return val.includes("evit") && !val.includes("inevit");
  });

  return (evitaveis.length / classified.length) * 100;
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface ChurnKpisHeroProps {
  contratos: ChurnContract[];        // filteredContratos
  mrrPerdido: number;                // de filteredMetricas
  taxaChurn: number;                 // de filteredTaxaChurn
  nrrPct?: number;                   // de nrrData.nrr_pct
  churnPlanejado?: number;           // de churnPlanejado (opcional, não mais exibido)
  // Secondary stats — mantidas por compatibilidade mas não exibidas no estilo minimalista
  ltMedio?: number;
  ticketMedio?: number;
  gaugeStatusOverride?: { label: string; color: string; bg: string; dotBg: string };
}

// TETO de taxa de churn: 10% = severidade máxima.
// Fundamentação: meta BP é ~4%; 10% representa situação crítica inaceitável (2,5× meta).
const TAXA_CHURN_TETO = 10;

// Teto NRR: 30pp abaixo de 100% = crítico.
// NRR 70% ou menos é situação de colapso de receita.
const NRR_TETO_QUEDA = 30;

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  valueClass,
  sub,
  severityNorm,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
  severityNorm?: number; // 0–1, para barra
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-lg bg-white dark:bg-zinc-900/50 border border-border/50 min-w-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wider truncate">{label}</span>
      <span className={`text-3xl font-bold tabular-nums leading-none ${valueClass ?? "text-foreground"}`}>
        {value}
      </span>
      {sub && (
        <span className="text-xs text-muted-foreground truncate">{sub}</span>
      )}
      {severityNorm !== undefined && (
        <div className="mt-1 h-1 w-full rounded-full bg-border/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${severityBarClass(severityNorm)}`}
            style={{ width: `${Math.round(Math.min(severityNorm, 1) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export function ChurnKpisHero({
  contratos,
  mrrPerdido,
  taxaChurn,
  nrrPct,
}: ChurnKpisHeroProps): JSX.Element {
  const logosCount = contratos.filter(c => c.tipo === "churn" && !c.is_abonado).length;
  const evitavelPct = pctEvitavel(contratos);

  // Taxa: 0% = verde, TAXA_CHURN_TETO% = vermelho
  const taxaNorm = Math.min(taxaChurn / TAXA_CHURN_TETO, 1);

  // % evitável: mais alto = mais acionável = cor mais quente
  const evitavelNorm = evitavelPct / 100;

  // NRR: abaixo de 100% é ruim; NRR_TETO_QUEDA pp abaixo = crítico
  const nrrNorm = nrrPct !== undefined
    ? Math.min(Math.max(100 - nrrPct, 0) / NRR_TETO_QUEDA, 1)
    : undefined;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KpiCard
        label="Taxa de Churn %"
        value={`${taxaChurn.toFixed(2)}%`}
        valueClass={severityTextClass(taxaNorm)}
        sub="do MRR base no período"
        severityNorm={taxaNorm}
      />
      <KpiCard
        label="MRR Perdido"
        value={formatCurrencyNoDecimals(mrrPerdido)}
        sub="receita recorrente encerrada"
      />
      <KpiCard
        label="Logos Perdidos"
        value={String(logosCount)}
        sub="contratos encerrados"
      />
      <KpiCard
        label="% Evitável"
        value={`${evitavelPct.toFixed(1)}%`}
        valueClass={severityTextClass(evitavelNorm)}
        sub="dos classificados"
        severityNorm={evitavelNorm}
      />
      <KpiCard
        label="NRR"
        value={nrrPct !== undefined ? `${nrrPct.toFixed(1)}%` : "—"}
        valueClass={nrrNorm !== undefined ? severityTextClass(nrrNorm) : "text-muted-foreground"}
        sub="net revenue retention"
        severityNorm={nrrNorm}
      />
    </div>
  );
}
