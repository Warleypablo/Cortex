import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  "2025-12": "Dez/25",
  "2026-01": "Jan/26", "2026-02": "Fev/26", "2026-03": "Mar/26",
  "2026-04": "Abr/26", "2026-05": "Mai/26", "2026-06": "Jun/26",
  "2026-07": "Jul/26", "2026-08": "Ago/26", "2026-09": "Set/26",
  "2026-10": "Out/26", "2026-11": "Nov/26", "2026-12": "Dez/26",
};

const TRIMESTRE_LABELS: Record<string, string> = {
  "2025-12": "Bookado",
  "2026-01": "1 Tri", "2026-02": "1 Tri", "2026-03": "1 Tri",
  "2026-04": "2 Tri", "2026-05": "2 Tri", "2026-06": "2 Tri",
  "2026-07": "3 Tri", "2026-08": "3 Tri", "2026-09": "3 Tri",
  "2026-10": "4 Tri", "2026-11": "4 Tri", "2026-12": "4 Tri",
};

type SegmentName = "Performance" | "Creators" | "Social" | "Gestão de Comunidade" | "Others";
const SEGMENTS: SegmentName[] = ["Performance", "Creators", "Social", "Gestão de Comunidade", "Others"];

const SEGMENT_COLORS: Record<SegmentName, string> = {
  "Performance": "bg-blue-500",
  "Creators": "bg-purple-500",
  "Social": "bg-pink-500",
  "Gestão de Comunidade": "bg-amber-500",
  "Others": "bg-gray-500",
};

interface BpTarget {
  mrr: number;
  aov: number;
  contratos: number;
  churn: number;
}

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

// MRR Ativo total (soma dos segmentos)
const BP_MRR_TOTAL: Record<string, number> = {
  "2025-12": 1035000, "2026-01": 1156850, "2026-02": 1267734, "2026-03": 1368637,
  "2026-04": 1485460, "2026-05": 1591769, "2026-06": 1688510,
  "2026-07": 1806544, "2026-08": 1913955, "2026-09": 2011699,
  "2026-10": 2130646, "2026-11": 2238888, "2026-12": 2337388,
};

// Churn total
const BP_CHURN_TOTAL: Record<string, number> = {
  "2025-12": 93150, "2026-01": 104117, "2026-02": 114096, "2026-03": 123177,
  "2026-04": 133691, "2026-05": 143259, "2026-06": 151966,
  "2026-07": 162589, "2026-08": 172256, "2026-09": 181053,
  "2026-10": 191758, "2026-11": 201500, "2026-12": 210365,
};

// ============================================
// Helpers
// ============================================
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function atingimentoColor(orcado: number, realizado: number): string {
  if (!orcado) return "";
  const pct = realizado / orcado;
  if (pct >= 1) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 0.8) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function atingimentoBg(orcado: number, realizado: number): string {
  if (!orcado) return "";
  const pct = realizado / orcado;
  if (pct >= 1) return "bg-emerald-50 dark:bg-emerald-950/30";
  if (pct >= 0.8) return "bg-amber-50 dark:bg-amber-950/30";
  return "bg-red-50 dark:bg-red-950/30";
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const realizado = data || {};

  // Calcula o mês atual (YYYY-MM)
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

  // Verifica se o mês tem dados realizados
  function hasRealizado(month: string) {
    return !!realizado[month];
  }

  // Renderiza uma célula orçado/realizado
  function renderCell(orcado: number, real: number | null, format: "currency" | "number" | "percent") {
    const isFuture = real === null;
    const formatter = format === "currency" ? formatCurrency : format === "number" ? formatNumber : formatPercent;

    if (isFuture) {
      return (
        <td className="px-2 py-1.5 text-right text-xs text-gray-400 dark:text-zinc-600 whitespace-nowrap">
          {formatter(orcado)}
        </td>
      );
    }

    const pct = orcado > 0 ? ((real / orcado) * 100).toFixed(0) : "-";

    return (
      <td className={`px-2 py-1.5 text-right text-xs whitespace-nowrap ${atingimentoBg(orcado, real)}`}>
        <div className="font-medium text-gray-900 dark:text-white">{formatter(real)}</div>
        <div className={`text-[10px] ${atingimentoColor(orcado, real)}`}>
          {formatter(orcado)} ({pct}%)
        </div>
      </td>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full overflow-x-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BP Produtos</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          MRR ativo por produto vs Business Plan 2026
        </p>
      </div>

      {/* KPI Cards - MRR Total do mês atual */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {SEGMENTS.map((seg) => {
          const bp = BP_TARGETS[seg]?.[currentMonth];
          const real = getReal(currentMonth, seg);
          const mrrReal = real?.mrr || 0;
          const mrrBp = bp?.mrr || 0;
          const pct = mrrBp > 0 ? (mrrReal / mrrBp * 100) : 0;

          return (
            <Card key={seg} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${SEGMENT_COLORS[seg]}`} />
                  <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 truncate">{seg}</span>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(mrrReal)}</div>
                <div className={`text-xs ${atingimentoColor(mrrBp, mrrReal)}`}>
                  {pct.toFixed(0)}% do BP ({formatCurrency(mrrBp)})
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabela completa */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900 dark:text-white">MRR por Produto - Orçado vs Realizado</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[1200px]">
              <thead>
                {/* Trimestre header */}
                <tr className="border-b border-gray-100 dark:border-zinc-800">
                  <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-400 dark:text-zinc-500 sticky left-0 bg-white dark:bg-zinc-900 z-10 w-48" />
                  {MONTHS.map((m, i) => {
                    const label = TRIMESTRE_LABELS[m];
                    const prev = i > 0 ? TRIMESTRE_LABELS[MONTHS[i - 1]] : "";
                    const showLabel = label !== prev;
                    return (
                      <th key={m} className="px-2 py-1 text-center text-[10px] font-medium text-gray-400 dark:text-zinc-500">
                        {showLabel ? label : ""}
                      </th>
                    );
                  })}
                </tr>
                {/* Month header */}
                <tr className="border-b border-gray-200 dark:border-zinc-700">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-zinc-300 sticky left-0 bg-white dark:bg-zinc-900 z-10 w-48">
                    Métrica
                  </th>
                  {MONTHS.map((m) => (
                    <th
                      key={m}
                      className={`px-2 py-2 text-center text-xs font-semibold whitespace-nowrap ${
                        m === currentMonth
                          ? "text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                          : "text-gray-700 dark:text-zinc-300"
                      }`}
                    >
                      {MONTH_LABELS[m]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* MRR Total */}
                <tr className="bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-700 font-semibold">
                  <td className="px-3 py-2 text-xs text-gray-900 dark:text-white sticky left-0 bg-gray-50 dark:bg-zinc-800/50 z-10">
                    MRR Ativo Total
                  </td>
                  {MONTHS.map((m) => {
                    const bp = BP_MRR_TOTAL[m] || 0;
                    const t = getTotalReal(m);
                    const has = hasRealizado(m);
                    return renderCell(bp, has ? t.mrr : null, "currency");
                  })}
                </tr>

                {/* Per segment */}
                {SEGMENTS.map((seg) => (
                  <>
                    {/* Separator */}
                    <tr key={`${seg}-sep`} className="border-b border-gray-100 dark:border-zinc-800">
                      <td colSpan={MONTHS.length + 1} className="px-3 py-1.5 sticky left-0 bg-white dark:bg-zinc-900 z-10">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${SEGMENT_COLORS[seg]}`} />
                          <span className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">{seg}</span>
                        </div>
                      </td>
                    </tr>

                    {/* MRR */}
                    <tr key={`${seg}-mrr`} className="border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-1.5 text-xs text-gray-600 dark:text-zinc-400 pl-7 sticky left-0 bg-white dark:bg-zinc-900 z-10">MRR</td>
                      {MONTHS.map((m) => {
                        const bp = BP_TARGETS[seg]?.[m]?.mrr || 0;
                        const real = getReal(m, seg);
                        const has = hasRealizado(m);
                        return <React.Fragment key={m}>{renderCell(bp, has ? (real?.mrr || 0) : null, "currency")}</React.Fragment>;
                      })}
                    </tr>

                    {/* AOV */}
                    <tr key={`${seg}-aov`} className="border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-1.5 text-xs text-gray-600 dark:text-zinc-400 pl-7 sticky left-0 bg-white dark:bg-zinc-900 z-10">AOV</td>
                      {MONTHS.map((m) => {
                        const bp = BP_TARGETS[seg]?.[m]?.aov || 0;
                        const real = getReal(m, seg);
                        const has = hasRealizado(m);
                        const realAov = has && real ? (real.contratos > 0 ? real.mrr / real.contratos : 0) : null;
                        return <React.Fragment key={m}>{renderCell(bp, realAov, "currency")}</React.Fragment>;
                      })}
                    </tr>

                    {/* Contratos */}
                    <tr key={`${seg}-contratos`} className="border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-1.5 text-xs text-gray-600 dark:text-zinc-400 pl-7 sticky left-0 bg-white dark:bg-zinc-900 z-10">Contratos</td>
                      {MONTHS.map((m) => {
                        const bp = BP_TARGETS[seg]?.[m]?.contratos || 0;
                        const real = getReal(m, seg);
                        const has = hasRealizado(m);
                        return <React.Fragment key={m}>{renderCell(bp, has ? (real?.contratos || 0) : null, "number")}</React.Fragment>;
                      })}
                    </tr>

                    {/* Churn % */}
                    <tr key={`${seg}-churn`} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-1.5 text-xs text-gray-600 dark:text-zinc-400 pl-7 sticky left-0 bg-white dark:bg-zinc-900 z-10">Churn %</td>
                      {MONTHS.map((m) => {
                        const bp = BP_TARGETS[seg]?.[m]?.churn || 0;
                        return (
                          <td key={m} className="px-2 py-1.5 text-right text-xs text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                            {formatPercent(bp)}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                ))}

                {/* Churn Total */}
                <tr className="bg-red-50/50 dark:bg-red-950/10 border-t border-gray-200 dark:border-zinc-700">
                  <td className="px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400 sticky left-0 bg-red-50/50 dark:bg-red-950/10 z-10">
                    Churn Total (BP)
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m} className="px-2 py-1.5 text-right text-xs text-red-600 dark:text-red-400 whitespace-nowrap">
                      {formatCurrency(BP_CHURN_TOTAL[m] || 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-zinc-400">
        <span>Legenda:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700" /> &ge; 100%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700" /> 80-99%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-700" /> &lt; 80%
        </span>
        <span className="ml-4 text-gray-400 dark:text-zinc-600">Meses futuros mostram apenas o target do BP</span>
      </div>
    </div>
  );
}
