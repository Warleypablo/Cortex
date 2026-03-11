import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";

// ============================================
// BP Targets
// ============================================
const MONTHS = [
  "2025-12", "2026-01", "2026-02", "2026-03",
  "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09",
  "2026-10", "2026-11", "2026-12",
];

const MONTH_LABELS: Record<string, string> = {
  "2025-12": "Dez/25", "2026-01": "Jan/26", "2026-02": "Fev/26", "2026-03": "Mar/26",
  "2026-04": "Abr/26", "2026-05": "Mai/26", "2026-06": "Jun/26",
  "2026-07": "Jul/26", "2026-08": "Ago/26", "2026-09": "Set/26",
  "2026-10": "Out/26", "2026-11": "Nov/26", "2026-12": "Dez/26",
};

type SegmentName = "Performance" | "Creators" | "Social" | "Gestão de Comunidade" | "Others";
const SEGMENTS: SegmentName[] = ["Performance", "Creators", "Social", "Gestão de Comunidade", "Others"];

const SEG_COLORS: Record<SegmentName, { dot: string; text: string }> = {
  "Performance": { dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  "Creators": { dot: "bg-purple-500", text: "text-purple-600 dark:text-purple-400" },
  "Social": { dot: "bg-pink-500", text: "text-pink-600 dark:text-pink-400" },
  "Gestão de Comunidade": { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  "Others": { dot: "bg-gray-400", text: "text-gray-500 dark:text-zinc-400" },
};

interface BpTarget { mrr: number; aov: number; contratos: number; churn: number; }

const BP_TARGETS: Record<SegmentName, Record<string, BpTarget>> = {
  "Performance": {
    "2025-12": { mrr: 475000, aov: 2699, contratos: 176, churn: 0.09 },
    "2026-01": { mrr: 496750, aov: 2732, contratos: 182, churn: 0.09 },
    "2026-02": { mrr: 516543, aov: 2760, contratos: 187, churn: 0.09 },
    "2026-03": { mrr: 534554, aov: 2785, contratos: 192, churn: 0.09 },
    "2026-04": { mrr: 558444, aov: 2809, contratos: 199, churn: 0.09 },
    "2026-05": { mrr: 580184, aov: 2829, contratos: 205, churn: 0.09 },
    "2026-06": { mrr: 599967, aov: 2847, contratos: 211, churn: 0.09 },
    "2026-07": { mrr: 626970, aov: 2865, contratos: 219, churn: 0.09 },
    "2026-08": { mrr: 651543, aov: 2879, contratos: 226, churn: 0.09 },
    "2026-09": { mrr: 673904, aov: 2892, contratos: 233, churn: 0.09 },
    "2026-10": { mrr: 703253, aov: 2905, contratos: 242, churn: 0.09 },
    "2026-11": { mrr: 729960, aov: 2915, contratos: 250, churn: 0.09 },
    "2026-12": { mrr: 754264, aov: 2924, contratos: 258, churn: 0.09 },
  },
  "Creators": {
    "2025-12": { mrr: 223000, aov: 4207.55, contratos: 53, churn: 0.09 },
    "2026-01": { mrr: 256680, aov: 4341.18, contratos: 59, churn: 0.09 },
    "2026-02": { mrr: 287329, aov: 4442.53, contratos: 65, churn: 0.09 },
    "2026-03": { mrr: 315219, aov: 4521.98, contratos: 70, churn: 0.09 },
    "2026-04": { mrr: 346849, aov: 4592.19, contratos: 76, churn: 0.09 },
    "2026-05": { mrr: 375633, aov: 4648.10, contratos: 81, churn: 0.09 },
    "2026-06": { mrr: 401826, aov: 4693.59, contratos: 86, churn: 0.09 },
    "2026-07": { mrr: 433162, aov: 4735.33, contratos: 91, churn: 0.09 },
    "2026-08": { mrr: 461677, aov: 4769.37, contratos: 97, churn: 0.09 },
    "2026-09": { mrr: 487626, aov: 4797.59, contratos: 102, churn: 0.09 },
    "2026-10": { mrr: 518740, aov: 4823.62, contratos: 108, churn: 0.09 },
    "2026-11": { mrr: 547053, aov: 4845.21, contratos: 113, churn: 0.09 },
    "2026-12": { mrr: 572818, aov: 4863.37, contratos: 118, churn: 0.09 },
  },
  "Social": {
    "2025-12": { mrr: 180000, aov: 2117.65, contratos: 85, churn: 0.09 },
    "2026-01": { mrr: 206800, aov: 2150.52, contratos: 96, churn: 0.09 },
    "2026-02": { mrr: 231188, aov: 2174.85, contratos: 106, churn: 0.09 },
    "2026-03": { mrr: 253381, aov: 2193.57, contratos: 116, churn: 0.09 },
    "2026-04": { mrr: 278577, aov: 2209.86, contratos: 126, churn: 0.09 },
    "2026-05": { mrr: 301505, aov: 2222.66, contratos: 136, churn: 0.09 },
    "2026-06": { mrr: 322369, aov: 2232.97, contratos: 144, churn: 0.09 },
    "2026-07": { mrr: 347356, aov: 2242.35, contratos: 155, churn: 0.09 },
    "2026-08": { mrr: 370094, aov: 2249.94, contratos: 164, churn: 0.09 },
    "2026-09": { mrr: 390786, aov: 2256.19, contratos: 173, churn: 0.09 },
    "2026-10": { mrr: 415615, aov: 2261.92, contratos: 184, churn: 0.09 },
    "2026-11": { mrr: 438210, aov: 2266.66, contratos: 193, churn: 0.09 },
    "2026-12": { mrr: 458771, aov: 2270.62, contratos: 202, churn: 0.09 },
  },
  "Gestão de Comunidade": {
    "2025-12": { mrr: 80000, aov: 7272.73, contratos: 11, churn: 0.09 },
    "2026-01": { mrr: 105050, aov: 7891.04, contratos: 13, churn: 0.09 },
    "2026-02": { mrr: 127846, aov: 8302.31, contratos: 15, churn: 0.09 },
    "2026-03": { mrr: 148589, aov: 8596.29, contratos: 17, churn: 0.09 },
    "2026-04": { mrr: 171216, aov: 8838.25, contratos: 19, churn: 0.09 },
    "2026-05": { mrr: 191807, aov: 9020.31, contratos: 21, churn: 0.09 },
    "2026-06": { mrr: 210544, aov: 9162.15, contratos: 23, churn: 0.09 },
    "2026-07": { mrr: 232095, aov: 9287.69, contratos: 25, churn: 0.09 },
    "2026-08": { mrr: 251707, aov: 9387.03, contratos: 27, churn: 0.09 },
    "2026-09": { mrr: 269553, aov: 9467.47, contratos: 28, churn: 0.09 },
    "2026-10": { mrr: 290293, aov: 9540.15, contratos: 30, churn: 0.09 },
    "2026-11": { mrr: 309167, aov: 9599.39, contratos: 32, churn: 0.09 },
    "2026-12": { mrr: 326342, aov: 9648.50, contratos: 34, churn: 0.09 },
  },
  "Others": {
    "2025-12": { mrr: 77000, aov: 1571, contratos: 49, churn: 0.09 },
    "2026-01": { mrr: 91570, aov: 1616, contratos: 57, churn: 0.09 },
    "2026-02": { mrr: 104829, aov: 1648, contratos: 64, churn: 0.09 },
    "2026-03": { mrr: 116894, aov: 1672, contratos: 70, churn: 0.09 },
    "2026-04": { mrr: 130374, aov: 1693, contratos: 77, churn: 0.09 },
    "2026-05": { mrr: 142640, aov: 1709, contratos: 83, churn: 0.09 },
    "2026-06": { mrr: 153802, aov: 1721, contratos: 89, churn: 0.09 },
    "2026-07": { mrr: 166960, aov: 1732, contratos: 96, churn: 0.09 },
    "2026-08": { mrr: 178934, aov: 1742, contratos: 103, churn: 0.09 },
    "2026-09": { mrr: 189830, aov: 1749, contratos: 109, churn: 0.09 },
    "2026-10": { mrr: 202745, aov: 1756, contratos: 115, churn: 0.09 },
    "2026-11": { mrr: 214498, aov: 1761, contratos: 122, churn: 0.09 },
    "2026-12": { mrr: 225193, aov: 1766, contratos: 128, churn: 0.09 },
  },
};

const BP_MRR_TOTAL: Record<string, number> = {
  "2025-12": 1035000, "2026-01": 1156850, "2026-02": 1267734, "2026-03": 1368637,
  "2026-04": 1485460, "2026-05": 1591769, "2026-06": 1688510,
  "2026-07": 1806544, "2026-08": 1913955, "2026-09": 2011699,
  "2026-10": 2130646, "2026-11": 2238888, "2026-12": 2337388,
};

// ============================================
// Helpers
// ============================================
function fmtK(value: number): string {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
}

function pctColor(pct: number): string {
  if (pct >= 100) return "text-emerald-500 dark:text-emerald-400";
  if (pct >= 80) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function varColor(v: number): string {
  if (v > 0) return "text-emerald-500 dark:text-emerald-400";
  if (v < 0) return "text-red-500 dark:text-red-400";
  return "text-gray-400 dark:text-zinc-500";
}

type ApiData = Record<string, Record<string, { mrr: number; contratos: number }>>;

// ============================================
// Component
// ============================================
export default function BpProdutos() {
  const { data, isLoading } = useQuery<ApiData>({
    queryKey: ["/api/bp-produtos/mrr-mensal"],
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const realizado = data || {};
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  function getReal(month: string, segment: SegmentName) {
    return realizado[month]?.[segment] || null;
  }

  function getTotalReal(month: string) {
    let mrr = 0, contratos = 0;
    for (const seg of SEGMENTS) {
      const r = getReal(month, seg);
      if (r) { mrr += r.mrr; contratos += r.contratos; }
    }
    return { mrr, contratos };
  }

  function hasReal(month: string) { return !!realizado[month]; }

  // Variation % between two months
  function calcVar(currMrr: number, prevMrr: number): number | null {
    if (prevMrr === 0) return null;
    return ((currMrr - prevMrr) / prevMrr) * 100;
  }

  const isFuture = (m: string) => m > currentMonth;
  const isCurrent = (m: string) => m === currentMonth;

  const stickyBase = "sticky left-0 z-10 border-r border-gray-100 dark:border-zinc-800";
  const varColBg = "bg-gray-50/40 dark:bg-zinc-800/15";
  const varColBorder = "border-l border-gray-100/60 dark:border-zinc-800/40";

  // Render a Δ variation cell
  function varCell(prevMonth: string, currMonth: string, segment: SegmentName | "total", key: string) {
    const hasPrev = hasReal(prevMonth);
    const hasCurr = hasReal(currMonth);
    if (!hasPrev || !hasCurr) {
      return <td key={key} className={`px-1 py-3 text-center ${varColBg} ${varColBorder}`} />;
    }
    const prevMrr = segment === "total" ? getTotalReal(prevMonth).mrr : (getReal(prevMonth, segment)?.mrr || 0);
    const currMrr = segment === "total" ? getTotalReal(currMonth).mrr : (getReal(currMonth, segment)?.mrr || 0);
    const v = calcVar(currMrr, prevMrr);
    if (v === null) {
      return <td key={key} className={`px-1 py-3 text-center ${varColBg} ${varColBorder}`} />;
    }
    return (
      <td key={key} className={`px-1 py-3 text-center ${varColBg} ${varColBorder}`}>
        <span className={`text-[10px] font-medium tabular-nums ${varColor(v)}`}>
          {v >= 0 ? "+" : ""}{v.toFixed(1)}%
        </span>
      </td>
    );
  }

  // Empty Δ cell for expanded rows
  function emptyVarCell(key: string) {
    return <td key={key} className={`px-1 py-2 ${varColBg} ${varColBorder}`} />;
  }

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">BP Produtos 2026</h1>
        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
          Evolução MRR por segmento vs Business Plan
        </p>
      </div>

      {/* Tabela principal */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700">
                <th className={`${stickyBase} bg-white dark:bg-zinc-900 px-5 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider min-w-[180px]`}>
                  Segmento
                </th>
                {MONTHS.flatMap((m, i) => {
                  const cells: React.ReactNode[] = [];
                  // Δ header before each month (except first)
                  if (i > 0) {
                    cells.push(
                      <th key={`dh-${m}`} className={`px-1 py-3 text-center text-[9px] font-medium text-gray-300 dark:text-zinc-600 uppercase ${varColBg} ${varColBorder} w-[44px]`}>
                        Δ
                      </th>
                    );
                  }
                  cells.push(
                    <th
                      key={m}
                      className={`px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap min-w-[76px] ${
                        isCurrent(m)
                          ? "text-blue-600 dark:text-blue-400"
                          : isFuture(m)
                          ? "text-gray-300 dark:text-zinc-600"
                          : "text-gray-500 dark:text-zinc-400"
                      }`}
                    >
                      {MONTH_LABELS[m]}
                    </th>
                  );
                  return cells;
                })}
              </tr>
            </thead>
            <tbody>
              {/* ─── MRR Total ─── */}
              <tr className="border-b border-gray-200 dark:border-zinc-700">
                <td className={`${stickyBase} bg-gray-50 dark:bg-zinc-800/40 px-5 py-4 text-sm font-bold text-gray-900 dark:text-white`}>
                  MRR Total
                </td>
                {MONTHS.flatMap((m, i) => {
                  const cells: React.ReactNode[] = [];
                  if (i > 0) cells.push(varCell(MONTHS[i - 1], m, "total", `vt-${m}`));
                  const bp = BP_MRR_TOTAL[m] || 0;
                  const has = hasReal(m);
                  const mrr = has ? getTotalReal(m).mrr : 0;
                  const pct = has && bp > 0 ? (mrr / bp) * 100 : null;
                  cells.push(
                    <td key={m} className={`px-2 py-3 text-center ${isCurrent(m) ? "bg-blue-50/50 dark:bg-blue-950/15" : ""}`}>
                      <div className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                        {has ? fmtK(mrr) : <span className="text-gray-300 dark:text-zinc-600 font-normal">{fmtK(bp)}</span>}
                      </div>
                      {pct !== null && (
                        <div className={`text-[10px] font-medium tabular-nums mt-0.5 ${pctColor(pct)}`}>
                          {pct.toFixed(0)}%
                        </div>
                      )}
                    </td>
                  );
                  return cells;
                })}
              </tr>

              {/* ─── Segmentos ─── */}
              {SEGMENTS.map((seg) => {
                const colors = SEG_COLORS[seg];
                const isExp = expanded[seg] ?? false;
                return (
                  <React.Fragment key={seg}>
                    {/* Linha MRR do segmento */}
                    <tr
                      className="border-b border-gray-100 dark:border-zinc-800/60 cursor-pointer hover:bg-gray-50/60 dark:hover:bg-zinc-800/20 transition-colors"
                      onClick={() => setExpanded((p) => ({ ...p, [seg]: !p[seg] }))}
                    >
                      <td className={`${stickyBase} bg-white dark:bg-zinc-900 px-5 py-4`}>
                        <div className="flex items-center gap-2.5">
                          {isExp
                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />}
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                          <span className={`text-sm font-semibold ${colors.text}`}>{seg}</span>
                        </div>
                      </td>
                      {MONTHS.flatMap((m, i) => {
                        const cells: React.ReactNode[] = [];
                        if (i > 0) cells.push(varCell(MONTHS[i - 1], m, seg, `v-${seg}-${m}`));
                        const bp = BP_TARGETS[seg]?.[m]?.mrr || 0;
                        const has = hasReal(m);
                        const mrr = getReal(m, seg)?.mrr || 0;
                        const pct = has && bp > 0 ? (mrr / bp) * 100 : null;
                        cells.push(
                          <td key={`${seg}-${m}`} className={`px-2 py-3 text-center ${isCurrent(m) ? "bg-blue-50/50 dark:bg-blue-950/15" : ""}`}>
                            <div className="text-[13px] font-medium text-gray-900 dark:text-white tabular-nums">
                              {has ? fmtK(mrr) : <span className="text-gray-300 dark:text-zinc-600 font-normal">{fmtK(bp)}</span>}
                            </div>
                            {pct !== null && (
                              <div className={`text-[10px] font-medium tabular-nums mt-0.5 ${pctColor(pct)}`}>
                                {pct.toFixed(0)}%
                              </div>
                            )}
                          </td>
                        );
                        return cells;
                      })}
                    </tr>

                    {/* Expandido: Orçado */}
                    {isExp && (
                      <tr className="border-b border-gray-50 dark:border-zinc-800/30">
                        <td className={`${stickyBase} bg-gray-50/40 dark:bg-zinc-800/15 pl-14 pr-4 py-2 text-[11px] text-gray-400 dark:text-zinc-500`}>
                          Orçado (BP)
                        </td>
                        {MONTHS.flatMap((m, i) => {
                          const cells: React.ReactNode[] = [];
                          if (i > 0) cells.push(emptyVarCell(`vo-${seg}-${m}`));
                          cells.push(
                            <td key={`o-${seg}-${m}`} className={`px-2 py-2 text-center text-[11px] text-gray-400 dark:text-zinc-500 tabular-nums ${isCurrent(m) ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}`}>
                              {fmtK(BP_TARGETS[seg]?.[m]?.mrr || 0)}
                            </td>
                          );
                          return cells;
                        })}
                      </tr>
                    )}

                    {/* Expandido: AOV */}
                    {isExp && (
                      <tr className="border-b border-gray-50 dark:border-zinc-800/30">
                        <td className={`${stickyBase} bg-gray-50/40 dark:bg-zinc-800/15 pl-14 pr-4 py-2 text-[11px] text-gray-400 dark:text-zinc-500`}>
                          AOV
                        </td>
                        {MONTHS.flatMap((m, i) => {
                          const cells: React.ReactNode[] = [];
                          if (i > 0) cells.push(emptyVarCell(`va-${seg}-${m}`));
                          const bpAov = BP_TARGETS[seg]?.[m]?.aov || 0;
                          const has = hasReal(m);
                          const real = getReal(m, seg);
                          const aov = has && real && real.contratos > 0 ? real.mrr / real.contratos : null;
                          cells.push(
                            <td key={`a-${seg}-${m}`} className={`px-2 py-2 text-center text-[11px] tabular-nums ${isCurrent(m) ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}`}>
                              {aov !== null ? (
                                <>
                                  <span className="text-gray-900 dark:text-white font-medium">{fmtK(aov)}</span>
                                  <span className="text-gray-300 dark:text-zinc-600 ml-1">/ {fmtK(bpAov)}</span>
                                </>
                              ) : (
                                <span className="text-gray-300 dark:text-zinc-600">{fmtK(bpAov)}</span>
                              )}
                            </td>
                          );
                          return cells;
                        })}
                      </tr>
                    )}

                    {/* Expandido: Contratos */}
                    {isExp && (
                      <tr className="border-b border-gray-100 dark:border-zinc-800/60">
                        <td className={`${stickyBase} bg-gray-50/40 dark:bg-zinc-800/15 pl-14 pr-4 py-2 text-[11px] text-gray-400 dark:text-zinc-500`}>
                          Contratos
                        </td>
                        {MONTHS.flatMap((m, i) => {
                          const cells: React.ReactNode[] = [];
                          if (i > 0) cells.push(emptyVarCell(`vc-${seg}-${m}`));
                          const bpC = BP_TARGETS[seg]?.[m]?.contratos || 0;
                          const has = hasReal(m);
                          const cttos = has ? (getReal(m, seg)?.contratos || 0) : null;
                          cells.push(
                            <td key={`c-${seg}-${m}`} className={`px-2 py-2 text-center text-[11px] tabular-nums ${isCurrent(m) ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}`}>
                              {cttos !== null ? (
                                <>
                                  <span className="text-gray-900 dark:text-white font-medium">{cttos}</span>
                                  <span className="text-gray-300 dark:text-zinc-600 ml-1">/ {bpC}</span>
                                </>
                              ) : (
                                <span className="text-gray-300 dark:text-zinc-600">{bpC}</span>
                              )}
                            </td>
                          );
                          return cells;
                        })}
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
