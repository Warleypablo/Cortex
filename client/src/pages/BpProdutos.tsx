import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// ============================================
// BP Targets (hardcoded from business plan)
// ============================================
const MONTHS = [
  "2025-12", "2026-01", "2026-02", "2026-03",
  "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09",
  "2026-10", "2026-11", "2026-12",
];

const MONTH_LABELS: Record<string, string> = {
  "2025-12": "Dez", "2026-01": "Jan", "2026-02": "Fev", "2026-03": "Mar",
  "2026-04": "Abr", "2026-05": "Mai", "2026-06": "Jun",
  "2026-07": "Jul", "2026-08": "Ago", "2026-09": "Set",
  "2026-10": "Out", "2026-11": "Nov", "2026-12": "Dez",
};

type SegmentName = "Performance" | "Creators" | "Social" | "Gestão de Comunidade" | "Others";
const SEGMENTS: SegmentName[] = ["Performance", "Creators", "Social", "Gestão de Comunidade", "Others"];

const SEGMENT_COLORS: Record<SegmentName, { dot: string; bg: string; text: string }> = {
  "Performance": { dot: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-700 dark:text-blue-400" },
  "Creators": { dot: "bg-purple-500", bg: "bg-purple-50 dark:bg-purple-950/20", text: "text-purple-700 dark:text-purple-400" },
  "Social": { dot: "bg-pink-500", bg: "bg-pink-50 dark:bg-pink-950/20", text: "text-pink-700 dark:text-pink-400" },
  "Gestão de Comunidade": { dot: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-400" },
  "Others": { dot: "bg-gray-400", bg: "bg-gray-50 dark:bg-zinc-800/30", text: "text-gray-600 dark:text-zinc-400" },
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
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

function pctClass(pct: number): string {
  if (pct >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function pctBadgeBg(pct: number): string {
  if (pct >= 100) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
  if (pct >= 80) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
}

// ============================================
// Types
// ============================================
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

  function toggleSegment(seg: string) {
    setExpanded((p) => ({ ...p, [seg]: !p[seg] }));
  }

  // Célula simples: mostra valor realizado OU target (futuro)
  function Cell({ orcado, real, format = "currency" }: { orcado: number; real: number | null; format?: "currency" | "number" }) {
    const fmt = format === "currency" ? (v: number) => `R$ ${fmtK(v)}` : (v: number) => v.toFixed(0);
    const isFuture = real === null;

    if (isFuture) {
      return (
        <td className="px-1.5 py-1.5 text-right text-[11px] text-gray-300 dark:text-zinc-700 whitespace-nowrap tabular-nums">
          {fmt(orcado)}
        </td>
      );
    }

    const pct = orcado > 0 ? (real / orcado) * 100 : 0;

    return (
      <td className="px-1.5 py-1.5 text-right text-[11px] whitespace-nowrap tabular-nums">
        <span className="text-gray-900 dark:text-white font-medium">{fmt(real)}</span>
        <span className={`ml-1 text-[10px] ${pctClass(pct)}`}>{pct.toFixed(0)}%</span>
      </td>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-full">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">BP Produtos 2026</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">MRR ativo por produto vs Business Plan</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-zinc-600">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> &ge;100%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 80-99%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt;80%</span>
        </div>
      </div>

      {/* KPI Cards - MRR Total + por segmento */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {/* Total */}
        <Card className="bg-gray-900 dark:bg-white border-0 col-span-1">
          <CardContent className="p-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">MRR Total</p>
            <p className="text-base font-bold text-white dark:text-gray-900 mt-0.5">
              {fmtCurrency(getTotalReal(currentMonth).mrr)}
            </p>
            {(() => {
              const bp = BP_MRR_TOTAL[currentMonth] || 0;
              const real = getTotalReal(currentMonth).mrr;
              const pct = bp > 0 ? (real / bp) * 100 : 0;
              return (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  <span className={pct >= 100 ? "text-emerald-400" : pct >= 80 ? "text-amber-400" : "text-red-400"}>
                    {pct.toFixed(0)}%
                  </span> de {fmtCurrency(bp)}
                </p>
              );
            })()}
          </CardContent>
        </Card>

        {/* Per segment */}
        {SEGMENTS.map((seg) => {
          const bp = BP_TARGETS[seg]?.[currentMonth];
          const real = getReal(currentMonth, seg);
          const mrrReal = real?.mrr || 0;
          const mrrBp = bp?.mrr || 0;
          const pct = mrrBp > 0 ? (mrrReal / mrrBp * 100) : 0;
          const colors = SEGMENT_COLORS[seg];

          return (
            <Card key={seg} className={`border-0 ${colors.bg}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <p className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider truncate`}>{seg}</p>
                </div>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">R$ {fmtK(mrrReal)}</p>
                <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${pctBadgeBg(pct)}`}>
                  {pct.toFixed(0)}%
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabela */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider sticky left-0 bg-white dark:bg-zinc-900 z-10 w-44">
                  Produto
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m}
                    className={`px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${
                      m === currentMonth
                        ? "text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/20"
                        : m < currentMonth && hasReal(m)
                        ? "text-gray-600 dark:text-zinc-400"
                        : "text-gray-300 dark:text-zinc-700"
                    }`}
                  >
                    {MONTH_LABELS[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {/* MRR Total row */}
              <tr className="bg-gray-50 dark:bg-zinc-800/40">
                <td className="px-3 py-2 text-xs font-bold text-gray-900 dark:text-white sticky left-0 bg-gray-50 dark:bg-zinc-800/40 z-10">
                  MRR Ativo Total
                </td>
                {MONTHS.map((m) => {
                  const bp = BP_MRR_TOTAL[m] || 0;
                  const t = getTotalReal(m);
                  return <Cell key={m} orcado={bp} real={hasReal(m) ? t.mrr : null} />;
                })}
              </tr>

              {/* Per segment - collapsible */}
              {SEGMENTS.map((seg) => {
                const colors = SEGMENT_COLORS[seg];
                const isOpen = expanded[seg] ?? false;

                return (
                  <React.Fragment key={seg}>
                    {/* Segment MRR row (clickable) */}
                    <tr
                      className="cursor-pointer hover:bg-gray-50/70 dark:hover:bg-zinc-800/20 transition-colors"
                      onClick={() => toggleSegment(seg)}
                    >
                      <td className="px-3 py-2 text-xs sticky left-0 bg-white dark:bg-zinc-900 z-10">
                        <div className="flex items-center gap-2">
                          {isOpen
                            ? <ChevronDown className="w-3 h-3 text-gray-400" />
                            : <ChevronRight className="w-3 h-3 text-gray-400" />
                          }
                          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <span className={`font-semibold ${colors.text}`}>{seg}</span>
                        </div>
                      </td>
                      {MONTHS.map((m) => {
                        const bp = BP_TARGETS[seg]?.[m]?.mrr || 0;
                        const real = getReal(m, seg);
                        return <Cell key={m} orcado={bp} real={hasReal(m) ? (real?.mrr || 0) : null} />;
                      })}
                    </tr>

                    {/* Expanded detail rows */}
                    {isOpen && (
                      <>
                        {/* AOV */}
                        <tr className="bg-gray-50/40 dark:bg-zinc-800/10">
                          <td className="px-3 py-1 text-[11px] text-gray-400 dark:text-zinc-500 pl-10 sticky left-0 bg-gray-50/40 dark:bg-zinc-900 z-10">AOV</td>
                          {MONTHS.map((m) => {
                            const bp = BP_TARGETS[seg]?.[m]?.aov || 0;
                            const real = getReal(m, seg);
                            const has = hasReal(m);
                            const realAov = has && real && real.contratos > 0 ? real.mrr / real.contratos : null;
                            return <Cell key={m} orcado={bp} real={has ? (realAov ?? 0) : null} />;
                          })}
                        </tr>
                        {/* Contratos */}
                        <tr className="bg-gray-50/40 dark:bg-zinc-800/10">
                          <td className="px-3 py-1 text-[11px] text-gray-400 dark:text-zinc-500 pl-10 sticky left-0 bg-gray-50/40 dark:bg-zinc-900 z-10">Contratos</td>
                          {MONTHS.map((m) => {
                            const bp = BP_TARGETS[seg]?.[m]?.contratos || 0;
                            const real = getReal(m, seg);
                            return <Cell key={m} orcado={bp} real={hasReal(m) ? (real?.contratos || 0) : null} format="number" />;
                          })}
                        </tr>
                        {/* Churn BP */}
                        <tr className="bg-gray-50/40 dark:bg-zinc-800/10">
                          <td className="px-3 py-1 text-[11px] text-gray-400 dark:text-zinc-500 pl-10 sticky left-0 bg-gray-50/40 dark:bg-zinc-900 z-10">Churn (BP)</td>
                          {MONTHS.map((m) => (
                            <td key={m} className="px-1.5 py-1 text-right text-[11px] text-gray-300 dark:text-zinc-700 whitespace-nowrap tabular-nums">
                              9%
                            </td>
                          ))}
                        </tr>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
