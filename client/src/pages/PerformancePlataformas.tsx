import { useState, useMemo, Fragment } from "react";
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
  category: string;
  categoryName: string;
  investimento: number | null;
  sessoes: number | null;
  taxaConversao: number | null;
  leads: number;
  mqls: number;
  cpl: number | null;
  cpmql: number | null;
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

interface CategoryGroup {
  key: string;
  name: string;
  platforms: PlatformData[];
  totals: PlatformData;
}

const CATEGORY_ORDER = ['midia_paga', 'social_media', 'crm_channel', 'organico', 'eventos'];

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

function aggregateRows(rows: PlatformData[]): PlatformData {
  const sumNum = (key: keyof PlatformData) =>
    rows.reduce((s, r) => s + ((r[key] as number) || 0), 0);
  const sumNullable = (key: keyof PlatformData) => {
    const vals = rows.filter(r => r[key] !== null);
    if (vals.length === 0) return null;
    return vals.reduce((s, r) => s + ((r[key] as number) || 0), 0);
  };
  const avgNonNull = (key: keyof PlatformData) => {
    const vals = rows.map(r => r[key] as number | null).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1));
  };

  const investimento = sumNullable('investimento');
  const sessoes = sumNullable('sessoes');
  const leads = sumNum('leads');
  const mqls = sumNum('mqls');
  const vendas = sumNum('negocioGanho');
  const receita = sumNullable('receita');
  const receitaPontual = sumNullable('receitaPontual');
  const receitaRecorrente = sumNullable('receitaRecorrente');

  const raTotal = rows.reduce((s, r) => {
    if (r.percRa !== null && r.leads > 0) return s + Math.round(r.percRa * r.leads / 100);
    return s;
  }, 0);
  const rrTotal = rows.reduce((s, r) => {
    if (r.percRr !== null && r.percRa !== null && r.leads > 0) {
      const ra = Math.round(r.percRa * r.leads / 100);
      return s + Math.round(r.percRr * ra / 100);
    }
    return s;
  }, 0);
  const clientesUnicos = rows.reduce((s, r) => {
    if (r.aov !== null && r.receita !== null && r.aov > 0) return s + Math.round(r.receita / r.aov);
    return s + r.negocioGanho;
  }, 0);

  return {
    id: 'aggregate',
    name: 'Total',
    category: '',
    categoryName: '',
    investimento: investimento !== null ? Math.round(investimento) : null,
    sessoes: sessoes !== null ? Math.round(sessoes) : null,
    taxaConversao: sessoes && sessoes > 0 && leads > 0 ? parseFloat(((leads / sessoes) * 100).toFixed(2)) : null,
    leads,
    mqls,
    cpl: investimento !== null && investimento > 0 && leads > 0 ? Math.round(investimento / leads) : null,
    cpmql: investimento !== null && investimento > 0 && mqls > 0 ? Math.round(investimento / mqls) : null,
    percMql: leads > 0 ? parseFloat(((mqls / leads) * 100).toFixed(1)) : null,
    percRa: leads > 0 && raTotal > 0 ? parseFloat(((raTotal / leads) * 100).toFixed(1)) : null,
    percRaMql: avgNonNull('percRaMql'),
    percRaNmql: avgNonNull('percRaNmql'),
    percRr: raTotal > 0 && rrTotal > 0 ? parseFloat(((rrTotal / raTotal) * 100).toFixed(1)) : null,
    percRrMql: avgNonNull('percRrMql'),
    percRrNmql: avgNonNull('percRrNmql'),
    percRrVendas: rrTotal > 0 && vendas > 0 ? parseFloat(((vendas / rrTotal) * 100).toFixed(1)) : null,
    percRrMqlVendas: avgNonNull('percRrMqlVendas'),
    percRrNmqlVendas: avgNonNull('percRrNmqlVendas'),
    negocioGanho: vendas,
    leadTime: avgNonNull('leadTime'),
    aov: clientesUnicos > 0 && receita ? Math.round(receita / clientesUnicos) : null,
    receita: receita !== null ? Math.round(receita) : null,
    receitaPontual: receitaPontual !== null ? Math.round(receitaPontual) : null,
    receitaRecorrente: receitaRecorrente !== null ? Math.round(receitaRecorrente) : null,
    cac: investimento !== null && investimento > 0 && clientesUnicos > 0 ? Math.round(investimento / clientesUnicos) : null,
    cacUnico: investimento !== null && investimento > 0 && clientesUnicos > 0 ? Math.round(investimento / clientesUnicos) : null,
    cacContrato: avgNonNull('cacContrato'),
  };
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: keyof PlatformData; direction: 'asc' | 'desc' }>({ key: 'leads', direction: 'desc' });

  const startDate = format(dateRange.from, "yyyy-MM-dd");
  const endDate = format(dateRange.to, "yyyy-MM-dd");

  const { data: platforms = [], isLoading } = useQuery<PlatformData[]>({
    queryKey: ["/api/growth/performance-plataformas", { startDate, endDate }],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/growth/performance-plataformas?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  // Dados do período de comparação
  const compareStartDate = compareEnabled && compareRange?.from ? format(compareRange.from, 'yyyy-MM-dd') : '';
  const compareEndDate = compareEnabled && compareRange?.to ? format(compareRange.to, 'yyyy-MM-dd') : '';

  const { data: compareData = [] } = useQuery<PlatformData[]>({
    queryKey: ["/api/growth/performance-plataformas/compare", { startDate: compareStartDate, endDate: compareEndDate }],
    queryFn: async () => {
      if (!compareStartDate || !compareEndDate) return [];
      const params = new URLSearchParams({ startDate: compareStartDate, endDate: compareEndDate });
      const res = await fetch(`/api/growth/performance-plataformas?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch compare data');
      return res.json();
    },
    enabled: compareEnabled && !!compareStartDate && !!compareEndDate,
  });

  // Mapa de comparação por platform id
  const compareMap = useMemo(() => {
    const map = new Map<string, PlatformData>();
    compareData.forEach(item => map.set(item.id, item));
    return map;
  }, [compareData]);

  // Agregar dados de comparação por categoria
  const compareCategoryMap = useMemo(() => {
    const grouped = new Map<string, PlatformData[]>();
    for (const p of compareData) {
      if (!grouped.has(p.category)) grouped.set(p.category, []);
      grouped.get(p.category)!.push(p);
    }
    const map = new Map<string, PlatformData>();
    for (const [key, plats] of grouped) {
      map.set(key, aggregateRows(plats));
    }
    return map;
  }, [compareData]);

  const compareGrandTotal = useMemo(() => {
    if (compareData.length === 0) return null;
    return aggregateRows(compareData);
  }, [compareData]);

  const isCompareActive = compareEnabled && compareData.length > 0;

  const { data: metricRules = [] } = useQuery<MetricRulesetWithThresholds[]>({
    queryKey: ["/api/metric-rules"],
  });

  const getCellClassName = (metricKey: string, value: number | null): string => {
    if (value === null || value === undefined) return "";
    const color = getMetricColor(value, metricRules, metricKey);
    if (!color || color === 'default') return "";
    return getColorClasses(color);
  };

  const toggleCategory = (catKey: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(catKey)) newSet.delete(catKey);
      else newSet.add(catKey);
      return newSet;
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
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const categoryGroups = useMemo((): CategoryGroup[] => {
    const grouped = new Map<string, PlatformData[]>();
    for (const p of platforms) {
      if (!grouped.has(p.category)) grouped.set(p.category, []);
      grouped.get(p.category)!.push(p);
    }

    return CATEGORY_ORDER
      .filter(key => grouped.has(key))
      .map(key => {
        const plats = grouped.get(key)!;
        return {
          key,
          name: plats[0]?.categoryName || key,
          platforms: plats,
          totals: aggregateRows(plats),
        };
      });
  }, [platforms]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return categoryGroups;
    const term = searchTerm.toLowerCase();
    return categoryGroups
      .map(g => ({
        ...g,
        platforms: g.platforms.filter(p =>
          p.name.toLowerCase().includes(term) || g.name.toLowerCase().includes(term)
        ),
      }))
      .filter(g => g.platforms.length > 0 || g.name.toLowerCase().includes(term));
  }, [categoryGroups, searchTerm]);

  const grandTotal = useMemo(() => {
    return aggregateRows(platforms);
  }, [platforms]);

  // Renderizar célula com variação expandida
  const renderCell = (
    value: number | null,
    compareValue: number | null,
    column: string,
    formatter: (v: number | null) => string,
    colorClass = '',
    invertPositive = false,
  ) => {
    const isExpanded = expandedColumns.has(column);
    return (
      <>
        <td className={cn("p-2 text-right whitespace-nowrap", colorClass)}>{formatter(value)}</td>
        {isCompareActive && isExpanded && (
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
    const isExpanded = expandedColumns.has(column as string);
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
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            )}
            {label}

          </div>
        </th>
        {isCompareActive && isExpanded && (
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
      {/* RR % (grupo expansível) */}
      {renderCell(row.percRr, comp?.percRr ?? null, 'percRr', formatPercent, getCellClassName('percRr', row.percRr))}
      {expandedGroups.has('rr') && (
        <>
          {renderCell(row.percRrMql, comp?.percRrMql ?? null, 'percRrMql', formatPercent, getCellClassName('percRr', row.percRrMql))}
          {renderCell(row.percRrNmql, comp?.percRrNmql ?? null, 'percRrNmql', formatPercent, getCellClassName('percRr', row.percRrNmql))}
        </>
      )}
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

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar canal ou plataforma..."
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
                    <th className="p-2 text-left sticky left-0 bg-muted/50 z-30 min-w-[240px]">Canal / Plataforma</th>
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
                    <GroupableHeader group="rr" label="RR %" column="percRr">
                      <SortableHeader column="percRrMql" label="RR MQL %" />
                      <SortableHeader column="percRrNmql" label="RR NMQL %" />
                    </GroupableHeader>
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
                  {filteredGroups.map((group) => {
                    const isExpanded = expandedCategories.has(group.key);
                    const hasMultiplePlatforms = group.platforms.length > 1;
                    const catComp = compareCategoryMap.get(group.key) || null;

                    return (
                      <Fragment key={group.key}>
                        {/* Category header row */}
                        <tr
                          className={cn(
                            "border-b border-border bg-muted/30 font-semibold",
                            hasMultiplePlatforms && "cursor-pointer hover:bg-muted/50"
                          )}
                          onClick={() => hasMultiplePlatforms && toggleCategory(group.key)}
                        >
                          <td className="p-2 sticky left-0 bg-muted/30 z-10">
                            <div className="flex items-center gap-2">
                              {hasMultiplePlatforms ? (
                                isExpanded
                                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <div className="w-4" />
                              )}
                              <span className="text-sm font-semibold">{group.name}</span>
                              {hasMultiplePlatforms && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {group.platforms.length}
                                </Badge>
                              )}
                            </div>
                          </td>
                          {renderMetricCells(group.totals, catComp)}
                        </tr>
                        {/* Platform rows (when expanded) */}
                        {isExpanded && hasMultiplePlatforms && group.platforms.map((platform) => (
                          <tr
                            key={`plat-${platform.id}`}
                            className="border-b border-border hover:bg-muted/10"
                          >
                            <td className="p-2 sticky left-0 bg-background z-10" style={{ paddingLeft: '40px' }}>
                              <span className="text-sm text-muted-foreground">{platform.name}</span>
                            </td>
                            {renderMetricCells(platform, compareMap.get(platform.id) || null)}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}

                  {/* Grand total row */}
                  <tr className="border-t-2 border-border bg-muted/50 font-bold">
                    <td className="p-2 sticky left-0 bg-muted/50 z-10">
                      <span className="text-sm font-bold">TOTAL GERAL</span>
                    </td>
                    {renderMetricCells(grandTotal, compareGrandTotal)}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
