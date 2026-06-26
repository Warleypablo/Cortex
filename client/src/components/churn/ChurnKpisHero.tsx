import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, Hash, Percent, DollarSign } from "lucide-react";
import { type ChurnContract } from "@/components/churn/types";
import { ChurnGauge } from "@/components/churn/ui/ChurnGauge";
import { TechKpiCard } from "@/components/churn/ui/TechKpiCard";
import { StatPill } from "@/components/churn/ui/StatPill";
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
  churnPlanejado?: number;           // de churnPlanejado (opcional)
  // Full gaugeStatusOverride object for ChurnGauge
  gaugeStatusOverride?: { label: string; color: string; bg: string; dotBg: string };
  // Secondary stats
  ltMedio?: number;
  ticketMedio?: number;
}

// ── Component ────────────────────────────────────────────────────────────────
export function ChurnKpisHero({
  contratos,
  mrrPerdido,
  taxaChurn,
  gaugeStatusOverride,
  churnPlanejado,
  ltMedio = 0,
  ticketMedio = 0,
}: ChurnKpisHeroProps): JSX.Element {
  const logosCount = contratos.filter(c => c.tipo === "churn" && !c.is_abonado).length;
  const evitavelPct = pctEvitavel(contratos);

  return (
    <div className="space-y-4">
      {/* ── Row 1: Gauge + 3 KPIs ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Gauge */}
        <Card className="relative overflow-hidden border-border/50 bg-white dark:bg-zinc-900/50">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Taxa de Churn
            </span>
            <ChurnGauge
              value={taxaChurn}
              statusOverride={gaugeStatusOverride}
            />
            {churnPlanejado !== undefined && churnPlanejado > 0 && (
              <p className="text-[11px] text-muted-foreground text-center">
                Meta: <span className="font-semibold">{formatCurrencyNoDecimals(churnPlanejado)}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* MRR Perdido */}
        <TechKpiCard
          title="MRR Perdido"
          value={formatCurrencyNoDecimals(mrrPerdido)}
          subtitle="receita recorrente encerrada"
          icon={DollarSign}
          gradient="bg-gradient-to-r from-red-500 to-rose-600"
          shadowColor="rgba(239,68,68,0.25)"
        />

        {/* Nº Logos Perdidos */}
        <TechKpiCard
          title="Logos Perdidos"
          value={String(logosCount)}
          subtitle="contratos encerrados no período"
          icon={Hash}
          gradient="bg-gradient-to-r from-orange-500 to-amber-600"
          shadowColor="rgba(249,115,22,0.25)"
        />

        {/* % Evitável */}
        <TechKpiCard
          title="% Evitável"
          value={`${evitavelPct.toFixed(1)}%`}
          subtitle="dos classificados com evitabilidade"
          icon={Percent}
          gradient="bg-gradient-to-r from-violet-500 to-purple-600"
          shadowColor="rgba(139,92,246,0.25)"
        />
      </div>

      {/* ── Row 2: Secondary StatPills ─────────────────────────────────── */}
      {(ltMedio > 0 || ticketMedio > 0) && (
        <div className="flex flex-wrap gap-2">
          {ltMedio > 0 && (
            <StatPill
              label="Lifetime médio"
              value={`${ltMedio.toFixed(1)} meses`}
              tone="info"
            />
          )}
          {ticketMedio > 0 && (
            <StatPill
              label="Ticket médio"
              value={formatCurrencyNoDecimals(ticketMedio)}
              tone="default"
            />
          )}
        </div>
      )}
    </div>
  );
}
