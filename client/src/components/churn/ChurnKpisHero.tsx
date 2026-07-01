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
  const churns = contratos.filter(c => c.tipo === "churn");
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
  contratos: ChurnContract[];
  mrrPerdido: number;
  taxaChurn: number;
  mrrBase?: number;
  nrrPct?: number;
  ltMedio?: number;
  ticketMedio?: number;
  onDrill?: (titulo: string, contratos: ChurnContract[]) => void;
  /** Clique no card NRR → abre o drawer de cross-sell/up-sell do período */
  onNrrClick?: () => void;
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
  onClick,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
  severityNorm?: number; // 0–1, para barra
  onClick?: () => void;
}): JSX.Element {
  return (
    <div
      className={[
        "flex flex-col gap-1 p-4 rounded-lg bg-white dark:bg-zinc-900/50 border border-border/50 min-w-0",
        onClick ? "cursor-pointer hover:bg-muted/40 transition-colors" : "",
      ].join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
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

// ── StatPill: compact secondary metric ───────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border/40">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export function ChurnKpisHero({
  contratos,
  mrrPerdido,
  taxaChurn,
  mrrBase,
  nrrPct,
  ltMedio,
  ticketMedio,
  onDrill,
  onNrrClick,
}: ChurnKpisHeroProps): JSX.Element {
  const churns = contratos.filter(c => c.tipo === "churn");
  const logosCount = churns.length;
  const evitavelPct = pctEvitavel(contratos);

  // Taxa: 0% = verde, TAXA_CHURN_TETO% = vermelho
  const taxaNorm = Math.min(taxaChurn / TAXA_CHURN_TETO, 1);

  // % evitável: mais alto = mais acionável = cor mais quente
  const evitavelNorm = evitavelPct / 100;

  // NRR: abaixo de 100% é ruim; NRR_TETO_QUEDA pp abaixo = crítico
  const nrrNorm = nrrPct !== undefined
    ? Math.min(Math.max(100 - nrrPct, 0) / NRR_TETO_QUEDA, 1)
    : undefined;

  const hasSecondary = (ltMedio !== undefined && ltMedio > 0) || (ticketMedio !== undefined && ticketMedio > 0);

  // Subsets for drill
  const evitaveis = churns.filter(c => {
    const val = (c.evitabilidade_churn ?? "").toLowerCase();
    return val.includes("evit") && !val.includes("inevit");
  });

  const makeDrill = (titulo: string, subset: ChurnContract[]) =>
    onDrill && subset.length > 0 ? () => onDrill(titulo, subset) : undefined;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Taxa de Churn %"
          value={`${taxaChurn.toFixed(2)}%`}
          valueClass={severityTextClass(taxaNorm)}
          sub={mrrBase && mrrBase > 0 ? `base: ${formatCurrencyNoDecimals(mrrBase)}` : "do MRR base no período"}
          severityNorm={taxaNorm}
          onClick={makeDrill("Churn do período", churns)}
        />
        <KpiCard
          label="MRR Perdido"
          value={formatCurrencyNoDecimals(mrrPerdido)}
          sub="receita recorrente encerrada"
          onClick={makeDrill("Churn do período — MRR perdido", churns)}
        />
        <KpiCard
          label="Logos Perdidos"
          value={String(logosCount)}
          sub="contratos encerrados"
          onClick={makeDrill("Logos perdidos", churns)}
        />
        <KpiCard
          label="% Evitável"
          value={`${evitavelPct.toFixed(1)}%`}
          valueClass={severityTextClass(evitavelNorm)}
          sub="dos classificados"
          severityNorm={evitavelNorm}
          onClick={makeDrill("Churn evitável", evitaveis)}
        />
        <KpiCard
          label="NRR"
          value={nrrPct !== undefined ? `${nrrPct.toFixed(1)}%` : "—"}
          valueClass={nrrNorm !== undefined ? severityTextClass(nrrNorm) : "text-muted-foreground"}
          sub="net revenue retention"
          severityNorm={nrrNorm}
          onClick={onNrrClick}
        />
      </div>
      {hasSecondary && (
        <div className="flex flex-wrap gap-2">
          {ltMedio !== undefined && ltMedio > 0 && (
            <StatPill label="Lifetime médio" value={`${ltMedio.toFixed(1)} meses`} />
          )}
          {ticketMedio !== undefined && ticketMedio > 0 && (
            <StatPill label="Ticket médio" value={formatCurrencyNoDecimals(ticketMedio)} />
          )}
        </div>
      )}
    </div>
  );
}
