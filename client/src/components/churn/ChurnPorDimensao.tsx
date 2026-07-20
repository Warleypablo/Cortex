import React, { useState, useMemo } from "react";
import { type ChurnContract, type ChurnPorSquad, type ChurnPorPessoa } from "@/components/churn/types";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { severityBarClass } from "@/components/churn/severity";
import { ordenarPorTaxaDeChurn } from "@/components/churn/churnAggregations";

// "cluster" foi removido em 2026-07-20: o dado está 100% vazio na origem
// (cup_churn, cup_clientes e cortex_core.clientes), e enriquecer via
// Bitrix.crm_deal.bx_cluster cobriria só 33,7%. O backend segue calculando
// churn_por_cluster e filtros.clusters — para religar, basta devolver
// "cluster" a este type, a DIMENSAO_LABELS, a getFieldValue e a dimButtons.
// Ver docs/superpowers/specs/2026-07-20-churn-detalhamento-melhorias-design.md
export type Dimensao = "motivo" | "produto" | "pessoa" | "squad";

const DIMENSAO_LABELS: Record<Dimensao, string> = {
  motivo: "Motivo",
  produto: "Produto",
  pessoa: "Pessoa",
  squad: "Squad",
};

const SQUADS_IRRELEVANTES = ["turbo interno", "squad x", "interno", "x"];

function getFieldValue(c: ChurnContract, dim: Dimensao): string {
  switch (dim) {
    case "motivo":
      return c.motivo_cancelamento || "Não especificado";
    case "produto":
      return (c.produto && c.produto.trim()) ? c.produto : (c.servico || "Não especificado");
    case "pessoa":
      return c.responsavel || "Não especificado";
    case "squad": {
      const s = (c.squad || "").trim();
      if (!s || SQUADS_IRRELEVANTES.includes(s.toLowerCase())) return null as unknown as string;
      return s;
    }
  }
}

interface GroupedItem {
  label: string;
  count: number;
  mrr: number;
  pct: number;
  contratos: ChurnContract[];
}

/** Item for squad/pessoa — rate-based ranking from backend */
interface RateItem {
  label: string;
  mrr_ativo: number;
  mrr_perdido: number;
  /** null quando não há carteira na soma do range — exibir "—", nunca 0%. */
  percentual: number | null;
  /** Deriva de `percentual === null` — mesma base do denominador do percentual (soma do range), nunca do mrr_ativo isolado do 1º mês. */
  noBase: boolean;
  contratos: ChurnContract[]; // subset from contracts for drill
}

export function ChurnPorDimensao({
  contratos,
  onDrill,
  churnPorSquad,
  churnPorPessoa,
}: {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
  churnPorSquad?: ChurnPorSquad[];
  churnPorPessoa?: ChurnPorPessoa[];
}): JSX.Element {
  const [dimensao, setDimensao] = useState<Dimensao>("motivo");

  // ── Motivo / Produto / Cluster — share-of-churn from contracts ──────────────
  const grupos = useMemo((): GroupedItem[] => {
    if (dimensao === "squad" || dimensao === "pessoa") return [];
    const churnOnly = contratos.filter(c => c.tipo === "churn");
    if (churnOnly.length === 0) return [];

    const map: Record<string, { count: number; mrr: number; contratos: ChurnContract[] }> = {};

    churnOnly.forEach(c => {
      const key = getFieldValue(c, dimensao);
      if (key === null) return;
      if (!map[key]) map[key] = { count: 0, mrr: 0, contratos: [] };
      map[key].count++;
      map[key].mrr += c.valorr || 0;
      map[key].contratos.push(c);
    });

    const totalMrr = Object.values(map).reduce((s, v) => s + v.mrr, 0);

    return Object.entries(map)
      .map(([label, data]) => ({
        label,
        count: data.count,
        mrr: data.mrr,
        pct: totalMrr > 0 ? (data.mrr / totalMrr) * 100 : 0,
        contratos: data.contratos,
      }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [contratos, dimensao]);

  // ── Squad / Pessoa — rate-based ranking from backend ────────────────────────
  const rateItems = useMemo((): RateItem[] => {
    if (dimensao !== "squad" && dimensao !== "pessoa") return [];

    const churnOnly = contratos.filter(c => c.tipo === "churn");

    // Normalize exactly like the backend: trim + blank/null → "Não especificado"
    const normKey = (v: string | null | undefined): string =>
      v && v.trim() ? v.trim() : "Não especificado";

    // build contract subsets for drill (keyed by normalized label)
    const drillMap: Record<string, ChurnContract[]> = {};
    churnOnly.forEach(c => {
      let key: string;
      if (dimensao === "squad") {
        const s = (c.squad || "").trim();
        if (!s || SQUADS_IRRELEVANTES.includes(s.toLowerCase())) return;
        key = s; // squad is already trimmed; backend uses COALESCE(NULLIF(TRIM(...)),'Não especificado')
      } else {
        // pessoa
        key = normKey(c.responsavel);
      }
      if (!drillMap[key]) drillMap[key] = [];
      drillMap[key].push(c);
    });

    const backendArray: Array<{ label: string; mrr_ativo: number; mrr_perdido: number; percentual: number | null }> =
      dimensao === "squad"
        ? (churnPorSquad ?? []).map(i => ({ label: i.squad, mrr_ativo: i.mrr_ativo, mrr_perdido: i.mrr_perdido, percentual: i.percentual }))
        : (churnPorPessoa ?? []).map(i => ({ label: i.pessoa, mrr_ativo: i.mrr_ativo, mrr_perdido: i.mrr_perdido, percentual: i.percentual }));

    // filter irrelevant squads
    const filtered = dimensao === "squad"
      ? backendArray.filter(i => !SQUADS_IRRELEVANTES.includes(i.label.trim().toLowerCase()))
      : backendArray;

    // noBase deriva de percentual === null (soma das bases do range, mesmo
    // denominador do cálculo do próprio percentual) — nunca de mrr_ativo, que
    // é só a base do primeiro mês e pode ser 0 mesmo com carteira (e taxa
    // calculável) nos meses seguintes do range.
    const sorted = ordenarPorTaxaDeChurn(filtered);

    return sorted.map(i => ({
      label: i.label,
      mrr_ativo: i.mrr_ativo,
      mrr_perdido: i.mrr_perdido,
      percentual: i.percentual,
      noBase: i.noBase,
      contratos: drillMap[i.label] ?? [],
    }));
  }, [contratos, dimensao, churnPorSquad, churnPorPessoa]);

  const isRateMode = dimensao === "squad" || dimensao === "pessoa";

  // For rate mode — fallback to contract-derived share when backend data unavailable
  const backendAvailable = isRateMode && (
    (dimensao === "squad" && churnPorSquad !== undefined) ||
    (dimensao === "pessoa" && churnPorPessoa !== undefined)
  );

  // Fallback groups for squad/pessoa when no backend data
  const fallbackGrupos = useMemo((): GroupedItem[] => {
    if (!isRateMode || backendAvailable) return [];
    const churnOnly = contratos.filter(c => c.tipo === "churn");
    if (churnOnly.length === 0) return [];

    const map: Record<string, { count: number; mrr: number; contratos: ChurnContract[] }> = {};
    churnOnly.forEach(c => {
      const key = getFieldValue(c, dimensao);
      if (key === null) return;
      if (!map[key]) map[key] = { count: 0, mrr: 0, contratos: [] };
      map[key].count++;
      map[key].mrr += c.valorr || 0;
      map[key].contratos.push(c);
    });
    const totalMrr = Object.values(map).reduce((s, v) => s + v.mrr, 0);
    return Object.entries(map)
      .map(([label, data]) => ({
        label,
        count: data.count,
        mrr: data.mrr,
        pct: totalMrr > 0 ? (data.mrr / totalMrr) * 100 : 0,
        contratos: data.contratos,
      }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [contratos, dimensao, isRateMode, backendAvailable]);

  const maxMrr = grupos.length > 0 ? grupos[0].mrr : 1;
  const fallbackMaxMrr = fallbackGrupos.length > 0 ? fallbackGrupos[0].mrr : 1;

  // For rate-mode bar: normalize by max rate among withBase items (percentual conhecido)
  const maxRate = useMemo(() => {
    const withBase = rateItems.filter(
      (i): i is RateItem & { percentual: number } => !i.noBase && i.percentual !== null
    );
    return withBase.length > 0 ? Math.max(...withBase.map(i => i.percentual)) : 1;
  }, [rateItems]);

  const dimButtons: Dimensao[] = ["motivo", "produto", "pessoa", "squad"];

  const isEmpty =
    isRateMode
      ? (backendAvailable ? rateItems.length === 0 : fallbackGrupos.length === 0)
      : grupos.length === 0;

  return (
    <div className="rounded-xl border border-border/50 bg-white dark:bg-zinc-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Churn por{" "}
            <span className="text-muted-foreground font-normal">{DIMENSAO_LABELS[dimensao]}</span>
          </h3>
          {isRateMode && backendAvailable && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              taxa sobre a base do mês anterior
            </p>
          )}
        </div>

        {/* Dimension selector */}
        <div className="flex items-center gap-1 flex-wrap">
          {dimButtons.map(dim => (
            <button
              key={dim}
              onClick={() => setDimensao(dim)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                dimensao === dim
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {DIMENSAO_LABELS[dim]}
            </button>
          ))}
        </div>
      </div>

      {/* Ranking */}
      {isEmpty ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Nenhum churn no período selecionado.
        </div>
      ) : isRateMode && backendAvailable ? (
        // ── Rate mode (squad / pessoa) from backend ──
        <div className="space-y-2">
          {rateItems.map((item, idx) => {
            const pct = item.percentual;
            const semDados = item.noBase || pct === null;
            let normalized = 0;
            let barClass = "bg-zinc-300 dark:bg-zinc-600";
            if (!item.noBase && pct !== null) {
              normalized = maxRate > 0 ? pct / maxRate : 0;
              barClass = severityBarClass(normalized);
            }
            const barWidth = semDados ? 10 : normalized * 100;

            return (
              <div
                key={item.label}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40"
                onClick={() =>
                  onDrill(
                    `${DIMENSAO_LABELS[dimensao]}: ${item.label}`,
                    item.contratos
                  )
                }
              >
                {/* Rank number */}
                <span className="w-5 text-right text-xs text-muted-foreground tabular-nums flex-shrink-0">
                  {idx + 1}
                </span>

                {/* Label + bar */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate" title={item.label}>
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0 tabular-nums">
                      <span className={`text-xs ${semDados ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                        {item.noBase ? "s/ base" : pct === null ? "—" : `${pct.toFixed(1)}%`}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {formatCurrencyNoDecimals(item.mrr_perdido)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* Count badge */}
                <span className="flex-shrink-0 text-[10px] text-muted-foreground w-8 text-right tabular-nums">
                  {item.contratos.length}x
                </span>
              </div>
            );
          })}
        </div>
      ) : isRateMode && !backendAvailable ? (
        // ── Fallback: share-of-churn when backend data not yet loaded ──
        <div className="space-y-2">
          {fallbackGrupos.map((item, idx) => {
            const normalizedForSeverity = fallbackMaxMrr > 0 ? item.mrr / fallbackMaxMrr : 0;
            const barClass = severityBarClass(normalizedForSeverity);
            const barWidth = fallbackMaxMrr > 0 ? (item.mrr / fallbackMaxMrr) * 100 : 0;

            return (
              <div
                key={item.label}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40"
                onClick={() =>
                  onDrill(
                    `${DIMENSAO_LABELS[dimensao]}: ${item.label}`,
                    item.contratos
                  )
                }
              >
                <span className="w-5 text-right text-xs text-muted-foreground tabular-nums flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate" title={item.label}>
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0 tabular-nums">
                      <span className="text-xs text-muted-foreground">
                        {item.pct.toFixed(1)}%
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {formatCurrencyNoDecimals(item.mrr)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
                <span className="flex-shrink-0 text-[10px] text-muted-foreground w-8 text-right tabular-nums">
                  {item.count}x
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        // ── Share mode (motivo / produto / cluster) ──
        <div className="space-y-2">
          {grupos.map((item, idx) => {
            const normalizedForSeverity = maxMrr > 0 ? item.mrr / maxMrr : 0;
            const barClass = severityBarClass(normalizedForSeverity);
            const barWidth = maxMrr > 0 ? (item.mrr / maxMrr) * 100 : 0;

            return (
              <div
                key={item.label}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40"
                onClick={() =>
                  onDrill(
                    `${DIMENSAO_LABELS[dimensao]}: ${item.label}`,
                    item.contratos
                  )
                }
              >
                {/* Rank number */}
                <span className="w-5 text-right text-xs text-muted-foreground tabular-nums flex-shrink-0">
                  {idx + 1}
                </span>

                {/* Label + bar */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate" title={item.label}>
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0 tabular-nums">
                      <span className="text-xs text-muted-foreground">
                        {item.pct.toFixed(1)}%
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {formatCurrencyNoDecimals(item.mrr)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* Count badge */}
                <span className="flex-shrink-0 text-[10px] text-muted-foreground w-8 text-right tabular-nums">
                  {item.count}x
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
