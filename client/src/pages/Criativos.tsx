import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { MetricFormattingSheet } from "@/components/MetricFormattingSheet";
import { MultiSelect } from "@/components/ui/multi-select";
import { Search, X, ArrowUpDown, TrendingUp, TrendingDown, Rocket, ExternalLink, Loader2, Settings, ChevronRight, ChevronDown } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { getMetricColor, getColorClasses, getBenchmarkColor, CRIATIVOS_BENCHMARK_MAP } from "@/lib/metricFormatting";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MetricRulesetWithThresholds } from "@shared/schema";
import type { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency as formatCurrencyUtil, formatDecimal as formatDecimalUtil, formatPercent as formatPercentUtil } from "@/lib/utils";

interface CriativoData {
  id: string;
  adName: string;
  link: string;
  status: string;
  plataforma: string;
  campaignId: string | null;
  campaignName: string | null;
  investimento: number;
  videoHook: number | null;
  videoHold: number | null;
  ctr: number | null;
  cpm: number | null;
  connectRate: number | null;
  taxaConversao: number | null;
  leads: number;
  cpl: number | null;
  mql: number;
  cpmql: number | null;
  percMql: number | null;
  descartadoPerc: number | null;
  descartadoMqlPerc: number | null;
  descartadoNmqlPerc: number | null;
  percRa: number | null;
  percRaMql: number | null;
  percRaNmql: number | null;
  percRr: number | null;
  percRrMql: number | null;
  percRrNmql: number | null;
  percRrVendas: number | null;
  percRrMqlVendas: number | null;
  percRrNmqlVendas: number | null;
  clientesUnicos: number;
  leadTime: number | null;
  aov: number | null;
  receita: number | null;
  receitaPontual: number;
  receitaRecorrente: number;
  cacGeral: number | null;
  cacUnico: number | null;
  cacContrato: number | null;
  roas: number | null;
}

interface Campanha {
  id: string;
  name: string;
}

interface KpiData {
  investimento: number;
  percMql: number;
  cpmql: number;
  vendas: number;
  cac: number;
  aov: number;
}

type SortConfig = {
  key: keyof CriativoData;
  direction: 'asc' | 'desc';
};

function formatNumber(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return formatPercentUtil(value);
}

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return formatCurrencyUtil(value);
}

export default function Criativos() {
  usePageTitle("Criativos");
  useSetPageInfo("Criativos", "Performance de Anúncios Meta Ads");
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareRange, setCompareRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selectedPlataformas, setSelectedPlataformas] = useState<string[]>([]);
  const [selectedProdutos, setSelectedProdutos] = useState<string[]>([]);
  const [campanhaFilters, setCampanhaFilters] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'investimento', direction: 'desc' });

  const { toast } = useToast();
  const [configOpen, setConfigOpen] = useState(false);

  const startDate = format(dateRange.from, 'yyyy-MM-dd');
  const endDate = format(dateRange.to, 'yyyy-MM-dd');

  // Buscar lista de campanhas (filtrada por gasto no período)
  const { data: campanhas = [] } = useQuery<Campanha[]>({
    queryKey: ['/api/growth/criativos/campanhas', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/growth/criativos/campanhas?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch campanhas');
      return res.json();
    },
  });

  // Extrair produtos únicos dos nomes das campanhas (padrão: [Produto] no nome)
  const produtos = useMemo(() => {
    const prodSet = new Set<string>();
    campanhas.forEach(c => {
      // Pegar todos os termos entre colchetes
      const matches = c.name.match(/\[([^\]]+)\]/g);
      if (matches) {
        // O produto geralmente é o último colchete antes do " - " ou o 4º colchete
        // Excluir termos conhecidos que não são produto
        const nonProduct = ['TP', 'Leads', 'Vendas', 'Tráfego', 'Reconhecimento', 'ABO', 'CBO', 'CLASS', 'COMMERCE'];
        matches.forEach(m => {
          const term = m.replace(/[\[\]]/g, '');
          if (!nonProduct.includes(term)) {
            prodSet.add(term);
          }
        });
      }
    });
    return Array.from(prodSet).sort();
  }, [campanhas]);

  // Campanhas filtradas por produto(s) selecionado(s)
  const campanhasFiltradas = useMemo(() => {
    if (selectedProdutos.length === 0) return campanhas;
    return campanhas.filter(c =>
      selectedProdutos.some(p => c.name.includes(`[${p}]`))
    );
  }, [campanhas, selectedProdutos]);

  // Mapear nomes de campanhas selecionadas para IDs
  const selectedCampaignIds = useMemo(() => {
    return campanhaFilters.map(name => {
      const c = campanhasFiltradas.find(camp => camp.name === name);
      return c?.id;
    }).filter((id): id is string => !!id);
  }, [campanhaFilters, campanhasFiltradas]);

  // IDs de campanhas ativas (por seleção manual ou produto)
  const activeCampaignIds = useMemo(() => {
    if (selectedCampaignIds.length > 0) return selectedCampaignIds;
    if (selectedProdutos.length > 0) return campanhasFiltradas.map(c => c.id);
    return [];
  }, [selectedCampaignIds, selectedProdutos, campanhasFiltradas]);

  const { data: criativos = [], isLoading } = useQuery<CriativoData[]>({
    queryKey: ['/api/growth/criativos', startDate, endDate, statusFilter, selectedPlataformas, selectedCampaignIds, selectedProdutos],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, status: statusFilter });
      if (selectedPlataformas.length > 0) {
        params.append('plataforma', selectedPlataformas.join(','));
      }
      if (activeCampaignIds.length > 0) {
        params.append('campanhaIds', activeCampaignIds.join(','));
      }
      const res = await fetch(`/api/growth/criativos?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch criativos');
      return res.json();
    }
  });

  // Dados do período de comparação (para variação por criativo)
  const compareStartDate = compareEnabled && compareRange?.from ? format(compareRange.from, 'yyyy-MM-dd') : '';
  const compareEndDate = compareEnabled && compareRange?.to ? format(compareRange.to, 'yyyy-MM-dd') : '';

  const { data: compareData = [] } = useQuery<CriativoData[]>({
    queryKey: ['/api/growth/criativos/compare', compareStartDate, compareEndDate, statusFilter, selectedPlataformas, selectedCampaignIds, selectedProdutos],
    queryFn: async () => {
      if (!compareStartDate || !compareEndDate) return [];
      const params = new URLSearchParams({ startDate: compareStartDate, endDate: compareEndDate, status: statusFilter });
      if (selectedPlataformas.length > 0) {
        params.append('plataforma', selectedPlataformas.join(','));
      }
      if (activeCampaignIds.length > 0) {
        params.append('campanhaIds', activeCampaignIds.join(','));
      }
      const res = await fetch(`/api/growth/criativos?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch compare criativos');
      return res.json();
    },
    enabled: compareEnabled && !!compareStartDate && !!compareEndDate,
  });

  // Mapa de comparação por ad_id
  const compareMap = useMemo(() => {
    const map = new Map<string, CriativoData>();
    compareData.forEach(item => map.set(item.id, item));
    return map;
  }, [compareData]);

  // Grupos de colunas expandidos (sub-métricas)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  // Colunas expandidas (para mostrar variação de comparação)
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());
  const toggleColumn = (col: string) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  // KPIs com comparação
  const { data: kpisData, isLoading: kpisLoading } = useQuery<{ current: KpiData; compare: KpiData | null }>({
    queryKey: ['/api/growth/criativos/kpis', startDate, endDate, compareEnabled, compareRange?.from, compareRange?.to, statusFilter, selectedCampaignIds, selectedProdutos],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, status: statusFilter });
      if (activeCampaignIds.length > 0) {
        params.append('campanhaIds', activeCampaignIds.join(','));
      }
      if (compareEnabled && compareRange?.from && compareRange?.to) {
        params.append('compareStartDate', format(compareRange.from, 'yyyy-MM-dd'));
        params.append('compareEndDate', format(compareRange.to, 'yyyy-MM-dd'));
      }
      const res = await fetch(`/api/growth/criativos/kpis?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch KPIs');
      return res.json();
    }
  });

  const { data: metricRules = [] } = useQuery<MetricRulesetWithThresholds[]>({
    queryKey: ['/api/metric-rules'],
  });

  // Fetch benchmarks from Gestão de Metas for the selected month
  const benchmarkMonth = format(dateRange.from, 'yyyy-MM');
  const { data: benchmarkData } = useQuery<Record<string, any>>({
    queryKey: ['/api/growth/orcado-realizado/budgets', benchmarkMonth, 'benchmarks'],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: benchmarkMonth, endDate: benchmarkMonth, funil: 'todos' });
      const res = await fetch(`/api/growth/orcado-realizado/budgets?${params}`, { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const saveRulesMutation = useMutation({
    mutationFn: async (data: { metricKey: string; displayLabel: string; thresholds: any[]; produto?: string | null; plataforma?: string | null }) => {
      return apiRequest('POST', `/api/metric-rules/${data.metricKey}/save`, {
        displayLabel: data.displayLabel,
        defaultColor: 'default',
        thresholds: data.thresholds.map(t => ({
          minValue: t.minValue ? parseFloat(t.minValue) : null,
          maxValue: t.maxValue ? parseFloat(t.maxValue) : null,
          color: t.color,
          label: t.label || null,
        })),
        produto: data.produto || null,
        plataforma: data.plataforma || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/metric-rules'] });
      toast({ title: 'Regras salvas com sucesso' });
    },
    onError: (error: Error) => {
      let description = 'Tente novamente ou verifique os logs do servidor.';
      try {
        const body = JSON.parse(error.message.replace(/^\d+:\s*/, ''));
        if (body.details) description = body.details;
        else if (body.error) description = body.error;
      } catch {
        if (error.message) description = error.message;
      }
      toast({ title: 'Erro ao salvar regras', description, variant: 'destructive' });
    },
  });

  const rulesetLookup = useMemo(() => {
    const map = new Map<string, MetricRulesetWithThresholds>();
    for (const r of metricRules) {
      const key = `${r.metricKey}|${r.produto || ''}|${r.plataforma || ''}`;
      map.set(key, r);
    }
    return map;
  }, [metricRules]);

  const findRulesetForContext = useCallback((metricKey: string, produto: string, plataforma: string) => {
    // Exact match first
    const exact = rulesetLookup.get(`${metricKey}|${produto}|${plataforma}`);
    if (exact) return exact;
    // Platform-only fallback
    if (produto) {
      const platformOnly = rulesetLookup.get(`${metricKey}||${plataforma}`);
      if (platformOnly) return platformOnly;
    }
    // Global fallback
    return rulesetLookup.get(`${metricKey}||`);
  }, [rulesetLookup]);

  const getCellColor = useCallback((value: number | null, metricKey: string) => {
    if (value === null) return '';

    // 1. Try context-aware ruleset (exact → platform-only → global)
    // When multiple selected, use empty string (global fallback)
    const currentProduto = selectedProdutos.length === 1 ? selectedProdutos[0] : '';
    const currentPlataforma = selectedPlataformas.length === 1 ? selectedPlataformas[0] : '';
    const ruleset = findRulesetForContext(metricKey, currentProduto, currentPlataforma);

    if (ruleset && ruleset.thresholds.length > 0) {
      const color = getMetricColor(value, [ruleset], metricKey);
      if (color !== 'default') return getColorClasses(color);
    }

    // 2. Fallback to benchmark-based color
    const mapping = CRIATIVOS_BENCHMARK_MAP[metricKey];
    if (mapping && benchmarkData) {
      const benchmarkValue = benchmarkData[mapping.budgetSegment]?.[mapping.budgetKey];
      if (benchmarkValue != null && benchmarkValue !== 0) {
        const color = getBenchmarkColor(value, benchmarkValue, mapping.lowerIsBetter);
        return getColorClasses(color);
      }
    }
    return '';
  }, [findRulesetForContext, selectedProdutos, selectedPlataformas, benchmarkData]);

  const filteredData = useMemo(() => {
    let result = [...criativos];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.adName.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue);
      const bStr = String(bValue);
      return sortConfig.direction === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return result;
  }, [criativos, searchTerm, sortConfig]);

  const handleSort = (key: keyof CriativoData) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Calcular médias das métricas numéricas
  const averages = useMemo(() => {
    const data = filteredData;
    const len = data.length;
    if (len === 0) return null;

    const avg = (key: keyof CriativoData) => {
      const values = data.map(d => d[key] as number | null).filter((v): v is number => v !== null && v !== 0);
      if (values.length === 0) return null;
      return parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
    };

    const sum = (key: keyof CriativoData) => {
      return data.reduce((s, d) => s + ((d[key] as number) || 0), 0);
    };

    const totalInvest = sum('investimento');
    const totalLeads = sum('leads');
    const totalMql = sum('mql');

    return {
      investimento: totalInvest,
      cpm: avg('cpm'),
      videoHook: avg('videoHook'),
      videoHold: avg('videoHold'),
      ctr: avg('ctr'),
      connectRate: avg('connectRate'),
      taxaConversao: avg('taxaConversao'),
      leads: totalLeads,
      cpl: avg('cpl'),
      mql: totalMql,
      cpmql: avg('cpmql'),
      percMql: avg('percMql'),
      percRa: avg('percRa'),
      percRaMql: avg('percRaMql'),
      percRaNmql: avg('percRaNmql'),
      percRr: (() => {
        const mql = avg('percRrMql');
        const nmql = avg('percRrNmql');
        if (mql !== null && nmql !== null) return parseFloat(((mql + nmql) / 2).toFixed(2));
        return mql ?? nmql;
      })(),
      percRrMql: avg('percRrMql'),
      percRrNmql: avg('percRrNmql'),
      percRrVendas: avg('percRrVendas'),
      percRrMqlVendas: avg('percRrMqlVendas'),
      percRrNmqlVendas: avg('percRrNmqlVendas'),
      clientesUnicos: sum('clientesUnicos'),
      leadTime: avg('leadTime'),
      aov: avg('aov'),
      receita: avg('receita'),
      receitaPontual: avg('receitaPontual'),
      receitaRecorrente: avg('receitaRecorrente'),
      cacGeral: avg('cacGeral'),
      cacUnico: avg('cacUnico'),
      cacContrato: avg('cacContrato'),
      roas: avg('roas'),
    };
  }, [filteredData]);

  // Calcular variação percentual para KPI cards
  function calcVariation(current: number, compare: number | undefined, invertPositive = false) {
    if (compare === undefined || compare === null || compare === 0) return null;
    const pct = ((current - compare) / compare) * 100;
    const isPositive = invertPositive ? pct < 0 : pct > 0;
    return { pct, isPositive };
  }

  const isCompareActive = compareEnabled && compareData.length > 0;

  const SortableHeader = ({ column, label }: { column: keyof CriativoData; label: string }) => {
    const isExpanded = expandedColumns.has(column);
    return (
      <>
        <TableHead
          className="cursor-pointer hover:bg-zinc-800 whitespace-nowrap text-xs bg-zinc-900 text-zinc-100"
          onClick={() => handleSort(column)}
          data-testid={`header-${column}`}
        >
          <div className="flex items-center gap-1">
            {isCompareActive && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleColumn(column); }}
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
                  {((value - compareValue) / compareValue * 100) > 0 ? '+' : ''}
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

  // Header agrupável — mostra chevron para expandir sub-colunas
  const GroupableHeader = ({ group, label, column, children }: { group: string; label: string; column: keyof CriativoData; children: React.ReactNode }) => {
    const isGroupExpanded = expandedGroups.has(group);
    return (
      <>
        <TableHead
          className="cursor-pointer hover:bg-zinc-800 whitespace-nowrap text-xs bg-zinc-900 text-zinc-100"
          onClick={() => handleSort(column)}
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
        {isCompareActive && expandedColumns.has(column) && (
          <TableHead className="whitespace-nowrap text-xs bg-zinc-800 text-zinc-400 italic">
            <div className="text-center">Var.</div>
          </TableHead>
        )}
        {isGroupExpanded && children}
      </>
    );
  };

  const kpis = kpisData?.current;
  const kpisCompare = kpisData?.compare;

  const investimentoVar = kpis && kpisCompare ? calcVariation(kpis.investimento, kpisCompare.investimento) : null;
  const percMqlVar = kpis && kpisCompare ? calcVariation(kpis.percMql, kpisCompare.percMql) : null;
  const cpmqlVar = kpis && kpisCompare ? calcVariation(kpis.cpmql, kpisCompare.cpmql, true) : null;
  const vendasVar = kpis && kpisCompare ? calcVariation(kpis.vendas, kpisCompare.vendas) : null;
  const cacVar = kpis && kpisCompare ? calcVariation(kpis.cac, kpisCompare.cac, true) : null;
  const aovVar = kpis && kpisCompare ? calcVariation(kpis.aov, kpisCompare.aov) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-nowrap min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar criativo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-[140px] h-8 text-xs"
                data-testid="input-search"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-5 w-5"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Ativo">Ativos</SelectItem>
                <SelectItem value="Pausado">Pausados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium">Plataforma:</span>
            <MultiSelect
              options={[
                { value: 'Meta Ads', label: 'Meta Ads' },
                { value: 'Google Ads', label: 'Google Ads' },
                { value: 'LinkedIn Ads', label: 'LinkedIn Ads' },
              ]}
              selected={selectedPlataformas}
              onChange={setSelectedPlataformas}
              placeholder="Todas"
              className="h-8 w-[120px] text-xs"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium">Produto:</span>
            <MultiSelect
              options={produtos.map(p => ({ value: p, label: p }))}
              selected={selectedProdutos}
              onChange={(v) => {
                setSelectedProdutos(v);
                setCampanhaFilters([]);
              }}
              placeholder="Todos"
              className="h-8 w-[120px] text-xs"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium">Campanha:</span>
            <MultiSelect
              options={campanhasFiltradas.map(c => c.name)}
              selected={campanhaFilters}
              onChange={setCampanhaFilters}
              placeholder="Todas"
              searchPlaceholder="Buscar campanha..."
              className="h-8 w-[140px] text-xs"
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

          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setConfigOpen(true)} data-testid="button-config-metrics">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 px-4 py-2">
        {/* Investimento */}
        <Card className="border bg-card">
          <CardContent className="pt-3 pb-2 px-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Investimento</span>
            <div className="text-lg font-bold tracking-tight mt-1">
              {kpisLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(kpis?.investimento ?? null)}
            </div>
            {investimentoVar && (
              <div className={cn("flex items-center gap-1 text-xs",
                investimentoVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {investimentoVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{investimentoVar.pct > 0 ? '+' : ''}{investimentoVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* % MQL */}
        <Card className="border bg-card">
          <CardContent className="pt-3 pb-2 px-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">% MQL</span>
            <div className="text-lg font-bold tracking-tight mt-1">
              {kpisLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : `${kpis?.percMql?.toFixed(1) ?? '0'}%`}
            </div>
            {percMqlVar && (
              <div className={cn("flex items-center gap-1 text-xs",
                percMqlVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {percMqlVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{percMqlVar.pct > 0 ? '+' : ''}{percMqlVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CPMQL */}
        <Card className="border bg-card">
          <CardContent className="pt-3 pb-2 px-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPMQL</span>
            <div className="text-lg font-bold tracking-tight mt-1">
              {kpisLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(kpis?.cpmql ?? null)}
            </div>
            {cpmqlVar && (
              <div className={cn("flex items-center gap-1 text-xs",
                cpmqlVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {cpmqlVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{cpmqlVar.pct > 0 ? '+' : ''}{cpmqlVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* NEGÓCIOS GANHOS */}
        <Card className="border bg-card">
          <CardContent className="pt-3 pb-2 px-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Negócios Ganhos</span>
            <div className="text-lg font-bold tracking-tight mt-1">
              {kpisLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatNumber(kpis?.vendas ?? null)}
            </div>
            {vendasVar && (
              <div className={cn("flex items-center gap-1 text-xs",
                vendasVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {vendasVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{vendasVar.pct > 0 ? '+' : ''}{vendasVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AOV */}
        <Card className="border bg-card">
          <CardContent className="pt-3 pb-2 px-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AOV</span>
            <div className="text-lg font-bold tracking-tight mt-1">
              {kpisLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(kpis?.aov ?? null)}
            </div>
            {aovVar && (
              <div className={cn("flex items-center gap-1 text-xs",
                aovVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {aovVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{aovVar.pct > 0 ? '+' : ''}{aovVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CAC */}
        <Card className="border bg-card">
          <CardContent className="pt-3 pb-2 px-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CAC</span>
            <div className="text-lg font-bold tracking-tight mt-1">
              {kpisLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(kpis?.cac ?? null)}
            </div>
            {cacVar && (
              <div className={cn("flex items-center gap-1 text-xs",
                cacVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {cacVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{cacVar.pct > 0 ? '+' : ''}{cacVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 p-4 pt-0">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg sr-only">Performance por Criativo</CardTitle>
              <div className="flex items-center gap-2">
                <MetricFormattingSheet
                  open={configOpen}
                  onOpenChange={setConfigOpen}
                  metricRules={metricRules}
                  produtos={produtos}
                  onSave={(data) => saveRulesMutation.mutate(data)}
                  isSaving={saveRulesMutation.isPending}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="relative max-h-[calc(100vh-260px)] overflow-auto [&>div]:!overflow-visible [&>div]:!static [&>div]:!w-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-50">
                    <TableRow className="bg-zinc-900 dark:bg-zinc-900 shadow-md [&>th]:bg-zinc-900 dark:[&>th]:bg-zinc-900">
                      <TableHead className="text-xs bg-zinc-900 text-zinc-100 sticky left-0 z-10">Link</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-zinc-800 whitespace-nowrap text-xs bg-zinc-900 text-zinc-100 sticky left-[52px] z-10"
                        onClick={() => handleSort('id')}
                      >
                        <div className="flex items-center gap-1">Ad Id <ArrowUpDown className="w-3 h-3" /></div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-zinc-800 whitespace-nowrap text-xs bg-zinc-900 text-zinc-100 sticky left-[220px] z-10"
                        onClick={() => handleSort('adName')}
                      >
                        <div className="flex items-center gap-1">Ad name <ArrowUpDown className="w-3 h-3" /></div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-zinc-800 whitespace-nowrap text-xs bg-zinc-900 text-zinc-100 sticky left-[470px] z-10 border-r border-zinc-700"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
                      </TableHead>
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
                      <GroupableHeader group="rr" label="RR %" column="percRr">
                        <SortableHeader column="percRrMql" label="RR MQL %" />
                        <SortableHeader column="percRrNmql" label="RR NMQL %" />
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
                    {/* Linha de médias dentro do thead para sticky funcionar */}
                    {averages && (
                      <TableRow className="bg-zinc-800 dark:bg-zinc-800 border-b-2 border-zinc-700 font-semibold text-xs [&>th]:bg-zinc-800 dark:[&>th]:bg-zinc-800 [&>th]:font-semibold">
                        <TableHead className="sticky left-0 z-10 bg-zinc-800" />
                        <TableHead className="text-muted-foreground sticky left-[52px] z-10 bg-zinc-800">Média</TableHead>
                        <TableHead className="sticky left-[220px] z-10 bg-zinc-800" />
                        <TableHead className="sticky left-[470px] z-10 bg-zinc-800 border-r border-zinc-700" />
                        {(() => {
                          const avgCell = (val: string, col: string) => (
                            <>
                              <TableHead className="text-right text-xs font-semibold">{val}</TableHead>
                              {isCompareActive && expandedColumns.has(col) && <TableHead className="bg-zinc-800/30" />}
                            </>
                          );
                          return (
                            <>
                              {avgCell(formatCurrency(averages.investimento), 'investimento')}
                              {avgCell(formatCurrency(averages.cpm), 'cpm')}
                              {avgCell(formatPercent(averages.videoHook), 'videoHook')}
                              {avgCell(formatPercent(averages.videoHold), 'videoHold')}
                              {avgCell(formatPercent(averages.ctr), 'ctr')}
                              {avgCell(formatPercent(averages.connectRate), 'connectRate')}
                              {avgCell(formatPercent(averages.taxaConversao), 'taxaConversao')}
                              {avgCell(formatNumber(averages.leads), 'leads')}
                              {avgCell(formatCurrency(averages.cpl), 'cpl')}
                              {avgCell(formatNumber(averages.mql), 'mql')}
                              {avgCell(formatCurrency(averages.cpmql), 'cpmql')}
                              {avgCell(formatPercent(averages.percMql), 'percMql')}
                              {avgCell('-', 'descartadoPerc')}
                              {expandedGroups.has('desc') && <>{avgCell('-', 'descartadoMqlPerc')}{avgCell('-', 'descartadoNmqlPerc')}</>}
                              {avgCell(formatPercent(averages.percRa), 'percRa')}
                              {expandedGroups.has('ra') && <>{avgCell(formatPercent(averages.percRaMql), 'percRaMql')}{avgCell(formatPercent(averages.percRaNmql), 'percRaNmql')}</>}
                              {avgCell(formatPercent(averages.percRr), 'percRr')}
                              {expandedGroups.has('rr') && <>{avgCell(formatPercent(averages.percRrMql), 'percRrMql')}{avgCell(formatPercent(averages.percRrNmql), 'percRrNmql')}</>}
                              {avgCell(formatPercent(averages.percRrVendas), 'percRrVendas')}
                              {expandedGroups.has('rrv') && <>{avgCell(formatPercent(averages.percRrMqlVendas), 'percRrMqlVendas')}{avgCell(formatPercent(averages.percRrNmqlVendas), 'percRrNmqlVendas')}</>}
                              {avgCell(formatNumber(averages.clientesUnicos), 'clientesUnicos')}
                              {avgCell(averages.leadTime !== null ? `${averages.leadTime}d` : '-', 'leadTime')}
                              {avgCell(formatCurrency(averages.aov), 'aov')}
                              {avgCell(formatCurrency(averages.receita), 'receita')}
                              {expandedGroups.has('receita') && <>{avgCell(formatCurrency(averages.receitaPontual), 'receitaPontual')}{avgCell(formatCurrency(averages.receitaRecorrente), 'receitaRecorrente')}</>}
                              {avgCell(formatCurrency(averages.cacGeral), 'cacGeral')}
                              {expandedGroups.has('cac') && <>{avgCell(formatCurrency(averages.cacUnico), 'cacUnico')}{avgCell(formatCurrency(averages.cacContrato), 'cacContrato')}</>}
                              {avgCell(averages.roas !== null ? `${averages.roas}x` : '-', 'roas')}
                            </>
                          );
                        })()}
                      </TableRow>
                    )}
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item) => (
                      <TableRow key={item.id} data-testid={`row-criativo-${item.id}`}>
                        <TableCell className="sticky left-0 z-10 bg-card">
                          {item.link && (
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground sticky left-[52px] z-10 bg-card" title={item.id}>
                          {item.id || '-'}
                        </TableCell>
                        <TableCell className="font-medium max-w-[250px] truncate sticky left-[220px] z-10 bg-card" title={item.adName}>
                          {item.adName}
                        </TableCell>
                        <TableCell className="sticky left-[470px] z-10 bg-card border-r border-zinc-700/50">
                          <Badge
                            variant={item.status === 'Ativo' ? 'default' : 'secondary'}
                            className={item.status === 'Ativo' ? 'bg-green-500' : ''}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        {(() => {
                          const c = compareMap.get(item.id);
                          return (
                            <>
                              {renderCell(item.investimento, c?.investimento ?? null, 'investimento', formatCurrency)}
                              {renderCell(item.cpm, c?.cpm ?? null, 'cpm', formatCurrency, getCellColor(item.cpm, 'cpm'), true)}
                              {renderCell(item.videoHook, c?.videoHook ?? null, 'videoHook', formatPercent, getCellColor(item.videoHook, 'videoHook'))}
                              {renderCell(item.videoHold, c?.videoHold ?? null, 'videoHold', formatPercent, getCellColor(item.videoHold, 'videoHold'))}
                              {renderCell(item.ctr, c?.ctr ?? null, 'ctr', formatPercent, getCellColor(item.ctr, 'ctr'))}
                              {renderCell(item.connectRate, c?.connectRate ?? null, 'connectRate', formatPercent, getCellColor(item.connectRate, 'connectRate'))}
                              {renderCell(item.taxaConversao, c?.taxaConversao ?? null, 'taxaConversao', formatPercent, getCellColor(item.taxaConversao, 'taxaConversao'))}
                              {renderCell(item.leads, c?.leads ?? null, 'leads', formatNumber)}
                              {renderCell(item.cpl, c?.cpl ?? null, 'cpl', formatCurrency, getCellColor(item.cpl, 'cpl'), true)}
                              {renderCell(item.mql, c?.mql ?? null, 'mql', formatNumber)}
                              {renderCell(item.cpmql, c?.cpmql ?? null, 'cpmql', formatCurrency, getCellColor(item.cpmql, 'cpmql'), true)}
                              {renderCell(item.percMql, c?.percMql ?? null, 'percMql', formatPercent, getCellColor(item.percMql, 'percMql'))}
                              {/* Desc. % (grupo) */}
                              {renderCell(item.descartadoPerc, c?.descartadoPerc ?? null, 'descartadoPerc', formatPercent)}
                              {expandedGroups.has('desc') && (
                                <>
                                  {renderCell(item.descartadoMqlPerc, c?.descartadoMqlPerc ?? null, 'descartadoMqlPerc', formatPercent)}
                                  {renderCell(item.descartadoNmqlPerc, c?.descartadoNmqlPerc ?? null, 'descartadoNmqlPerc', formatPercent)}
                                </>
                              )}
                              {/* RA % (grupo) */}
                              {renderCell(item.percRa, c?.percRa ?? null, 'percRa', formatPercent, getCellColor(item.percRa, 'percRa'))}
                              {expandedGroups.has('ra') && (
                                <>
                                  {renderCell(item.percRaMql, c?.percRaMql ?? null, 'percRaMql', formatPercent, getCellColor(item.percRaMql, 'percRaMql'))}
                                  {renderCell(item.percRaNmql, c?.percRaNmql ?? null, 'percRaNmql', formatPercent, getCellColor(item.percRaNmql, 'percRaNmql'))}
                                </>
                              )}
                              {/* RR % (grupo) */}
                              {renderCell(item.percRr, c?.percRr ?? null, 'percRr', formatPercent, getCellColor(item.percRr, 'percRr'))}
                              {expandedGroups.has('rr') && (
                                <>
                                  {renderCell(item.percRrMql, c?.percRrMql ?? null, 'percRrMql', formatPercent, getCellColor(item.percRrMql, 'percRrMql'))}
                                  {renderCell(item.percRrNmql, c?.percRrNmql ?? null, 'percRrNmql', formatPercent, getCellColor(item.percRrNmql, 'percRrNmql'))}
                                </>
                              )}
                              {/* RR→V % (grupo) */}
                              {renderCell(item.percRrVendas, c?.percRrVendas ?? null, 'percRrVendas', formatPercent, getCellColor(item.percRrVendas, 'percRrVendas'))}
                              {expandedGroups.has('rrv') && (
                                <>
                                  {renderCell(item.percRrMqlVendas, c?.percRrMqlVendas ?? null, 'percRrMqlVendas', formatPercent, getCellColor(item.percRrMqlVendas, 'percRrMqlVendas'))}
                                  {renderCell(item.percRrNmqlVendas, c?.percRrNmqlVendas ?? null, 'percRrNmqlVendas', formatPercent, getCellColor(item.percRrNmqlVendas, 'percRrNmqlVendas'))}
                                </>
                              )}
                              {renderCell(item.clientesUnicos, c?.clientesUnicos ?? null, 'clientesUnicos', formatNumber)}
                              {renderCell(item.leadTime, c?.leadTime ?? null, 'leadTime', (v) => v !== null ? `${v}d` : '-')}
                              {renderCell(item.aov, c?.aov ?? null, 'aov', formatCurrency)}
                              {/* Receita (grupo) */}
                              {renderCell(item.receita, c?.receita ?? null, 'receita', formatCurrency)}
                              {expandedGroups.has('receita') && (
                                <>
                                  {renderCell(item.receitaPontual || null, c?.receitaPontual || null, 'receitaPontual', formatCurrency)}
                                  {renderCell(item.receitaRecorrente || null, c?.receitaRecorrente || null, 'receitaRecorrente', formatCurrency)}
                                </>
                              )}
                              {/* CAC (grupo) */}
                              {renderCell(item.cacGeral, c?.cacGeral ?? null, 'cacGeral', formatCurrency, '', true)}
                              {expandedGroups.has('cac') && (
                                <>
                                  {renderCell(item.cacUnico, c?.cacUnico ?? null, 'cacUnico', formatCurrency, getCellColor(item.cacUnico, 'cacUnico'), true)}
                                  {renderCell(item.cacContrato, c?.cacContrato ?? null, 'cacContrato', formatCurrency, getCellColor(item.cacContrato, 'cacContrato'), true)}
                                </>
                              )}
                              {renderCell(item.roas, c?.roas ?? null, 'roas', (v) => v !== null ? `${v}x` : '-')}
                            </>
                          );
                        })()}
                      </TableRow>
                    ))}
                    {filteredData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={36} className="text-center py-8 text-muted-foreground">
                          Nenhum criativo encontrado para o período selecionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          <div className="px-4 py-2 border-t border-border">
            <Badge variant="outline">{filteredData.length} criativos</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
