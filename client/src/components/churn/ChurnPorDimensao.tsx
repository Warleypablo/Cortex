import React, { useState, useMemo } from "react";
import { type ChurnContract } from "@/components/churn/types";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { severityBarClass } from "@/components/churn/severity";

export type Dimensao = "motivo" | "produto" | "cluster" | "pessoa" | "squad";

const DIMENSAO_LABELS: Record<Dimensao, string> = {
  motivo: "Motivo",
  produto: "Produto",
  cluster: "Cluster",
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
    case "cluster":
      return c.cluster || "Não especificado";
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

export function ChurnPorDimensao({
  contratos,
  onDrill,
}: {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}): JSX.Element {
  const [dimensao, setDimensao] = useState<Dimensao>("motivo");

  const grupos = useMemo((): GroupedItem[] => {
    const churnOnly = contratos.filter(c => c.tipo === "churn" && !c.is_abonado);
    if (churnOnly.length === 0) return [];

    const map: Record<string, { count: number; mrr: number; contratos: ChurnContract[] }> = {};

    churnOnly.forEach(c => {
      const key = getFieldValue(c, dimensao);
      // For squad dimension, null means irrelevant — skip
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

  const maxMrr = grupos.length > 0 ? grupos[0].mrr : 1;

  const dimButtons: Dimensao[] = ["motivo", "produto", "cluster", "pessoa", "squad"];

  return (
    <div className="rounded-xl border border-border/50 bg-white dark:bg-zinc-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground">
          Churn por{" "}
          <span className="text-muted-foreground font-normal">[dimensão]</span>
        </h3>

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
      {grupos.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Nenhum churn no período selecionado.
        </div>
      ) : (
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
