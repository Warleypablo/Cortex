import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ArrowUpDown, ExternalLink, ChevronRight, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency as formatCurrencyUtil, formatPercent as formatPercentUtil } from "@/lib/utils";
import type { CriativoData, Level, SortConfig } from "@/lib/criativosMetrics";

function formatNumber(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR").format(value);
}
function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return formatPercentUtil(value);
}
function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  return formatCurrencyUtil(value);
}

type FrozenKey = "select" | "toggle" | "link" | "id" | "name" | "status";
interface FrozenCol {
  key: FrozenKey;
  width: number;
}

function getFrozenCols(level: Level, isAdmin: boolean): FrozenCol[] {
  const cols: FrozenCol[] = [];
  const interactive = isAdmin && level !== "conta";
  if (interactive) {
    cols.push({ key: "select", width: 44 });
    cols.push({ key: "toggle", width: 64 });
  }
  if (level === "anuncio") {
    cols.push({ key: "link", width: 48 });
    cols.push({ key: "id", width: 150 });
    cols.push({ key: "name", width: 240 });
  } else {
    cols.push({ key: "name", width: 300 });
  }
  cols.push({ key: "status", width: 110 });
  return cols;
}

const NAME_HEADER: Record<Level, string> = {
  anuncio: "Ad name",
  conjunto: "Conjunto",
  campanha: "Campanha",
  conta: "Conta",
};

export interface CriativosTableProps {
  level: Level;
  rows: CriativoData[];
  compareMap: Map<string, CriativoData>;
  averages: CriativoData | null;
  isCompareActive: boolean;
  isLoading: boolean;
  sortConfig: SortConfig;
  onSort: (key: keyof CriativoData) => void;
  expandedGroups: Set<string>;
  toggleGroup: (g: string) => void;
  expandedColumns: Set<string>;
  toggleColumn: (c: string) => void;
  getCellColor: (value: number | null, metricKey: string) => string;
  pendingByEntity: Map<string, { entity_id: string }>;
  isAdmin: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, ids: string[]) => void;
  onToggleStatus: (row: CriativoData) => void;
  togglingIds: Set<string>;
}

export function CriativosTable({
  level,
  rows,
  compareMap,
  averages,
  isCompareActive,
  isLoading,
  sortConfig,
  onSort,
  expandedGroups,
  toggleGroup,
  expandedColumns,
  toggleColumn,
  getCellColor,
  pendingByEntity,
  isAdmin,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onToggleStatus,
  togglingIds,
}: CriativosTableProps) {
  const frozen = getFrozenCols(level, isAdmin);
  const lefts: number[] = [];
  let acc = 0;
  for (const c of frozen) {
    lefts.push(acc);
    acc += c.width;
  }
  const lastFrozenIdx = frozen.length - 1;
  const interactive = isAdmin && level !== "conta";

  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));

  // ── Cabeçalho ordenável (com chevron de comparação) ──
  const SortableHeader = ({ column, label }: { column: keyof CriativoData; label: string }) => {
    const isExpanded = expandedColumns.has(column as string);
    return (
      <>
        <TableHead
          className="cursor-pointer hover:bg-zinc-800 whitespace-nowrap text-xs bg-zinc-900 text-zinc-100"
          onClick={() => onSort(column)}
          data-testid={`header-${column}`}
        >
          <div className="flex items-center gap-1">
            {isCompareActive && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleColumn(column as string); }}
                className="hover:text-white text-zinc-400"
              >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            )}
            {label}
            <ArrowUpDown className="w-3 h-3" />
          </div>
        </TableHead>
        {isCompareActive && isExpanded && (
          <TableHead className="whitespace-nowrap text-xs bg-zinc-800 text-zinc-400 italic">
            <div className="text-center">Var.</div>
          </TableHead>
        )}
      </>
    );
  };

  // ── Cabeçalho de grupo (sub-colunas colapsáveis) ──
  const GroupableHeader = ({ group, label, column, children }: { group: string; label: string; column: keyof CriativoData; children: React.ReactNode }) => {
    const isGroupExpanded = expandedGroups.has(group);
    return (
      <>
        <TableHead
          className="cursor-pointer hover:bg-zinc-800 whitespace-nowrap text-xs bg-zinc-900 text-zinc-100"
          onClick={() => onSort(column)}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); toggleGroup(group); }}
              className="hover:text-white text-zinc-400"
            >
              {isGroupExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {label}
            <ArrowUpDown className="w-3 h-3" />
          </div>
        </TableHead>
        {isCompareActive && expandedColumns.has(column as string) && (
          <TableHead className="whitespace-nowrap text-xs bg-zinc-800 text-zinc-400 italic">
            <div className="text-center">Var.</div>
          </TableHead>
        )}
        {isGroupExpanded && children}
      </>
    );
  };

  // ── Célula de métrica (com variação expandida) ──
  const renderCell = (
    value: number | null,
    compareValue: number | null,
    column: string,
    formatter: (v: number | null) => string,
    colorClass = "",
    invertPositive = false,
  ) => {
    const isExpanded = expandedColumns.has(column);
    return (
      <>
        <TableCell className={`text-right ${colorClass}`}>{formatter(value)}</TableCell>
        {isCompareActive && isExpanded && (
          <TableCell className="text-right text-xs bg-zinc-800/30">
            {value !== null && compareValue !== null && compareValue !== 0 ? (
              <div className="flex flex-col items-end">
                <span className="text-muted-foreground">{formatter(value - compareValue)}</span>
                <span className={cn("text-[10px]",
                  (() => {
                    const pct = ((value - compareValue) / compareValue) * 100;
                    const positive = invertPositive ? pct < 0 : pct > 0;
                    return positive ? "text-emerald-400" : "text-red-400";
                  })()
                )}>
                  {((value - compareValue) / compareValue * 100) > 0 ? "+" : ""}
                  {((value - compareValue) / compareValue * 100).toFixed(1)}%
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </TableCell>
        )}
      </>
    );
  };

  // ── Cabeçalho das colunas congeladas (esquerda) ──
  const renderFrozenHeader = (col: FrozenCol, left: number, isLast: boolean) => {
    const base = cn(
      "text-xs bg-zinc-900 text-zinc-100 sticky z-10",
      isLast && "border-r border-zinc-700",
    );
    const style = { left, minWidth: col.width, width: col.width } as React.CSSProperties;
    switch (col.key) {
      case "select":
        return (
          <TableHead key={col.key} className={base} style={style}>
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(c) => onToggleSelectAll(c === true, allIds)}
              aria-label="Selecionar todos"
            />
          </TableHead>
        );
      case "toggle":
        return <TableHead key={col.key} className={base} style={style} />;
      case "link":
        return <TableHead key={col.key} className={base} style={style}>Link</TableHead>;
      case "id":
        return (
          <TableHead key={col.key} className={cn(base, "cursor-pointer hover:bg-zinc-800 whitespace-nowrap")} style={style} onClick={() => onSort("id")}>
            <div className="flex items-center gap-1">Ad Id <ArrowUpDown className="w-3 h-3" /></div>
          </TableHead>
        );
      case "name":
        return (
          <TableHead key={col.key} className={cn(base, "cursor-pointer hover:bg-zinc-800 whitespace-nowrap")} style={style} onClick={() => onSort("adName")}>
            <div className="flex items-center gap-1">{NAME_HEADER[level]} <ArrowUpDown className="w-3 h-3" /></div>
          </TableHead>
        );
      case "status":
        return (
          <TableHead key={col.key} className={cn(base, "cursor-pointer hover:bg-zinc-800 whitespace-nowrap")} style={style} onClick={() => onSort("status")}>
            <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
          </TableHead>
        );
    }
  };

  // ── Linha de totais: células congeladas ──
  const renderFrozenAvg = (col: FrozenCol, left: number, isLast: boolean) => {
    const base = cn("sticky z-10 bg-zinc-800", isLast && "border-r border-zinc-700");
    const style = { left, minWidth: col.width, width: col.width } as React.CSSProperties;
    if (col.key === "name") {
      return <TableHead key={col.key} className={cn(base, "text-muted-foreground")} style={style}>Total</TableHead>;
    }
    return <TableHead key={col.key} className={base} style={style} />;
  };

  // ── Body: células congeladas de uma linha ──
  const renderFrozenBody = (col: FrozenCol, left: number, isLast: boolean, row: CriativoData) => {
    const base = cn("sticky z-10 bg-card", isLast && "border-r border-zinc-700/50");
    const style = { left, minWidth: col.width, width: col.width } as React.CSSProperties;
    const isToggling = togglingIds.has(row.id);
    switch (col.key) {
      case "select":
        return (
          <TableCell key={col.key} className={base} style={style}>
            <Checkbox
              checked={selectedIds.has(row.id)}
              onCheckedChange={(c) => onToggleSelect(row.id, c === true)}
              aria-label={`Selecionar ${row.adName}`}
            />
          </TableCell>
        );
      case "toggle":
        return (
          <TableCell key={col.key} className={base} style={style}>
            {isToggling ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={row.status === "Ativo"}
                onCheckedChange={() => onToggleStatus(row)}
                disabled={row.status === "Inativo" || row.status === "Desconhecido"}
                aria-label={`Ligar/desligar ${row.adName}`}
              />
            )}
          </TableCell>
        );
      case "link":
        return (
          <TableCell key={col.key} className={base} style={style}>
            {row.link && (
              <a href={row.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </TableCell>
        );
      case "id":
        return (
          <TableCell key={col.key} className={cn(base, "font-mono text-xs text-muted-foreground")} style={style} title={row.id}>
            {row.id || "-"}
          </TableCell>
        );
      case "name":
        return (
          <TableCell key={col.key} className={cn(base, "font-medium truncate")} style={style} title={row.adName}>
            <div className="flex items-center gap-1.5">
              <span className="truncate">{row.adName}</span>
              {pendingByEntity.has(row.id) && (
                <Badge
                  variant="secondary"
                  className="shrink-0 text-[10px] h-4 px-1 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
                  title="Proposta pendente do agente"
                >
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                  IA
                </Badge>
              )}
            </div>
          </TableCell>
        );
      case "status":
        return (
          <TableCell key={col.key} className={base} style={style}>
            <Badge
              variant={row.status === "Ativo" ? "default" : "secondary"}
              className={row.status === "Ativo" ? "bg-green-500" : ""}
            >
              {row.status}
            </Badge>
          </TableCell>
        );
    }
  };

  // ── Conjunto de colunas de métrica (compartilhado header/avg/body) ──
  const avgCell = (val: string, col: string) => (
    <>
      <TableHead className="text-right text-xs font-semibold">{val}</TableHead>
      {isCompareActive && expandedColumns.has(col) && <TableHead className="bg-zinc-800/30" />}
    </>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative max-h-[calc(100vh-300px)] overflow-auto [&>div]:!overflow-visible [&>div]:!static [&>div]:!w-auto">
      <Table>
        <TableHeader className="sticky top-0 z-50">
          <TableRow className="bg-zinc-900 dark:bg-zinc-900 shadow-md [&>th]:bg-zinc-900 dark:[&>th]:bg-zinc-900">
            {frozen.map((col, i) => renderFrozenHeader(col, lefts[i], i === lastFrozenIdx))}
            <SortableHeader column="investimento" label="Invest" />
            <SortableHeader column="cpm" label="CPM" />
            <SortableHeader column="videoHook" label="Video hook" />
            <SortableHeader column="videoHold" label="Video hold" />
            <SortableHeader column="ctr" label="CTR" />
            <SortableHeader column="connectRate" label="Connect rate" />
            <SortableHeader column="taxaConversao" label="Taxa conv." />
            <SortableHeader column="leads" label="Leads" />
            <SortableHeader column="cpl" label="CPL" />
            <SortableHeader column="mql" label="MQL" />
            <SortableHeader column="cpmql" label="CPMQL" />
            <SortableHeader column="percMql" label="%MQL" />
            <GroupableHeader group="desc" label="Desc. %" column="descartadoPerc">
              <SortableHeader column="descartadoMqlPerc" label="Desc. MQL %" />
              <SortableHeader column="descartadoNmqlPerc" label="Desc. NMQL %" />
            </GroupableHeader>
            <GroupableHeader group="ra" label="RA %" column="percRa">
              <SortableHeader column="percRaMql" label="RA MQL %" />
              <SortableHeader column="percRaNmql" label="RA NMQL %" />
            </GroupableHeader>
            <GroupableHeader group="cpra" label="CPRA" column="cpra">
              <SortableHeader column="cpraMql" label="CPRA MQL" />
              <SortableHeader column="cpraNmql" label="CPRA NMQL" />
            </GroupableHeader>
            <GroupableHeader group="rr" label="RR %" column="percRr">
              <SortableHeader column="percRrMql" label="RR MQL %" />
              <SortableHeader column="percRrNmql" label="RR NMQL %" />
            </GroupableHeader>
            <GroupableHeader group="cprr" label="CPRR" column="cprr">
              <SortableHeader column="cprrMql" label="CPRR MQL" />
              <SortableHeader column="cprrNmql" label="CPRR NMQL" />
            </GroupableHeader>
            <GroupableHeader group="rrv" label="RR→V %" column="percRrVendas">
              <SortableHeader column="percRrMqlVendas" label="RR MQL→V %" />
              <SortableHeader column="percRrNmqlVendas" label="RR NMQL→V %" />
            </GroupableHeader>
            <SortableHeader column="clientesUnicos" label="Neg. ganho" />
            <SortableHeader column="leadTime" label="Lead Time" />
            <SortableHeader column="aov" label="AOV" />
            <GroupableHeader group="receita" label="Receita" column="receita">
              <SortableHeader column="receitaPontual" label="Rec. pontual" />
              <SortableHeader column="receitaRecorrente" label="Rec. recorrente" />
            </GroupableHeader>
            <GroupableHeader group="cac" label="CAC" column="cacGeral">
              <SortableHeader column="cacUnico" label="CAC único" />
              <SortableHeader column="cacContrato" label="CAC contrato" />
            </GroupableHeader>
            <SortableHeader column="roas" label="ROAS" />
          </TableRow>

          {averages && level !== "conta" && (
            <TableRow className="bg-zinc-800 dark:bg-zinc-800 border-b-2 border-zinc-700 font-semibold text-xs [&>th]:bg-zinc-800 dark:[&>th]:bg-zinc-800 [&>th]:font-semibold">
              {frozen.map((col, i) => renderFrozenAvg(col, lefts[i], i === lastFrozenIdx))}
              {avgCell(formatCurrency(averages.investimento), "investimento")}
              {avgCell(formatCurrency(averages.cpm), "cpm")}
              {avgCell(formatPercent(averages.videoHook), "videoHook")}
              {avgCell(formatPercent(averages.videoHold), "videoHold")}
              {avgCell(formatPercent(averages.ctr), "ctr")}
              {avgCell(formatPercent(averages.connectRate), "connectRate")}
              {avgCell(formatPercent(averages.taxaConversao), "taxaConversao")}
              {avgCell(formatNumber(averages.leads), "leads")}
              {avgCell(formatCurrency(averages.cpl), "cpl")}
              {avgCell(formatNumber(averages.mql), "mql")}
              {avgCell(formatCurrency(averages.cpmql), "cpmql")}
              {avgCell(formatPercent(averages.percMql), "percMql")}
              {avgCell(formatPercent(averages.descartadoPerc), "descartadoPerc")}
              {expandedGroups.has("desc") && <>{avgCell(formatPercent(averages.descartadoMqlPerc), "descartadoMqlPerc")}{avgCell(formatPercent(averages.descartadoNmqlPerc), "descartadoNmqlPerc")}</>}
              {avgCell(formatPercent(averages.percRa), "percRa")}
              {expandedGroups.has("ra") && <>{avgCell(formatPercent(averages.percRaMql), "percRaMql")}{avgCell(formatPercent(averages.percRaNmql), "percRaNmql")}</>}
              {avgCell(formatCurrency(averages.cpra), "cpra")}
              {expandedGroups.has("cpra") && <>{avgCell(formatCurrency(averages.cpraMql), "cpraMql")}{avgCell(formatCurrency(averages.cpraNmql), "cpraNmql")}</>}
              {avgCell(formatPercent(averages.percRr), "percRr")}
              {expandedGroups.has("rr") && <>{avgCell(formatPercent(averages.percRrMql), "percRrMql")}{avgCell(formatPercent(averages.percRrNmql), "percRrNmql")}</>}
              {avgCell(formatCurrency(averages.cprr), "cprr")}
              {expandedGroups.has("cprr") && <>{avgCell(formatCurrency(averages.cprrMql), "cprrMql")}{avgCell(formatCurrency(averages.cprrNmql), "cprrNmql")}</>}
              {avgCell(formatPercent(averages.percRrVendas), "percRrVendas")}
              {expandedGroups.has("rrv") && <>{avgCell(formatPercent(averages.percRrMqlVendas), "percRrMqlVendas")}{avgCell(formatPercent(averages.percRrNmqlVendas), "percRrNmqlVendas")}</>}
              {avgCell(formatNumber(averages.clientesUnicos), "clientesUnicos")}
              {avgCell(averages.leadTime !== null ? `${averages.leadTime}d` : "-", "leadTime")}
              {avgCell(formatCurrency(averages.aov), "aov")}
              {avgCell(formatCurrency(averages.receita), "receita")}
              {expandedGroups.has("receita") && <>{avgCell(formatCurrency(averages.receitaPontual), "receitaPontual")}{avgCell(formatCurrency(averages.receitaRecorrente), "receitaRecorrente")}</>}
              {avgCell(formatCurrency(averages.cacGeral), "cacGeral")}
              {expandedGroups.has("cac") && <>{avgCell(formatCurrency(averages.cacUnico), "cacUnico")}{avgCell(formatCurrency(averages.cacContrato), "cacContrato")}</>}
              {avgCell(averages.roas !== null ? `${averages.roas}x` : "-", "roas")}
            </TableRow>
          )}
        </TableHeader>

        <TableBody>
          {rows.map((item) => {
            const c = compareMap.get(item.id);
            return (
              <TableRow key={item.id} data-testid={`row-criativo-${item.id}`}>
                {frozen.map((col, i) => renderFrozenBody(col, lefts[i], i === lastFrozenIdx, item))}
                {renderCell(item.investimento, c?.investimento ?? null, "investimento", formatCurrency)}
                {renderCell(item.cpm, c?.cpm ?? null, "cpm", formatCurrency, getCellColor(item.cpm, "cpm"), true)}
                {renderCell(item.videoHook, c?.videoHook ?? null, "videoHook", formatPercent, getCellColor(item.videoHook, "videoHook"))}
                {renderCell(item.videoHold, c?.videoHold ?? null, "videoHold", formatPercent, getCellColor(item.videoHold, "videoHold"))}
                {renderCell(item.ctr, c?.ctr ?? null, "ctr", formatPercent, getCellColor(item.ctr, "ctr"))}
                {renderCell(item.connectRate, c?.connectRate ?? null, "connectRate", formatPercent, getCellColor(item.connectRate, "connectRate"))}
                {renderCell(item.taxaConversao, c?.taxaConversao ?? null, "taxaConversao", formatPercent, getCellColor(item.taxaConversao, "taxaConversao"))}
                {renderCell(item.leads, c?.leads ?? null, "leads", formatNumber)}
                {renderCell(item.cpl, c?.cpl ?? null, "cpl", formatCurrency, getCellColor(item.cpl, "cpl"), true)}
                {renderCell(item.mql, c?.mql ?? null, "mql", formatNumber)}
                {renderCell(item.cpmql, c?.cpmql ?? null, "cpmql", formatCurrency, getCellColor(item.cpmql, "cpmql"), true)}
                {renderCell(item.percMql, c?.percMql ?? null, "percMql", formatPercent, getCellColor(item.percMql, "percMql"))}
                {renderCell(item.descartadoPerc, c?.descartadoPerc ?? null, "descartadoPerc", formatPercent)}
                {expandedGroups.has("desc") && (
                  <>
                    {renderCell(item.descartadoMqlPerc, c?.descartadoMqlPerc ?? null, "descartadoMqlPerc", formatPercent)}
                    {renderCell(item.descartadoNmqlPerc, c?.descartadoNmqlPerc ?? null, "descartadoNmqlPerc", formatPercent)}
                  </>
                )}
                {renderCell(item.percRa, c?.percRa ?? null, "percRa", formatPercent, getCellColor(item.percRa, "percRa"))}
                {expandedGroups.has("ra") && (
                  <>
                    {renderCell(item.percRaMql, c?.percRaMql ?? null, "percRaMql", formatPercent, getCellColor(item.percRaMql, "percRaMql"))}
                    {renderCell(item.percRaNmql, c?.percRaNmql ?? null, "percRaNmql", formatPercent, getCellColor(item.percRaNmql, "percRaNmql"))}
                  </>
                )}
                {renderCell(item.cpra, c?.cpra ?? null, "cpra", formatCurrency, getCellColor(item.cpra, "cpmql"), true)}
                {expandedGroups.has("cpra") && (
                  <>
                    {renderCell(item.cpraMql, c?.cpraMql ?? null, "cpraMql", formatCurrency, getCellColor(item.cpraMql, "cpmql"), true)}
                    {renderCell(item.cpraNmql, c?.cpraNmql ?? null, "cpraNmql", formatCurrency, getCellColor(item.cpraNmql, "cpmql"), true)}
                  </>
                )}
                {renderCell(item.percRr, c?.percRr ?? null, "percRr", formatPercent, getCellColor(item.percRr, "percRr"))}
                {expandedGroups.has("rr") && (
                  <>
                    {renderCell(item.percRrMql, c?.percRrMql ?? null, "percRrMql", formatPercent, getCellColor(item.percRrMql, "percRrMql"))}
                    {renderCell(item.percRrNmql, c?.percRrNmql ?? null, "percRrNmql", formatPercent, getCellColor(item.percRrNmql, "percRrNmql"))}
                  </>
                )}
                {renderCell(item.cprr, c?.cprr ?? null, "cprr", formatCurrency, getCellColor(item.cprr, "cpmql"), true)}
                {expandedGroups.has("cprr") && (
                  <>
                    {renderCell(item.cprrMql, c?.cprrMql ?? null, "cprrMql", formatCurrency, getCellColor(item.cprrMql, "cpmql"), true)}
                    {renderCell(item.cprrNmql, c?.cprrNmql ?? null, "cprrNmql", formatCurrency, getCellColor(item.cprrNmql, "cpmql"), true)}
                  </>
                )}
                {renderCell(item.percRrVendas, c?.percRrVendas ?? null, "percRrVendas", formatPercent, getCellColor(item.percRrVendas, "percRrVendas"))}
                {expandedGroups.has("rrv") && (
                  <>
                    {renderCell(item.percRrMqlVendas, c?.percRrMqlVendas ?? null, "percRrMqlVendas", formatPercent, getCellColor(item.percRrMqlVendas, "percRrMqlVendas"))}
                    {renderCell(item.percRrNmqlVendas, c?.percRrNmqlVendas ?? null, "percRrNmqlVendas", formatPercent, getCellColor(item.percRrNmqlVendas, "percRrNmqlVendas"))}
                  </>
                )}
                {renderCell(item.clientesUnicos, c?.clientesUnicos ?? null, "clientesUnicos", formatNumber)}
                {renderCell(item.leadTime, c?.leadTime ?? null, "leadTime", (v) => (v !== null ? `${v}d` : "-"))}
                {renderCell(item.aov, c?.aov ?? null, "aov", formatCurrency)}
                {renderCell(item.receita, c?.receita ?? null, "receita", formatCurrency)}
                {expandedGroups.has("receita") && (
                  <>
                    {renderCell(item.receitaPontual || null, c?.receitaPontual || null, "receitaPontual", formatCurrency)}
                    {renderCell(item.receitaRecorrente || null, c?.receitaRecorrente || null, "receitaRecorrente", formatCurrency)}
                  </>
                )}
                {renderCell(item.cacGeral, c?.cacGeral ?? null, "cacGeral", formatCurrency, "", true)}
                {expandedGroups.has("cac") && (
                  <>
                    {renderCell(item.cacUnico, c?.cacUnico ?? null, "cacUnico", formatCurrency, getCellColor(item.cacUnico, "cacUnico"), true)}
                    {renderCell(item.cacContrato, c?.cacContrato ?? null, "cacContrato", formatCurrency, getCellColor(item.cacContrato, "cacContrato"), true)}
                  </>
                )}
                {renderCell(item.roas, c?.roas ?? null, "roas", (v) => (v !== null ? `${v}x` : "-"))}
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={50} className="text-center py-8 text-muted-foreground">
                Nenhum dado encontrado para o período selecionado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
