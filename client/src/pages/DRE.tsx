import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Download, TrendingUp, TrendingDown, Minus, FileSpreadsheet, FileText } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// ---------- Types ----------

interface DRELineItem {
  categoria_id: string;
  categoria_nome: string;
  grupo: string;
  grupo_nome: string;
  parent_key: string;
  parent_nome: string;
  tipo: "receita" | "despesa";
  valores: Record<string, number>;
}

interface DREData {
  ano: number;
  empresa: string;
  linhas: DRELineItem[];
  parentCategories: Record<string, string>;
  subtotais: {
    receita_bruta_operacional: Record<string, number>;
    deducoes_receita_bruta: Record<string, number>;
    receita_operacional_liquida: Record<string, number>;
    receitas_nao_operacionais: Record<string, number>;
    receita_liquida_total: Record<string, number>;
    custos_operacionais: Record<string, number>;
    lucro_bruto: Record<string, number>;
    despesas_operacionais: Record<string, number>;
    resultado_operacional: Record<string, number>;
    despesas_nao_operacionais: Record<string, number>;
    lair: Record<string, number>;
    ir_csll: Record<string, number>;
    resultado_liquido: Record<string, number>;
  };
  empresas: string[];
  mesesComDados: string[];
}

// ---------- Constants ----------

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_KEYS = ["mes_01", "mes_02", "mes_03", "mes_04", "mes_05", "mes_06", "mes_07", "mes_08", "mes_09", "mes_10", "mes_11", "mes_12"];

interface DREGroup {
  key: string;
  grupoFilter: string;
  label: string;
  subtotalKey: keyof DREData["subtotais"];
}

interface DREDerived {
  label: string;
  subtotalKey: keyof DREData["subtotais"];
  bgClass: string;
  borderClass: string;
  textClass?: string;
}

const DRE_SECTIONS: (DREGroup | DREDerived)[] = [
  // 1. Receita Bruta Operacional
  { key: "03", grupoFilter: "03", label: "(+) RECEITA BRUTA OPERACIONAL", subtotalKey: "receita_bruta_operacional" },
  // 2. Deduções da Receita Bruta
  { key: "DD", grupoFilter: "DD", label: "(-) DEDUÇÕES DA RECEITA BRUTA", subtotalKey: "deducoes_receita_bruta" },
  // 3. Receita Operacional Líquida (derived)
  { label: "(=) RECEITA OPERACIONAL LÍQUIDA", subtotalKey: "receita_operacional_liquida", bgClass: "bg-blue-50 dark:bg-blue-950/30", borderClass: "border-t-2" },
  // 4. Receitas Não Operacionais
  { key: "04", grupoFilter: "04", label: "(+) RECEITAS NÃO OPERACIONAIS", subtotalKey: "receitas_nao_operacionais" },
  // 5. Receita Líquida Total (derived)
  { label: "(=) RECEITA LÍQUIDA TOTAL", subtotalKey: "receita_liquida_total", bgClass: "bg-blue-100 dark:bg-blue-950/50", borderClass: "border-t-2" },
  // 6. Custos Operacionais
  { key: "05", grupoFilter: "05", label: "(-) CUSTOS OPERACIONAIS", subtotalKey: "custos_operacionais" },
  // 7. Lucro Bruto (derived)
  { label: "(=) LUCRO BRUTO", subtotalKey: "lucro_bruto", bgClass: "bg-green-50 dark:bg-green-950/30", borderClass: "border-t-2" },
  // 8. Despesas Operacionais
  { key: "06", grupoFilter: "06", label: "(-) DESPESAS OPERACIONAIS", subtotalKey: "despesas_operacionais" },
  // 9. Resultado Operacional (derived)
  { label: "(=) RESULTADO OPERACIONAL (EBIT)", subtotalKey: "resultado_operacional", bgClass: "bg-yellow-50 dark:bg-yellow-950/30", borderClass: "border-t-2" },
  // 10. Despesas Não Operacionais
  { key: "07", grupoFilter: "07", label: "(-) DESPESAS NÃO OPERACIONAIS", subtotalKey: "despesas_nao_operacionais" },
  // 11. LAIR (derived)
  { label: "(=) RESULTADO ANTES DO IR/CSLL (LAIR)", subtotalKey: "lair", bgClass: "bg-amber-50 dark:bg-amber-950/30", borderClass: "border-t-2" },
  // 12. IR e Contribuição Social
  { key: "08", grupoFilter: "08", label: "(-) IR E CONTRIBUIÇÃO SOCIAL", subtotalKey: "ir_csll" },
  // 13. Resultado Líquido (derived)
  { label: "(=) RESULTADO LÍQUIDO", subtotalKey: "resultado_liquido", bgClass: "bg-emerald-50 dark:bg-emerald-950/30", borderClass: "border-t-4", textClass: "text-lg" },
];

function isGroupSection(section: DREGroup | DREDerived): section is DREGroup {
  return "key" in section;
}

// ---------- Helpers ----------

function getValueClass(value: number): string {
  if (value < 0) return "text-red-600 dark:text-red-400";
  if (value === 0) return "text-gray-400 dark:text-zinc-500";
  return "text-gray-900 dark:text-white";
}

function emptyMonthsRecord(): Record<string, number> {
  const m: Record<string, number> = {};
  for (const mk of MONTH_KEYS) m[mk] = 0;
  m.acumulado = 0;
  return m;
}

function computeAccumulated(valores: Record<string, number>): number {
  return MONTH_KEYS.reduce((acc, mk) => acc + (valores[mk] ?? 0), 0);
}

function computeAVPercent(value: number, base: number): string {
  if (base === 0) return "-";
  const pct = (value / base) * 100;
  return pct.toFixed(1) + "%";
}

function computeVariation(current: number, previous: number): { pct: number; label: string } | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { pct: 100, label: "novo" };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct, label: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` };
}

// Keys for derived rows that should show trend badges
const RESULT_KEYS: Set<string> = new Set([
  "lucro_bruto",
  "resultado_operacional",
  "lair",
  "resultado_liquido",
]);

// Keys for rows that get sparklines
const SPARKLINE_KEYS: Set<string> = new Set([
  "receita_operacional_liquida",
  "lucro_bruto",
  "resultado_liquido",
]);

// ---------- Sparkline ----------

function Sparkline({ valores, mesesComDados }: { valores: Record<string, number>; mesesComDados: Set<string> }) {
  const chartData = MONTH_KEYS
    .filter((mk) => mesesComDados.has(mk))
    .map((mk) => ({ value: valores[mk] ?? 0 }));

  if (chartData.length < 2) return <td className="px-1 py-1" />;

  const lastVal = chartData[chartData.length - 1].value;
  const color = lastVal >= 0 ? "#10b981" : "#ef4444";

  return (
    <td className="px-1 py-1 min-w-[80px]">
      <ResponsiveContainer width="100%" height={24}>
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </td>
  );
}

// ---------- Export helpers ----------

function buildExportRows(data: DREData): { rows: (string | number)[][]; header: string[] } {
  const header = ["Conta", ...MONTHS, "Acumulado"];
  const rows: (string | number)[][] = [];

  // Title row
  rows.push([`DRE — ${data.empresa === "todas" ? "Consolidada" : data.empresa} — ${data.ano}`]);
  rows.push([]); // blank line

  for (const section of DRE_SECTIONS) {
    if (isGroupSection(section)) {
      rows.push([section.label]);
      const linhas = data.linhas.filter((l) => l.grupo === section.grupoFilter);
      for (const linha of linhas) {
        const vals = MONTH_KEYS.map((mk) => linha.valores[mk] ?? 0);
        const acum = computeAccumulated(linha.valores);
        rows.push([`  ${linha.categoria_nome}`, ...vals, acum]);
      }
      const sub = data.subtotais[section.subtotalKey];
      const subVals = MONTH_KEYS.map((mk) => sub[mk] ?? 0);
      const subAcum = computeAccumulated(sub);
      rows.push([`Subtotal ${section.label}`, ...subVals, subAcum]);
      rows.push([]); // separator
    } else {
      const sub = data.subtotais[section.subtotalKey];
      const subVals = MONTH_KEYS.map((mk) => sub[mk] ?? 0);
      const subAcum = computeAccumulated(sub);
      rows.push([section.label, ...subVals, subAcum]);
    }
  }

  return { rows, header };
}

function exportCSV(data: DREData) {
  const { rows, header } = buildExportRows(data);
  const csvRows = rows.map((r) => r.map(String).join(";"));
  const csv = [header.join(";"), ...csvRows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `DRE_${data.ano}_${data.empresa}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportXLSX(data: DREData) {
  const XLSX = await import("xlsx");
  const { rows, header } = buildExportRows(data);
  const wsData = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns
  ws["!cols"] = [
    { wch: 40 }, // Conta
    ...MONTHS.map(() => ({ wch: 14 })),
    { wch: 16 }, // Acumulado
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DRE");
  XLSX.writeFile(wb, `DRE_${data.ano}_${data.empresa}.xlsx`);
}

// ---------- Component ----------

export default function DRE() {
  usePageTitle("DRE");
  useSetPageInfo("DRE", "Demonstração do Resultado do Exercício");

  const currentYear = new Date().getFullYear();

  const [ano, setAno] = useState<number>(currentYear);
  const [empresa, setEmpresa] = useState<string>("todas");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["03", "DD", "04", "05", "06", "07", "08"])
  );
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [showAV, setShowAV] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"agrupada" | "expandida">("agrupada");

  const { data, isLoading } = useQuery<DREData>({
    queryKey: ["/api/financeiro/dre", ano, empresa],
    queryFn: async () => {
      const res = await fetch(`/api/financeiro/dre?ano=${ano}&empresa=${empresa}`);
      if (!res.ok) throw new Error("Failed to fetch DRE");
      return res.json();
    },
  });

  // Set of months that have actual data (to distinguish zero from no-data)
  const mesesComDados = useMemo(() => {
    if (!data?.mesesComDados) return new Set<string>();
    return new Set(data.mesesComDados);
  }, [data]);

  // AV% base: Receita Líquida Total (padrão contábil)
  const receitaLiquidaTotal = useMemo(() => {
    if (!data) return emptyMonthsRecord();
    return data.subtotais.receita_liquida_total;
  }, [data]);

  const receitaLiquidaTotalAcum = useMemo(() => {
    if (!data) return 0;
    return computeAccumulated(data.subtotais.receita_liquida_total);
  }, [data]);

  // Group lines by parent_key (XX.YY) for grouped view
  const groupedLinhas = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, DRELineItem>();
    for (const linha of data.linhas) {
      const key = linha.parent_key;
      if (!map.has(key)) {
        map.set(key, {
          categoria_id: key,
          categoria_nome: `${key} ${linha.parent_nome}`,
          grupo: linha.grupo,
          grupo_nome: linha.grupo_nome,
          parent_key: key,
          parent_nome: linha.parent_nome,
          tipo: linha.tipo,
          valores: emptyMonthsRecord(),
        });
      }
      const grouped = map.get(key)!;
      for (const mk of MONTH_KEYS) {
        grouped.valores[mk] += linha.valores[mk] ?? 0;
      }
      grouped.valores.acumulado += linha.valores.acumulado ?? 0;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.categoria_nome.localeCompare(b.categoria_nome)
    );
  }, [data]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleParent = (key: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // ---------- Render value cell ----------

  function renderValueCell(
    value: number,
    key: string,
    extraClass?: string,
    monthKey?: string,
    isAccum?: boolean,
    prevValue?: number,
    showBadge?: boolean
  ) {
    // If monthKey provided and that month has no data, show dash instead of R$ 0
    const isEmptyMonth = monthKey && !mesesComDados.has(monthKey) && value === 0;
    const accumBg = isAccum ? "bg-gray-50 dark:bg-zinc-800/50 font-semibold" : "";

    // Variation data
    const variation = (prevValue !== undefined && monthKey && !isEmptyMonth)
      ? computeVariation(value, prevValue)
      : null;
    const monthIdx = monthKey ? MONTH_KEYS.indexOf(monthKey) : -1;
    const prevMonthIdx = monthIdx - 1;
    const currentMonthName = monthIdx >= 0 ? MONTHS[monthIdx] : null;
    const prevMonthName = prevMonthIdx >= 0 ? MONTHS[prevMonthIdx] : null;
    const hasTooltip = variation && prevMonthName && currentMonthName && !isEmptyMonth;
    const diff = prevValue !== undefined ? value - prevValue : 0;

    // Trend badge for result lines
    const badge = showBadge && variation && !isEmptyMonth ? (
      variation.pct > 0.5 ? (
        <TrendingUp className="w-3 h-3 inline ml-1 text-emerald-500" />
      ) : variation.pct < -0.5 ? (
        <TrendingDown className="w-3 h-3 inline ml-1 text-red-500" />
      ) : (
        <Minus className="w-3 h-3 inline ml-1 text-gray-400 dark:text-zinc-500" />
      )
    ) : null;

    const cell = (
      <td
        key={key}
        className={`px-2 py-1.5 text-right text-xs tabular-nums whitespace-nowrap ${isEmptyMonth ? "text-gray-300 dark:text-zinc-600" : getValueClass(value)} ${accumBg} ${extraClass ?? ""}`}
      >
        {isEmptyMonth ? "—" : (
          <span className="inline-flex items-center justify-end">
            {formatCurrencyNoDecimals(value)}
            {badge}
          </span>
        )}
      </td>
    );

    if (hasTooltip) {
      const isPositive = diff > 0;
      const isNegative = diff < 0;
      const isNeutral = diff === 0;

      return (
        <Tooltip key={key}>
          <TooltipTrigger asChild>{cell}</TooltipTrigger>
          <TooltipContent
            side="top"
            className="p-0 border-0 bg-transparent shadow-none"
          >
            <div className={`rounded-lg border px-3 py-2.5 min-w-[200px] shadow-lg ${
              isPositive
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/80 dark:border-emerald-800"
                : isNegative
                ? "bg-red-50 border-red-200 dark:bg-red-950/80 dark:border-red-800"
                : "bg-gray-50 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700"
            }`}>
              {/* Header: month comparison */}
              <div className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 mb-1.5">
                {currentMonthName} vs {prevMonthName}
              </div>

              {/* Previous month */}
              <div className="flex justify-between items-center text-xs mb-0.5">
                <span className="text-gray-500 dark:text-zinc-400">{prevMonthName}:</span>
                <span className="font-medium text-gray-700 dark:text-zinc-300 ml-3 tabular-nums">
                  {formatCurrencyNoDecimals(prevValue!)}
                </span>
              </div>

              {/* Current month */}
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-gray-500 dark:text-zinc-400">{currentMonthName}:</span>
                <span className="font-medium text-gray-900 dark:text-white ml-3 tabular-nums">
                  {formatCurrencyNoDecimals(value)}
                </span>
              </div>

              {/* Divider */}
              <div className={`border-t mb-1.5 ${
                isPositive ? "border-emerald-200 dark:border-emerald-800" :
                isNegative ? "border-red-200 dark:border-red-800" :
                "border-gray-200 dark:border-zinc-700"
              }`} />

              {/* Variation line */}
              <div className={`flex justify-between items-center text-xs font-bold ${
                isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : isNegative
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-zinc-400"
              }`}>
                <span className="inline-flex items-center gap-1">
                  {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : isNegative ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                  {isNeutral ? "Sem variação" : variation.label}
                </span>
                <span className="tabular-nums">
                  {isNeutral ? "—" : `${diff > 0 ? "+" : ""}${formatCurrencyNoDecimals(diff)}`}
                </span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    return cell;
  }

  function renderAVCell(value: number, base: number, key: string, monthKey?: string) {
    const isEmptyMonth = monthKey && !mesesComDados.has(monthKey) && value === 0;
    return (
      <td
        key={key}
        className={`px-1 py-1.5 text-right text-[10px] tabular-nums whitespace-nowrap italic ${isEmptyMonth ? "text-gray-300 dark:text-zinc-600" : "text-gray-400 dark:text-zinc-500"}`}
      >
        {isEmptyMonth ? "—" : computeAVPercent(value, base)}
      </td>
    );
  }

  // ---------- Render a value row (reusable) ----------

  function renderLineRow(
    linha: DRELineItem,
    keyPrefix: string,
    tdClass: string,
    bgClass: string,
    options?: { clickable?: boolean; onClick?: () => void; chevron?: "expanded" | "collapsed" | null }
  ) {
    const acum = computeAccumulated(linha.valores);
    return (
      <tr
        key={`${keyPrefix}-${linha.categoria_id}`}
        className={`hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${bgClass} ${options?.clickable ? "cursor-pointer" : ""}`}
        onClick={options?.onClick}
      >
        <td className={`px-3 py-1.5 text-xs sticky left-0 z-10 whitespace-nowrap border-r border-gray-200 dark:border-zinc-700 ${tdClass} ${bgClass || "bg-white dark:bg-zinc-900"}`}>
          <span className="inline-flex items-center gap-1">
            {options?.chevron === "expanded" && <ChevronDown className="w-3 h-3 text-gray-400 dark:text-zinc-500" />}
            {options?.chevron === "collapsed" && <ChevronRight className="w-3 h-3 text-gray-400 dark:text-zinc-500" />}
            {linha.categoria_nome}
          </span>
        </td>
        {MONTH_KEYS.map((mk, idx) => {
          const prevMk = idx > 0 ? MONTH_KEYS[idx - 1] : undefined;
          const prevVal = prevMk ? (linha.valores[prevMk] ?? 0) : undefined;
          return (
            <Fragment key={`${keyPrefix}-${linha.categoria_id}-${mk}-wrap`}>
              {renderValueCell(linha.valores[mk] ?? 0, `${keyPrefix}-${linha.categoria_id}-${mk}`, undefined, mk, false, prevVal)}
              {showAV && renderAVCell(linha.valores[mk] ?? 0, receitaLiquidaTotal[mk] ?? 0, `${keyPrefix}-${linha.categoria_id}-av-${mk}`, mk)}
            </Fragment>
          );
        })}
        {renderValueCell(acum, `${keyPrefix}-${linha.categoria_id}-acum`, undefined, undefined, true)}
        {showAV && renderAVCell(acum, receitaLiquidaTotalAcum, `${keyPrefix}-${linha.categoria_id}-av-acum`)}
        <td className="px-1 py-1" />
      </tr>
    );
  }

  // ---------- Render rows for a group section ----------

  function renderGroupSection(section: DREGroup) {
    if (!data) return null;
    const isGroupExpanded = expandedGroups.has(section.key);
    const subtotal = data.subtotais[section.subtotalKey];
    const subtotalAccum = computeAccumulated(subtotal);

    return (
      <Fragment key={`group-${section.key}`}>
        {/* Level 1: Group header (e.g., "CUSTOS OPERACIONAIS") */}
        <tr
          className="bg-gray-100 dark:bg-zinc-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          onClick={() => toggleGroup(section.key)}
        >
          <td className="px-3 py-2 font-bold text-sm text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-zinc-800 z-10 whitespace-nowrap border-r border-gray-200 dark:border-zinc-700">
            <span className="inline-flex items-center gap-1">
              {isGroupExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
              )}
              {section.label}
            </span>
          </td>
          {MONTH_KEYS.map((mk) => (
            <Fragment key={`hdr-${section.key}-${mk}-wrap`}>
              <td className="px-2 py-2" />
              {showAV && <td className="px-2 py-2" />}
            </Fragment>
          ))}
          <td className="px-2 py-2" />
          {showAV && <td className="px-2 py-2" />}
          <td className="px-1 py-1" />
        </tr>

        {/* Inner rows (when group is expanded) */}
        {isGroupExpanded && viewMode === "expandida" &&
          // Expanded mode: show all individual categories (XX.YY.ZZ)
          data.linhas
            .filter((l) => l.grupo === section.grupoFilter)
            .map((linha) =>
              renderLineRow(linha, "exp", "pl-9 text-gray-700 dark:text-zinc-300", "")
            )
        }

        {isGroupExpanded && viewMode === "agrupada" &&
          // Grouped mode: show parent categories (XX.YY), expandable to children
          groupedLinhas
            .filter((l) => l.grupo === section.grupoFilter)
            .map((parentLinha) => {
              const isParentOpen = expandedParents.has(parentLinha.parent_key);
              const children = data.linhas.filter((l) => l.parent_key === parentLinha.parent_key);

              return (
                <Fragment key={`parent-${parentLinha.parent_key}`}>
                  {/* Level 2: Parent category (e.g., "05.01 Mão de Obra Operacional") */}
                  {renderLineRow(
                    parentLinha,
                    "grp",
                    "pl-7 font-medium text-gray-800 dark:text-zinc-200",
                    "",
                    {
                      clickable: true,
                      onClick: () => toggleParent(parentLinha.parent_key),
                      chevron: isParentOpen ? "expanded" : "collapsed",
                    }
                  )}

                  {/* Level 3: Child categories (e.g., "05.01.01 Lider de Squad") */}
                  {isParentOpen &&
                    children.map((child) =>
                      renderLineRow(
                        child,
                        "child",
                        "pl-12 text-gray-500 dark:text-zinc-400",
                        "bg-gray-50/50 dark:bg-zinc-900/50"
                      )
                    )
                  }
                </Fragment>
              );
            })
        }

        {/* Subtotal row (always visible) */}
        <tr className="border-b border-gray-200 dark:border-zinc-700">
          <td className="px-3 py-1.5 pl-5 text-xs font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-zinc-900 z-10 whitespace-nowrap border-r border-gray-200 dark:border-zinc-700">
            Subtotal
          </td>
          {MONTH_KEYS.map((mk, idx) => {
            const prevMk = idx > 0 ? MONTH_KEYS[idx - 1] : undefined;
            const prevVal = prevMk ? (subtotal[prevMk] ?? 0) : undefined;
            return (
              <Fragment key={`sub-${section.key}-${mk}-wrap`}>
                {renderValueCell(subtotal[mk] ?? 0, `sub-${section.key}-${mk}`, "font-medium", mk, false, prevVal)}
                {showAV && renderAVCell(subtotal[mk] ?? 0, receitaLiquidaTotal[mk] ?? 0, `sub-${section.key}-av-${mk}`, mk)}
              </Fragment>
            );
          })}
          {renderValueCell(subtotalAccum, `sub-${section.key}-acum`, "font-medium", undefined, true)}
          {showAV && renderAVCell(subtotalAccum, receitaLiquidaTotalAcum, `sub-${section.key}-av-acum`)}
          <td className="px-1 py-1" />
        </tr>
      </Fragment>
    );
  }

  // ---------- Render derived subtotal row ----------

  function renderDerivedRow(section: DREDerived) {
    if (!data) return null;
    const subtotal = data.subtotais[section.subtotalKey];
    const acum = computeAccumulated(subtotal);

    return (
      <tr
        key={`derived-${section.subtotalKey}`}
        className={`${section.bgClass} ${section.borderClass} border-gray-300 dark:border-zinc-600`}
      >
        <td
          className={`px-3 py-2 font-bold text-gray-900 dark:text-white sticky left-0 z-10 whitespace-nowrap border-r border-gray-200 dark:border-zinc-700 ${section.bgClass} ${section.textClass ?? "text-sm"}`}
        >
          {section.label}
        </td>
        {MONTH_KEYS.map((mk, idx) => {
          const prevMk = idx > 0 ? MONTH_KEYS[idx - 1] : undefined;
          const prevVal = prevMk ? (subtotal[prevMk] ?? 0) : undefined;
          const isResultRow = RESULT_KEYS.has(section.subtotalKey);
          return (
            <Fragment key={`derived-${section.subtotalKey}-${mk}-wrap`}>
              {renderValueCell(
                subtotal[mk] ?? 0,
                `derived-${section.subtotalKey}-${mk}`,
                `font-bold ${section.textClass ?? ""}`,
                mk,
                false,
                prevVal,
                isResultRow
              )}
              {showAV &&
                renderAVCell(subtotal[mk] ?? 0, receitaLiquidaTotal[mk] ?? 0, `derived-${section.subtotalKey}-av-${mk}`, mk)}
            </Fragment>
          );
        })}
        {renderValueCell(
          acum,
          `derived-${section.subtotalKey}-acum`,
          `font-bold ${section.textClass ?? ""}`,
          undefined,
          true
        )}
        {showAV &&
          renderAVCell(acum, receitaLiquidaTotalAcum, `derived-${section.subtotalKey}-av-acum`)}
        {SPARKLINE_KEYS.has(section.subtotalKey) ? (
          <Sparkline valores={subtotal} mesesComDados={mesesComDados} />
        ) : (
          <td className="px-1 py-1" />
        )}
      </tr>
    );
  }

  // ---------- Loading skeleton ----------

  function renderSkeleton() {
    const skeletonRows = Array.from({ length: 15 });
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-zinc-800">
              <th className="px-3 py-2 text-left"><Skeleton className="h-4 w-40" /></th>
              {MONTHS.map((m) => (
                <th key={m} className="px-2 py-2 text-right"><Skeleton className="h-4 w-16 ml-auto" /></th>
              ))}
              <th className="px-2 py-2 text-right"><Skeleton className="h-4 w-20 ml-auto" /></th>
            </tr>
          </thead>
          <tbody>
            {skeletonRows.map((_, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-zinc-800">
                <td className="px-3 py-2"><Skeleton className="h-4 w-48" /></td>
                {MONTHS.map((m) => (
                  <td key={m} className="px-2 py-2"><Skeleton className="h-4 w-16 ml-auto" /></td>
                ))}
                <td className="px-2 py-2"><Skeleton className="h-4 w-20 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ---------- Main render ----------

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-4">
      {/* Filters bar */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Year selector */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-600 dark:text-zinc-400">Ano:</Label>
              <Select value={ano.toString()} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Company selector */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-600 dark:text-zinc-400">Empresa:</Label>
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Consolidada</SelectItem>
                  {data?.empresas?.map((emp) => (
                    <SelectItem key={emp} value={emp}>
                      {emp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* View mode selector */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-600 dark:text-zinc-400">Visão:</Label>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as "agrupada" | "expandida")}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agrupada">Agrupada</SelectItem>
                  <SelectItem value="expandida">Expandida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* AV% toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="av-toggle"
                checked={showAV}
                onCheckedChange={setShowAV}
              />
              <Label htmlFor="av-toggle" className="text-sm text-gray-600 dark:text-zinc-400">
                AV%
              </Label>
            </div>

            {/* Export dropdown */}
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!data} className="gap-2">
                    <Download className="w-4 h-4" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => data && exportCSV(data)} className="gap-2 cursor-pointer">
                    <FileText className="w-4 h-4" />
                    Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => data && exportXLSX(data)} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar Excel (.xlsx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DRE Table */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-gray-900 dark:text-white">
            Demonstração do Resultado do Exercício — {ano}
            <span className="text-xs font-normal text-gray-500 dark:text-zinc-400 ml-2">(Regime de Caixa)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              {renderSkeleton()}
            </div>
          ) : !data ? (
            <div className="p-8 text-center text-gray-500 dark:text-zinc-400">
              Nenhum dado disponível para o período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[1200px]">
                {/* Table header */}
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 sticky left-0 bg-gray-50 dark:bg-zinc-800 z-20 min-w-[240px] border-r border-gray-200 dark:border-zinc-700">
                      Conta
                    </th>
                    {MONTHS.map((m) => (
                      <Fragment key={`hdr-${m}`}>
                        <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 min-w-[100px]">
                          {m}
                        </th>
                        {showAV && (
                          <th className="px-1 py-2 text-right text-[10px] font-normal italic text-gray-400 dark:text-zinc-500 min-w-[45px]">
                            AV%
                          </th>
                        )}
                      </Fragment>
                    ))}
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-900 dark:text-white min-w-[100px] bg-gray-100 dark:bg-zinc-700/50">
                      Acumulado
                    </th>
                    {showAV && (
                      <th className="px-1 py-2 text-right text-[10px] font-normal italic text-gray-400 dark:text-zinc-500 min-w-[45px] bg-gray-100 dark:bg-zinc-700/50">
                        AV%
                      </th>
                    )}
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-zinc-400 min-w-[80px]">
                      Tendência
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {DRE_SECTIONS.map((section) => {
                    if (isGroupSection(section)) {
                      return renderGroupSection(section);
                    } else {
                      return renderDerivedRow(section);
                    }
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
