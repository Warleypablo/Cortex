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
import { ChevronDown, ChevronRight, Download } from "lucide-react";

// ---------- Types ----------

interface DRELineItem {
  categoria_id: string;
  categoria_nome: string;
  grupo: string;
  grupo_nome: string;
  tipo: "receita" | "despesa";
  valores: Record<string, number>;
}

interface DREData {
  ano: number;
  empresa: string;
  linhas: DRELineItem[];
  subtotais: {
    receita_bruta_operacional: Record<string, number>;
    receitas_nao_operacionais: Record<string, number>;
    receita_bruta_total: Record<string, number>;
    custos_operacionais: Record<string, number>;
    lucro_bruto: Record<string, number>;
    despesas_operacionais: Record<string, number>;
    resultado_operacional: Record<string, number>;
    despesas_nao_operacionais: Record<string, number>;
    resultado_liquido: Record<string, number>;
  };
  empresas: string[];
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
  // 2. Receitas Não Operacionais
  { key: "04", grupoFilter: "04", label: "(+) RECEITAS NÃO OPERACIONAIS", subtotalKey: "receitas_nao_operacionais" },
  // 3. Receita Bruta Total (derived)
  { label: "(=) RECEITA BRUTA TOTAL", subtotalKey: "receita_bruta_total", bgClass: "bg-blue-50 dark:bg-blue-950/30", borderClass: "border-t-2" },
  // 4. Custos Operacionais
  { key: "05", grupoFilter: "05", label: "(-) CUSTOS OPERACIONAIS", subtotalKey: "custos_operacionais" },
  // 5. Lucro Bruto (derived)
  { label: "(=) LUCRO BRUTO", subtotalKey: "lucro_bruto", bgClass: "bg-green-50 dark:bg-green-950/30", borderClass: "border-t-2" },
  // 6. Despesas Operacionais
  { key: "06", grupoFilter: "06", label: "(-) DESPESAS OPERACIONAIS", subtotalKey: "despesas_operacionais" },
  // 7. Resultado Operacional (derived)
  { label: "(=) RESULTADO OPERACIONAL", subtotalKey: "resultado_operacional", bgClass: "bg-yellow-50 dark:bg-yellow-950/30", borderClass: "border-t-2" },
  // 8. Despesas Não Operacionais
  { key: "07", grupoFilter: "07", label: "(-) DESPESAS NÃO OPERACIONAIS", subtotalKey: "despesas_nao_operacionais" },
  // 9. Resultado Líquido (derived)
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

function computeAccumulated(valores: Record<string, number>): number {
  return MONTH_KEYS.reduce((acc, mk) => acc + (valores[mk] ?? 0), 0);
}

function computeAVPercent(value: number, receitaBrutaTotal: number): string {
  if (receitaBrutaTotal === 0) return "-";
  const pct = (value / receitaBrutaTotal) * 100;
  return pct.toFixed(1) + "%";
}

// ---------- Export CSV ----------

function exportCSV(data: DREData) {
  const header = ["Conta", ...MONTHS, "Acumulado"];
  const rows: string[][] = [];

  for (const section of DRE_SECTIONS) {
    if (isGroupSection(section)) {
      // Group header
      rows.push([section.label]);
      // Subcategory rows
      const linhas = data.linhas.filter((l) => l.grupo === section.grupoFilter);
      for (const linha of linhas) {
        const vals = MONTH_KEYS.map((mk) => String(linha.valores[mk] ?? 0));
        const acum = String(computeAccumulated(linha.valores));
        rows.push([`  ${linha.categoria_nome}`, ...vals, acum]);
      }
      // Subtotal
      const sub = data.subtotais[section.subtotalKey];
      const subVals = MONTH_KEYS.map((mk) => String(sub[mk] ?? 0));
      const subAcum = String(computeAccumulated(sub));
      rows.push([`Subtotal ${section.label}`, ...subVals, subAcum]);
    } else {
      // Derived total
      const sub = data.subtotais[section.subtotalKey];
      const subVals = MONTH_KEYS.map((mk) => String(sub[mk] ?? 0));
      const subAcum = String(computeAccumulated(sub));
      rows.push([section.label, ...subVals, subAcum]);
    }
  }

  const csv = [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `DRE_${data.ano}_${data.empresa}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------- Component ----------

export default function DRE() {
  usePageTitle("DRE");
  useSetPageInfo("DRE", "Demonstração do Resultado do Exercício");

  const currentYear = new Date().getFullYear();

  const [ano, setAno] = useState<number>(currentYear);
  const [empresa, setEmpresa] = useState<string>("todas");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["03", "04", "05", "06", "07"])
  );
  const [showAV, setShowAV] = useState<boolean>(false);

  const { data, isLoading } = useQuery<DREData>({
    queryKey: ["/api/financeiro/dre", ano, empresa],
    queryFn: async () => {
      const res = await fetch(`/api/financeiro/dre?ano=${ano}&empresa=${empresa}`);
      if (!res.ok) throw new Error("Failed to fetch DRE");
      return res.json();
    },
  });

  // Compute receita bruta total accumulated for AV% base
  const receitaBrutaTotalAcum = useMemo(() => {
    if (!data) return 0;
    return computeAccumulated(data.subtotais.receita_bruta_total);
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
    extraClass?: string
  ) {
    return (
      <td
        key={key}
        className={`px-2 py-1.5 text-right text-xs tabular-nums whitespace-nowrap ${getValueClass(value)} ${extraClass ?? ""}`}
      >
        {formatCurrencyNoDecimals(value)}
      </td>
    );
  }

  function renderAVCell(value: number, base: number, key: string) {
    return (
      <td
        key={key}
        className="px-2 py-1.5 text-right text-xs tabular-nums whitespace-nowrap text-gray-500 dark:text-zinc-400"
      >
        {computeAVPercent(value, base)}
      </td>
    );
  }

  // ---------- Render rows for a group section ----------

  function renderGroupSection(section: DREGroup) {
    if (!data) return null;
    const isExpanded = expandedGroups.has(section.key);
    const linhas = data.linhas.filter((l) => l.grupo === section.grupoFilter);
    const subtotal = data.subtotais[section.subtotalKey];
    const subtotalAccum = computeAccumulated(subtotal);

    return (
      <Fragment key={`group-${section.key}`}>
        {/* Group header row */}
        <tr
          className="bg-gray-100 dark:bg-zinc-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          onClick={() => toggleGroup(section.key)}
        >
          <td className="px-3 py-2 font-bold text-sm text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-zinc-800 z-10 whitespace-nowrap">
            <span className="inline-flex items-center gap-1">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
              )}
              {section.label}
            </span>
          </td>
          {MONTH_KEYS.map((mk) => (
            <td key={mk} className="px-2 py-2" />
          ))}
          <td className="px-2 py-2" /> {/* Acumulado */}
          {showAV && <td className="px-2 py-2" />}
        </tr>

        {/* Subcategory rows (when expanded) */}
        {isExpanded &&
          linhas.map((linha) => {
            const acum = computeAccumulated(linha.valores);
            return (
              <tr
                key={`cat-${linha.categoria_id}`}
                className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <td className="px-3 py-1.5 pl-9 text-xs text-gray-700 dark:text-zinc-300 sticky left-0 bg-white dark:bg-zinc-900 z-10 whitespace-nowrap">
                  {linha.categoria_nome}
                </td>
                {MONTH_KEYS.map((mk) =>
                  renderValueCell(linha.valores[mk] ?? 0, `${linha.categoria_id}-${mk}`)
                )}
                {renderValueCell(acum, `${linha.categoria_id}-acum`)}
                {showAV && renderAVCell(acum, receitaBrutaTotalAcum, `${linha.categoria_id}-av-acum`)}
              </tr>
            );
          })}

        {/* Subtotal row (always visible) */}
        <tr className="border-b border-gray-200 dark:border-zinc-700">
          <td className="px-3 py-1.5 pl-5 text-xs font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-zinc-900 z-10 whitespace-nowrap">
            Subtotal
          </td>
          {MONTH_KEYS.map((mk) =>
            renderValueCell(subtotal[mk] ?? 0, `sub-${section.key}-${mk}`, "font-medium")
          )}
          {renderValueCell(subtotalAccum, `sub-${section.key}-acum`, "font-medium")}
          {showAV && renderAVCell(subtotalAccum, receitaBrutaTotalAcum, `sub-${section.key}-av-acum`)}
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
          className={`px-3 py-2 font-bold text-gray-900 dark:text-white sticky left-0 z-10 whitespace-nowrap ${section.bgClass} ${section.textClass ?? "text-sm"}`}
        >
          {section.label}
        </td>
        {MONTH_KEYS.map((mk) =>
          renderValueCell(
            subtotal[mk] ?? 0,
            `derived-${section.subtotalKey}-${mk}`,
            `font-bold ${section.textClass ?? ""}`
          )
        )}
        {renderValueCell(
          acum,
          `derived-${section.subtotalKey}-acum`,
          `font-bold ${section.textClass ?? ""}`
        )}
        {showAV &&
          renderAVCell(acum, receitaBrutaTotalAcum, `derived-${section.subtotalKey}-av-acum`)}
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

            {/* Export CSV */}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => data && exportCSV(data)}
                disabled={!data}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DRE Table */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-gray-900 dark:text-white">
            Demonstração do Resultado do Exercício — {ano}
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
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 sticky left-0 bg-gray-50 dark:bg-zinc-800 z-20 min-w-[240px]">
                      Conta
                    </th>
                    {MONTHS.map((m) => (
                      <th
                        key={m}
                        className="px-2 py-2 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 min-w-[90px]"
                      >
                        {m}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-900 dark:text-white min-w-[100px] bg-gray-100 dark:bg-zinc-700/50">
                      Acumulado
                    </th>
                    {showAV && (
                      <th className="px-2 py-2 text-right text-xs font-semibold text-gray-500 dark:text-zinc-400 min-w-[60px]">
                        AV%
                      </th>
                    )}
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
  );
}
