import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { type ChurnContract } from "@/components/churn/types";
import { formatCurrencyNoDecimals } from "@/lib/utils";

function evitabilidadeColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("evit") && !l.includes("inevit")) return "#ef4444";
  if (l.includes("inevit")) return "#10b981";
  return "#94a3b8";
}

export function DrawerSubMotivo({ contratos }: { contratos: ChurnContract[] }): JSX.Element {
  const [expandedMotivo, setExpandedMotivo] = useState<string | null>(null);

  // ── Evitabilidade breakdown ────────────────────────────────────────────────
  const evitabilidadeData = useMemo(() => {
    if (contratos.length === 0) return [];
    const groups: Record<string, { count: number; mrr: number }> = {};
    contratos.forEach((c) => {
      const label = c.evitabilidade_churn || "Não especificado";
      if (!groups[label]) groups[label] = { count: 0, mrr: 0 };
      groups[label].count++;
      groups[label].mrr += c.valorr || 0;
    });
    return Object.entries(groups)
      .map(([label, d]) => ({ label, count: d.count, mrr: d.mrr }))
      .sort((a, b) => b.count - a.count);
  }, [contratos]);

  // ── Motivo → Submotivo tree ────────────────────────────────────────────────
  const motivoSubmotivoTree = useMemo(() => {
    if (contratos.length === 0) return [];

    const tree: Record<
      string,
      { count: number; mrr: number; submotivos: Record<string, { count: number; mrr: number }> }
    > = {};

    contratos.forEach((c) => {
      const motivo = c.motivo_cancelamento || "Não especificado";
      if (!tree[motivo]) tree[motivo] = { count: 0, mrr: 0, submotivos: {} };
      tree[motivo].count++;
      tree[motivo].mrr += c.valorr || 0;

      const sub = c.submotivo || "Sem submotivo";
      if (!tree[motivo].submotivos[sub]) tree[motivo].submotivos[sub] = { count: 0, mrr: 0 };
      tree[motivo].submotivos[sub].count++;
      tree[motivo].submotivos[sub].mrr += c.valorr || 0;
    });

    return Object.entries(tree)
      .map(([motivo, data]) => ({
        motivo,
        count: data.count,
        mrr: data.mrr,
        submotivos: Object.entries(data.submotivos)
          .map(([sub, info]) => ({ submotivo: sub, count: info.count, mrr: info.mrr }))
          .sort((a, b) => b.mrr - a.mrr),
      }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [contratos]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (contratos.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-4">
        Nenhum contrato nesta seleção.
      </p>
    );
  }

  const maxMotivoCount = Math.max(...motivoSubmotivoTree.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      {/* ── Evitabilidade donut ──────────────────────────────────────────────── */}
      {evitabilidadeData.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Evitabilidade
          </p>
          <div className="flex items-center gap-3">
            {/* Donut */}
            <div className="flex-shrink-0" style={{ width: 130, height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={evitabilidadeData}
                    dataKey="mrr"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={58}
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={2}
                    stroke="transparent"
                  >
                    {evitabilidadeData.map((item) => (
                      <Cell key={item.label} fill={evitabilidadeColor(item.label)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrencyNoDecimals(value),
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: "var(--background, #fff)",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            {(() => {
              const totalMrr = evitabilidadeData.reduce((s, d) => s + d.mrr, 0);
              return (
                <div className="flex-1 space-y-1.5 min-w-0">
                  {evitabilidadeData.map((item) => {
                    const pct = totalMrr > 0 ? Math.round((item.mrr / totalMrr) * 100) : 0;
                    return (
                      <div key={item.label} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: evitabilidadeColor(item.label) }}
                          />
                          <span className="text-xs text-gray-700 dark:text-zinc-300 truncate">
                            {item.label}
                          </span>
                        </div>
                        <div className="pl-3.5 flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                            {item.count}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {formatCurrencyNoDecimals(item.mrr)}
                          </span>
                          <span className="text-[10px] font-medium tabular-nums" style={{ color: evitabilidadeColor(item.label) }}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Motivo → Submotivo tree ──────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Motivo → Submotivo
        </p>
        {motivoSubmotivoTree.map((item) => {
          const barWidth = Math.max((item.count / maxMotivoCount) * 100, 5);
          const isOpen = expandedMotivo === item.motivo;

          return (
            <div key={item.motivo}>
              {/* Motivo row */}
              <div
                className="rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => setExpandedMotivo(isOpen ? null : item.motivo)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isOpen ? (
                      <ChevronUp className="h-3 w-3 flex-shrink-0 text-gray-400 dark:text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-400 dark:text-zinc-500" />
                    )}
                    <span className="truncate text-xs font-medium text-gray-900 dark:text-white">
                      {item.motivo}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                    {item.count}
                  </span>
                </div>
                {/* MRR bar */}
                <div className="flex items-center gap-2 mt-1 pl-5">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">
                    {formatCurrencyNoDecimals(item.mrr)}
                  </span>
                </div>
              </div>

              {/* Submotivos (expanded) */}
              {isOpen && item.submotivos.length > 0 && (
                <div className="ml-5 mt-1 space-y-1 border-l-2 border-orange-200 dark:border-orange-800 pl-2">
                  {(() => {
                    const subMaxCount = Math.max(...item.submotivos.map((s) => s.count), 1);
                    return item.submotivos.map((sub) => {
                    const subBarWidth = Math.max((sub.count / subMaxCount) * 100, 5);
                    return (
                      <div
                        key={sub.submotivo}
                        className="rounded-md border border-gray-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 px-2 py-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-gray-500 dark:text-zinc-400">
                            {sub.submotivo}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                            {sub.count}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-orange-300 dark:bg-orange-600 transition-all"
                              style={{ width: `${subBarWidth}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">
                            {formatCurrencyNoDecimals(sub.mrr)}
                          </span>
                        </div>
                      </div>
                    );
                  });
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
