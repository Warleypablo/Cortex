import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { type ChurnContract } from "@/components/churn/types";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { severityHex } from "@/components/churn/severity";
import { agregarPorResponsavel, formatPct } from "@/components/churn/churnAggregations";

function evitabilidadeColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("evit") && !l.includes("inevit")) return "#ef4444";
  if (l.includes("inevit")) return "#10b981";
  return "#94a3b8";
}

export function DrawerSubMotivo({
  contratos,
  basePorResponsavel,
}: {
  contratos: ChurnContract[];
  basePorResponsavel?: Record<string, number>;
}): JSX.Element {
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

  const linhasResponsavel = useMemo(
    () => agregarPorResponsavel(contratos, basePorResponsavel ?? {}),
    [contratos, basePorResponsavel],
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (contratos.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-4">
        Nenhum contrato nesta seleção.
      </p>
    );
  }

  const maxMotivoMrr = motivoSubmotivoTree.length > 0 ? motivoSubmotivoTree[0].mrr : 1;
  const totalMotivoMrr = motivoSubmotivoTree.reduce((s, d) => s + d.mrr, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
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

      {/* ── Motivo → Submotivo donut ─────────────────────────────────────────── */}
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Motivo → Submotivo
        </p>

        {motivoSubmotivoTree.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Nenhum motivo registrado.
          </p>
        ) : (
          <div className="flex items-start gap-3">
            {/* Donut */}
            <div className="flex-shrink-0" style={{ width: 130, height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={motivoSubmotivoTree}
                    dataKey="mrr"
                    nameKey="motivo"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={58}
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={2}
                    stroke="transparent"
                  >
                    {motivoSubmotivoTree.map((item) => (
                      <Cell
                        key={item.motivo}
                        fill={severityHex(maxMotivoMrr > 0 ? item.mrr / maxMotivoMrr : 0)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrencyNoDecimals(value),
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend with clickable submotivo drill-down */}
            <div className="flex-1 space-y-1.5 min-w-0">
              {motivoSubmotivoTree.map((item) => {
                const pct = totalMotivoMrr > 0 ? Math.round((item.mrr / totalMotivoMrr) * 100) : 0;
                const color = severityHex(maxMotivoMrr > 0 ? item.mrr / maxMotivoMrr : 0);
                const isOpen = expandedMotivo === item.motivo;

                return (
                  <div key={item.motivo}>
                    {/* Motivo legend row — clickable */}
                    <div
                      className="cursor-pointer rounded-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors px-0.5"
                      onClick={() => setExpandedMotivo(isOpen ? null : item.motivo)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-gray-700 dark:text-zinc-300 truncate flex-1">
                          {item.motivo}
                        </span>
                        {isOpen ? (
                          <ChevronUp className="h-3 w-3 flex-shrink-0 text-gray-400 dark:text-zinc-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-400 dark:text-zinc-500" />
                        )}
                      </div>
                      <div className="pl-3.5 flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                          {item.count}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {formatCurrencyNoDecimals(item.mrr)}
                        </span>
                        <span className="text-[10px] font-medium tabular-nums" style={{ color }}>
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Submotivos (expanded) */}
                    {isOpen && item.submotivos.length > 0 && (
                      <div className="ml-3.5 mt-1 mb-1 space-y-0.5 border-l-2 pl-2" style={{ borderColor: color + "66" }}>
                        {item.submotivos.map((sub) => (
                          <div
                            key={sub.submotivo}
                            className="flex items-center justify-between gap-1 py-0.5"
                          >
                            <span className="truncate text-[11px] text-gray-500 dark:text-zinc-400 flex-1">
                              {sub.submotivo}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-700 dark:text-zinc-300 tabular-nums flex-shrink-0">
                              {sub.count}
                            </span>
                            <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0 ml-1">
                              {formatCurrencyNoDecimals(sub.mrr)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* ── Churn por responsável ────────────────────────────────────────────── */}
      {linhasResponsavel.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Churn por responsável
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700">
                <th className="text-left py-1.5 pr-2 font-medium text-gray-600 dark:text-zinc-400">
                  Responsável
                </th>
                <th className="text-right py-1.5 pr-2 font-medium text-gray-600 dark:text-zinc-400">
                  Contratos
                </th>
                <th className="text-right py-1.5 pr-2 font-medium text-gray-600 dark:text-zinc-400">
                  R$
                </th>
                <th className="text-right py-1.5 pr-2 font-medium text-gray-600 dark:text-zinc-400">
                  Part.
                </th>
                <th className="text-right py-1.5 font-medium text-gray-600 dark:text-zinc-400">
                  Churn%
                </th>
              </tr>
            </thead>
            <tbody>
              {linhasResponsavel.map((linha) => {
                const maxMrrResp = Math.max(
                  ...linhasResponsavel.filter((l) => !l.isNaoEspecificado).map((l) => l.mrr),
                  1,
                );
                const cor = linha.isNaoEspecificado
                  ? "#94a3b8"
                  : severityHex(maxMrrResp > 0 ? linha.mrr / maxMrrResp : 0);
                return (
                  <tr
                    key={linha.responsavel}
                    className="border-b border-gray-100 dark:border-zinc-800 last:border-0"
                  >
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cor }}
                        />
                        <span
                          className="truncate text-gray-700 dark:text-zinc-300"
                          title={linha.responsavel}
                        >
                          {linha.responsavel}
                        </span>
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                      {linha.contratos}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                      {formatCurrencyNoDecimals(linha.mrr)}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                      {linha.participacao !== null ? formatPct(linha.participacao, 0) : "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {linha.churnPct !== null ? (
                        formatPct(linha.churnPct)
                      ) : (
                        <span className="text-gray-400 dark:text-zinc-600 font-normal">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
