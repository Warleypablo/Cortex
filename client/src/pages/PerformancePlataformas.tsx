import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronRight, ChevronDown } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { getMetricColor, getColorClasses } from "@/lib/metricFormatting";
import type { MetricRulesetWithThresholds } from "@shared/schema";
import type { DateRange } from "react-day-picker";
import { formatCurrency as formatCurrencyUtil, formatDecimal as formatDecimalUtil, formatPercent as formatPercentUtil } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PlatformData {
  id: string;
  name: string;
  investimento: number | null;
  sessoes: number | null;
  taxaConversao: number | null;
  leads: number;
  mqls: number;
  cpl: number | null;
  cpmql: number | null;
  cpra: number | null;
  cprr: number | null;
  percMql: number | null;
  percRa: number | null;
  percRaMql: number | null;
  percRaNmql: number | null;
  percRr: number | null;
  percRrMql: number | null;
  percRrNmql: number | null;
  percRrVendas: number | null;
  percRrMqlVendas: number | null;
  percRrNmqlVendas: number | null;
  negocioGanho: number;
  leadTime: number | null;
  aov: number | null;
  receita: number | null;
  receitaPontual: number | null;
  receitaRecorrente: number | null;
  cac: number | null;
  cacUnico: number | null;
  cacContrato: number | null;
}

type NodeLevel = 'medium' | 'source' | 'campaign' | 'term' | 'content' | 'total';

interface PlatformNode extends PlatformData {
  level: NodeLevel;
  children?: PlatformNode[];
}

interface PlatformResponse {
  rows: PlatformNode[];
  total: PlatformData;
}

const formatNumber = (value: number | null): string => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR").format(value);
};

const formatPercent = (value: number | null): string => {
  if (value === null || value === undefined) return "-";
  return formatPercentUtil(value);
};

const formatDecimal = (value: number | null): string => {
  if (value === null || value === undefined) return "-";
  return formatDecimalUtil(value);
};

const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return "-";
  return formatCurrencyUtil(value);
};

function flattenNodes(nodes: PlatformNode[], map: Map<string, PlatformNode>) {
  for (const n of nodes) {
    map.set(n.id, n);
    if (n.children) flattenNodes(n.children, map);
  }
}

function pruneTree(nodes: PlatformNode[], term: string): PlatformNode[] {
  const out: PlatformNode[] = [];
  for (const n of nodes) {
    if (n.name.toLowerCase().includes(term)) {
      out.push(n);
      continue;
    }
    const prunedChildren = n.children ? pruneTree(n.children, term) : [];
    if (prunedChildren.length > 0) out.push({ ...n, children: prunedChildren });
  }
  return out;
}

function sortTree(nodes: PlatformNode[], key: keyof PlatformData, direction: 'asc' | 'desc'): PlatformNode[] {
  const dir = direction === 'asc' ? 1 : -1;
  const sorted = [...nodes].sort((a, b) => {
    const av = a[key] as number | string | null;
    const bv = b[key] as number | string | null;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'string' || typeof bv === 'string') {
      return String(av).localeCompare(String(bv)) * dir;
    }
    return (av - bv) * dir;
  });
  return sorted.map((n) => (n.children ? { ...n, children: sortTree(n.children, key, direction) } : n));
}

export default function PerformancePlataformas() {
  usePageTitle("Performance por Plataforma");
  useSetPageInfo("Performance por Plataforma", "Comparação de métricas entre canais de aquisição");

  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareRange, setCompareRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: keyof PlatformData; direction: 'asc' | 'desc' } | null>(null);

  const startDate = format(dateRange.from, "yyyy-MM-dd");
  const endDate = format(dateRange.to, "yyyy-MM-dd");

  const { data, isLoading } = useQuery<PlatformResponse>({
    queryKey: ["/api/growth/performance-plataformas", { startDate, endDate }],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/growth/performance-plataformas?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? null;

  // Dados do período de comparação
  const compareStartDate = compareEnabled && compareRange?.from ? format(compareRange.from, 'yyyy-MM-dd') : '';
  const compareEndDate = compareEnabled && compareRange?.to ? format(compareRange.to, 'yyyy-MM-dd') : '';

  const { data: compareData } = useQuery<PlatformResponse>({
    queryKey: ["/api/growth/performance-plataformas/compare", { startDate: compareStartDate, endDate: compareEndDate }],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: compareStartDate, endDate: compareEndDate });
      const res = await fetch(`/api/growth/performance-plataformas?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch compare data');
      return res.json();
    },
    enabled: compareEnabled && !!compareStartDate && !!compareEndDate,
  });

  // Mapa de comparação por id de nó (qualquer nível)
  const compareMap = useMemo(() => {
    const map = new Map<string, PlatformNode>();
    if (compareData?.rows) flattenNodes(compareData.rows, map);
    return map;
  }, [compareData]);

  const isCompareActive = compareEnabled && !!compareData?.rows?.length;

  const { data: metricRules = [] } = useQuery<MetricRulesetWithThresholds[]>({
    queryKey: ["/api/metric-rules"],
  });

  const getCellClassName = (metricKey: string, value: number | null): string => {
    if (value === null || value === undefined) return "";
    const color = getMetricColor(value, metricRules, metricKey);
    if (!color || color === 'default') return "";
    return getColorClasses(color);
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const toggleColumn = (col: string) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const handleSort = (key: keyof PlatformData) => {
    setSortConfig(prev =>
      prev && prev.key === key && prev.direction === 'desc'
        ? { key, direction: 'asc' }
        : { key, direction: 'desc' }
    );
  };

  // Árvore exibida: aplica ordenação (se houver) e busca textual (poda).
  const displayRows = useMemo(() => {
    let result = rows;
    if (sortConfig) result = sortTree(result, sortConfig.key, sortConfig.direction);
    if (searchTerm) result = pruneTree(result, searchTerm.toLowerCase());
    return result;
  }, [rows, sortConfig, searchTerm]);

  const searching = !!searchTerm;
  const isExpanded = (id: string) => searching || expandedRows.has(id);

  // Renderizar célula com variação expandida
  const renderCell = (
    value: number | null,
    compareValue: number | null,
    column: string,
    formatter: (v: number | null) => string,
    colorClass = '',
    invertPositive = false,
  ) => {
    const colExpanded = expandedColumns.has(column);
    return (
      <>
        <td className={cn("p-2 text-right whitespace-nowrap", colorClass)}>{formatter(value)}</td>
        {isCompareActive && colExpanded && (
          <td className="p-2 text-right text-xs whitespace-nowrap bg-muted/10">
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
                  {((value - compareValue) / compareValue * 100) > 0 ? '+' : ''}
                  {((value - compareValue) / compareValue * 100).toFixed(1)}%
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </td>
        )}
      </>
    );
  };

  // Header components
  const SortableHeader = ({ column, label }: { column: keyof PlatformData; label: string }) => {
    const colExpanded = expandedColumns.has(column as string);
    return (
      <>
        <th
          className="p-2 text-right min-w-[70px] cursor-pointer hover:bg-muted/70 whitespace-nowrap text-xs"
          onClick={() => handleSort(column)}
        >
          <div className="flex items-center justify-end gap-1">
            {isCompareActive && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleColumn(column as string); }}
                className="hover:text-foreground text-muted-foreground"
              >
                {colExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            )}
            {label}
          </div>
        </th>
        {isCompareActive && colExpanded && (
          <th className="whitespace-nowrap text-xs text-muted-foreground italic p-2">
            <div className="text-center">Var.</div>
          </th>
        )}
      </>
    );
  };

  const GroupableHeader = ({ group, label, column, children }: { group: string; label: string; column: keyof PlatformData; children: React.ReactNode }) => {
    const isGroupExpanded = expandedGroups.has(group);
    const isColExpanded = expandedColumns.has(column as string);
    return (
      <>
        <th
          className="p-2 text-right min-w-[70px] cursor-pointer hover:bg-muted/70 whitespace-nowrap text-xs"
          onClick={() => handleSort(column)}
        >
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); toggleGroup(group); }}
              className="hover:text-foreground text-muted-foreground"
            >
              {isGroupExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {isCompareActive && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleColumn(column as string); }}
                className="hover:text-foreground text-muted-foreground"
              >
                {isColExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
              </button>
            )}
            {label}
          </div>
        </th>
        {isCompareActive && isColExpanded && (
          <th className="whitespace-nowrap text-xs text-muted-foreground italic p-2">
            <div className="text-center">Var.</div>
          </th>
        )}
        {isGroupExpanded && children}
      </>
    );
  };

  const renderMetricCells = (row: PlatformData, comp: PlatformData | null) => (
    <>
      {renderCell(row.investimento, comp?.investimento ?? null, 'investimento', formatCurrency)}
      {renderCell(row.sessoes, comp?.sessoes ?? null, 'sessoes', formatNumber)}
      {renderCell(row.taxaConversao, comp?.taxaConversao ?? null, 'taxaConversao', formatPercent, getCellClassName('taxaConversao', row.taxaConversao))}
      {renderCell(row.leads, comp?.leads ?? null, 'leads', formatNumber)}
      {renderCell(row.mqls, comp?.mqls ?? null, 'mqls', formatNumber)}
      {renderCell(row.cpl, comp?.cpl ?? null, 'cpl', formatCurrency, getCellClassName('cpl', row.cpl), true)}
      {renderCell(row.cpmql, comp?.cpmql ?? null, 'cpmql', formatCurrency, getCellClassName('cpmql', row.cpmql), true)}
      {renderCell(row.percMql, comp?.percMql ?? null, 'percMql', formatPercent, getCellClassName('percMql', row.percMql))}
      {/* RA % (grupo expansível) */}
      {renderCell(row.percRa, comp?.percRa ?? null, 'percRa', formatPercent, getCellClassName('percRa', row.percRa))}
      {expandedGroups.has('ra') && (
        <>
          {renderCell(row.percRaMql, comp?.percRaMql ?? null, 'percRaMql', formatPercent, getCellClassName('percRa', row.percRaMql))}
          {renderCell(row.percRaNmql, comp?.percRaNmql ?? null, 'percRaNmql', formatPercent, getCellClassName('percRa', row.percRaNmql))}
        </>
      )}
      {/* CPRA — métrica de vendas (custo por reunião agendada), ao lado de RA % */}
      {renderCell(row.cpra, comp?.cpra ?? null, 'cpra', formatCurrency, getCellClassName('cpmql', row.cpra), true)}
      {/* RR % (grupo expansível) */}
      {renderCell(row.percRr, comp?.percRr ?? null, 'percRr', formatPercent, getCellClassName('percRr', row.percRr))}
      {expandedGroups.has('rr') && (
        <>
          {renderCell(row.percRrMql, comp?.percRrMql ?? null, 'percRrMql', formatPercent, getCellClassName('percRr', row.percRrMql))}
          {renderCell(row.percRrNmql, comp?.percRrNmql ?? null, 'percRrNmql', formatPercent, getCellClassName('percRr', row.percRrNmql))}
        </>
      )}
      {/* CPRR — métrica de vendas (custo por reunião realizada), ao lado de RR % */}
      {renderCell(row.cprr, comp?.cprr ?? null, 'cprr', formatCurrency, getCellClassName('cpmql', row.cprr), true)}
      {/* RR→V % (grupo expansível) */}
      {renderCell(row.percRrVendas, comp?.percRrVendas ?? null, 'percRrVendas', formatPercent, getCellClassName('percRrVendas', row.percRrVendas))}
      {expandedGroups.has('rrv') && (
        <>
          {renderCell(row.percRrMqlVendas, comp?.percRrMqlVendas ?? null, 'percRrMqlVendas', formatPercent, getCellClassName('percRrVendas', row.percRrMqlVendas))}
          {renderCell(row.percRrNmqlVendas, comp?.percRrNmqlVendas ?? null, 'percRrNmqlVendas', formatPercent, getCellClassName('percRrVendas', row.percRrNmqlVendas))}
        </>
      )}
      {renderCell(row.negocioGanho, comp?.negocioGanho ?? null, 'negocioGanho', formatNumber)}
      {renderCell(row.leadTime, comp?.leadTime ?? null, 'leadTime', (v) => v !== null ? `${formatDecimal(v)}d` : '-', getCellClassName('leadTime', row.leadTime), true)}
      {renderCell(row.aov, comp?.aov ?? null, 'aov', formatCurrency)}
      {/* Receita (grupo expansível) */}
      {renderCell(row.receita, comp?.receita ?? null, 'receita', formatCurrency)}
      {expandedGroups.has('receita') && (
        <>
          {renderCell(row.receitaPontual, comp?.receitaPontual ?? null, 'receitaPontual', formatCurrency)}
          {renderCell(row.receitaRecorrente, comp?.receitaRecorrente ?? null, 'receitaRecorrente', formatCurrency)}
        </>
      )}
      {/* CAC (grupo expansível) */}
      {renderCell(row.cac, comp?.cac ?? null, 'cac', formatCurrency, getCellClassName('cacUnico', row.cac), true)}
      {expandedGroups.has('cac') && (
        <>
          {renderCell(row.cacUnico, comp?.cacUnico ?? null, 'cacUnico', formatCurrency, getCellClassName('cacUnico', row.cacUnico), true)}
          {renderCell(row.cacContrato, comp?.cacContrato ?? null, 'cacContrato', formatCurrency, getCellClassName('cacContrato', row.cacContrato), true)}
        </>
      )}
    </>
  );

  const renderNodeRows = (nodes: PlatformNode[], depth: number): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    for (const node of nodes) {
      const hasChildren = !!(node.children && node.children.length > 0);
      const expanded = isExpanded(node.id);
      const comp = compareMap.get(node.id) || null;
      out.push(
        <tr
          key={node.id}
          className={cn(
            "border-b border-border",
            depth === 0 ? "bg-muted/30 font-semibold" : "hover:bg-muted/10",
            hasChildren && "cursor-pointer",
          )}
          onClick={hasChildren ? () => toggleRow(node.id) : undefined}
        >
          <td
            className={cn("p-2 sticky left-0 z-10", depth === 0 ? "bg-muted/30" : "bg-background")}
            style={{ paddingLeft: `${8 + depth * 18}px` }}
          >
            <div className="flex items-center gap-1.5">
              {hasChildren ? (
                expanded
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <div className="w-4 shrink-0" />
              )}
              <span className={cn(
                depth === 0 ? "text-sm font-semibold" : "text-sm",
                depth >= 2 && "text-muted-foreground",
              )}>
                {node.name}
              </span>
              {hasChildren && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {node.children!.length}
                </Badge>
              )}
            </div>
          </td>
          {renderMetricCells(node, comp)}
        </tr>
      );
      if (hasChildren && expanded) {
        out.push(...renderNodeRows(node.children!, depth + 1));
      }
    }
    return out;
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar canal, source, campanha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <DateRangePicker
              value={dateRange}
              onChange={(range) => {
                if (range?.from) {
                  setDateRange({ from: range.from, to: range.to || range.from });
                }
              }}
              align="end"
              showCompare
              compareEnabled={compareEnabled}
              compareRange={compareRange}
              onCompareChange={(enabled, range) => {
                setCompareEnabled(enabled);
                setCompareRange(range);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-20">
                  <tr>
                    <th className="p-2 text-left sticky left-0 bg-muted/50 z-30 min-w-[260px]">Canal / Source / Campanha</th>
                    <SortableHeader column="investimento" label="Investimento" />
                    <SortableHeader column="sessoes" label="Sessões" />
                    <SortableHeader column="taxaConversao" label="Taxa Conv." />
                    <SortableHeader column="leads" label="Leads" />
                    <SortableHeader column="mqls" label="MQLs" />
                    <SortableHeader column="cpl" label="CPL" />
                    <SortableHeader column="cpmql" label="CPMQL" />
                    <SortableHeader column="percMql" label="%MQLs" />
                    <GroupableHeader group="ra" label="RA %" column="percRa">
                      <SortableHeader column="percRaMql" label="RA MQL %" />
                      <SortableHeader column="percRaNmql" label="RA NMQL %" />
                    </GroupableHeader>
                    <SortableHeader column="cpra" label="CPRA" />
                    <GroupableHeader group="rr" label="RR %" column="percRr">
                      <SortableHeader column="percRrMql" label="RR MQL %" />
                      <SortableHeader column="percRrNmql" label="RR NMQL %" />
                    </GroupableHeader>
                    <SortableHeader column="cprr" label="CPRR" />
                    <GroupableHeader group="rrv" label="RR→V %" column="percRrVendas">
                      <SortableHeader column="percRrMqlVendas" label="RR MQL→V %" />
                      <SortableHeader column="percRrNmqlVendas" label="RR NMQL→V %" />
                    </GroupableHeader>
                    <SortableHeader column="negocioGanho" label="Neg. Ganho" />
                    <SortableHeader column="leadTime" label="Lead Time" />
                    <SortableHeader column="aov" label="AOV" />
                    <GroupableHeader group="receita" label="Receita" column="receita">
                      <SortableHeader column="receitaPontual" label="Rec. Pontual" />
                      <SortableHeader column="receitaRecorrente" label="Rec. Recorrente" />
                    </GroupableHeader>
                    <GroupableHeader group="cac" label="CAC" column="cac">
                      <SortableHeader column="cacUnico" label="CAC Único" />
                      <SortableHeader column="cacContrato" label="CAC Contrato" />
                    </GroupableHeader>
                  </tr>
                </thead>
                <tbody>
                  {renderNodeRows(displayRows, 0)}

                  {/* Grand total row */}
                  {total && (
                    <tr className="border-t-2 border-border bg-muted/50 font-bold">
                      <td className="p-2 sticky left-0 bg-muted/50 z-10">
                        <span className="text-sm font-bold">TOTAL GERAL</span>
                      </td>
                      {renderMetricCells(total, compareData?.total ?? null)}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
