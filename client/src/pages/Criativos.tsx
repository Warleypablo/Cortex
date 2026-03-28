import { useState, useMemo } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Search, X, ArrowUpDown, TrendingUp, TrendingDown, Rocket, ExternalLink, Loader2, Settings, Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { getMetricColor, getColorClasses, COLOR_TOKENS, AVAILABLE_METRICS, type MetricColor } from "@/lib/metricFormatting";
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
  receitaPontual: number;
  receitaRecorrente: number;
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
  const [plataformaFilter, setPlataformaFilter] = useState("Todos");
  const [produtoFilter, setProdutoFilter] = useState("");
  const [campanhaFilters, setCampanhaFilters] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'investimento', direction: 'desc' });

  const { toast } = useToast();
  const [configOpen, setConfigOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<string | null>(null);
  const [editThresholds, setEditThresholds] = useState<Array<{
    minValue: string;
    maxValue: string;
    color: MetricColor;
    label: string;
  }>>([]);

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

  // Campanhas filtradas por produto selecionado
  const campanhasFiltradas = useMemo(() => {
    if (!produtoFilter) return campanhas;
    return campanhas.filter(c => c.name.includes(`[${produtoFilter}]`));
  }, [campanhas, produtoFilter]);

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
    if (produtoFilter) return campanhasFiltradas.map(c => c.id);
    return [];
  }, [selectedCampaignIds, produtoFilter, campanhasFiltradas]);

  const { data: criativos = [], isLoading } = useQuery<CriativoData[]>({
    queryKey: ['/api/growth/criativos', startDate, endDate, statusFilter, plataformaFilter, selectedCampaignIds, produtoFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, status: statusFilter, plataforma: plataformaFilter });
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
    queryKey: ['/api/growth/criativos/compare', compareStartDate, compareEndDate, statusFilter, plataformaFilter, selectedCampaignIds, produtoFilter],
    queryFn: async () => {
      if (!compareStartDate || !compareEndDate) return [];
      const params = new URLSearchParams({ startDate: compareStartDate, endDate: compareEndDate, status: statusFilter, plataforma: plataformaFilter });
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

  // Colunas expandidas (para mostrar variação)
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
    queryKey: ['/api/growth/criativos/kpis', startDate, endDate, compareEnabled, compareRange?.from, compareRange?.to, statusFilter, selectedCampaignIds, produtoFilter],
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

  const saveRulesMutation = useMutation({
    mutationFn: async (data: { metricKey: string; displayLabel: string; thresholds: any[] }) => {
      return apiRequest('POST', `/api/metric-rules/${data.metricKey}/save`, {
        displayLabel: data.displayLabel,
        defaultColor: 'default',
        thresholds: data.thresholds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/metric-rules'] });
      toast({ title: 'Regras salvas com sucesso' });
      setEditingMetric(null);
    },
    onError: () => {
      toast({ title: 'Erro ao salvar regras', variant: 'destructive' });
    },
  });

  const handleEditMetric = (metricKey: string) => {
    const existing = metricRules.find(r => r.metricKey === metricKey);
    if (existing) {
      setEditThresholds(existing.thresholds.map(t => ({
        minValue: t.minValue?.toString() ?? '',
        maxValue: t.maxValue?.toString() ?? '',
        color: (t.color as MetricColor) || 'default',
        label: t.label || '',
      })));
    } else {
      setEditThresholds([]);
    }
    setEditingMetric(metricKey);
  };

  const handleAddThreshold = () => {
    setEditThresholds([...editThresholds, { minValue: '', maxValue: '', color: 'green', label: '' }]);
  };

  const handleRemoveThreshold = (index: number) => {
    setEditThresholds(editThresholds.filter((_, i) => i !== index));
  };

  const handleSaveMetric = () => {
    if (!editingMetric) return;
    const metricInfo = AVAILABLE_METRICS.find(m => m.key === editingMetric);
    saveRulesMutation.mutate({
      metricKey: editingMetric,
      displayLabel: metricInfo?.label || editingMetric,
      thresholds: editThresholds.map(t => ({
        minValue: t.minValue ? parseFloat(t.minValue) : null,
        maxValue: t.maxValue ? parseFloat(t.maxValue) : null,
        color: t.color,
        label: t.label || null,
      })),
    });
  };

  const getCellColor = (value: number | null, metricKey: string) => {
    const color = getMetricColor(value, metricRules, metricKey);
    return getColorClasses(color);
  };

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
      percRr: avg('percRr'),
      percRrMql: avg('percRrMql'),
      percRrNmql: avg('percRrNmql'),
      percRrVendas: avg('percRrVendas'),
      percRrMqlVendas: avg('percRrMqlVendas'),
      percRrNmqlVendas: avg('percRrNmqlVendas'),
      clientesUnicos: sum('clientesUnicos'),
      leadTime: avg('leadTime'),
      aov: avg('aov'),
      receitaPontual: avg('receitaPontual'),
      receitaRecorrente: avg('receitaRecorrente'),
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

  const kpis = kpisData?.current;
  const kpisCompare = kpisData?.compare;

  const investimentoVar = kpis && kpisCompare ? calcVariation(kpis.investimento, kpisCompare.investimento) : null;
  const percMqlVar = kpis && kpisCompare ? calcVariation(kpis.percMql, kpisCompare.percMql) : null;
  const cpmqlVar = kpis && kpisCompare ? calcVariation(kpis.cpmql, kpisCompare.cpmql, true) : null;
  const vendasVar = kpis && kpisCompare ? calcVariation(kpis.vendas, kpisCompare.vendas) : null;
  const cacVar = kpis && kpisCompare ? calcVariation(kpis.cac, kpisCompare.cac, true) : null;
  const aovVar = kpis && kpisCompare ? calcVariation(kpis.aov, kpisCompare.aov) : null;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Rocket className="w-6 h-6 text-purple-600" />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Ad name:</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar criativo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-[200px]"
                data-testid="input-search"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Ativo">Ativos</SelectItem>
                <SelectItem value="Pausado">Pausados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Plataforma:</span>
            <Select value={plataformaFilter} onValueChange={setPlataformaFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-plataforma">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todas Plataformas</SelectItem>
                <SelectItem value="Meta Ads">Meta Ads</SelectItem>
                <SelectItem value="Google Ads">Google Ads</SelectItem>
                <SelectItem value="LinkedIn Ads">LinkedIn Ads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Produto:</span>
            <Select value={produtoFilter || "todos"} onValueChange={(v) => {
              setProdutoFilter(v === "todos" ? "" : v);
              setCampanhaFilters([]); // Limpar campanhas ao mudar produto
            }}>
              <SelectTrigger className="w-[160px]" data-testid="select-produto">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Produtos</SelectItem>
                {produtos.map((prod) => (
                  <SelectItem key={prod} value={prod}>
                    {prod}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Campanha:</span>
            <MultiSelect
              options={campanhasFiltradas.map(c => c.name)}
              selected={campanhaFilters}
              onChange={setCampanhaFilters}
              placeholder="Todas Campanhas"
              searchPlaceholder="Buscar campanha..."
              className="h-9 w-[220px] text-xs"
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4">
        {/* Investimento */}
        <Card className="border bg-card">
          <CardContent className="pt-5 pb-4 px-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Investimento</span>
            <div className="text-2xl font-bold tracking-tight mt-2 mb-1">
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
          <CardContent className="pt-5 pb-4 px-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">% MQL</span>
            <div className="text-2xl font-bold tracking-tight mt-2 mb-1">
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
          <CardContent className="pt-5 pb-4 px-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPMQL</span>
            <div className="text-2xl font-bold tracking-tight mt-2 mb-1">
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
          <CardContent className="pt-5 pb-4 px-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Negócios Ganhos</span>
            <div className="text-2xl font-bold tracking-tight mt-2 mb-1">
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
          <CardContent className="pt-5 pb-4 px-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AOV</span>
            <div className="text-2xl font-bold tracking-tight mt-2 mb-1">
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
          <CardContent className="pt-5 pb-4 px-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CAC</span>
            <div className="text-2xl font-bold tracking-tight mt-2 mb-1">
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
              <CardTitle className="text-lg">Performance por Criativo</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{filteredData.length} criativos</Badge>
                <Sheet open={configOpen} onOpenChange={setConfigOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-config-metrics">
                      <Settings className="w-4 h-4 mr-1" />
                      Formatação
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Configurar Formatação de Métricas</SheetTitle>
                    </SheetHeader>

                    {editingMetric === null ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm text-muted-foreground mb-4">
                          Defina faixas de valores e cores para destacar métricas importantes.
                        </p>
                        {AVAILABLE_METRICS.map(metric => {
                          const existingRules = metricRules.find(r => r.metricKey === metric.key);
                          return (
                            <div
                              key={metric.key}
                              className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                              onClick={() => handleEditMetric(metric.key)}
                              data-testid={`button-edit-metric-${metric.key}`}
                            >
                              <div>
                                <span className="font-medium">{metric.label}</span>
                                {existingRules && existingRules.thresholds.length > 0 && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ({existingRules.thresholds.length} regras)
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {existingRules?.thresholds.map((t, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-3 h-3 rounded-full ${COLOR_TOKENS[t.color as MetricColor]?.bg || ''}`}
                                    style={{ backgroundColor: COLOR_TOKENS[t.color as MetricColor]?.bg ? undefined : '#888' }}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <Button variant="ghost" size="sm" onClick={() => setEditingMetric(null)}>
                            ← Voltar
                          </Button>
                          <span className="font-medium">
                            {AVAILABLE_METRICS.find(m => m.key === editingMetric)?.label}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          As regras são avaliadas na ordem. A primeira faixa que corresponder ao valor será usada.
                        </p>

                        <div className="space-y-3">
                          {editThresholds.map((threshold, idx) => (
                            <div key={idx} className="p-3 border rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">Regra {idx + 1}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveThreshold(idx)}
                                  data-testid={`button-remove-threshold-${idx}`}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Mínimo</Label>
                                  <Input
                                    type="number"
                                    placeholder="Sem limite"
                                    value={threshold.minValue}
                                    onChange={(e) => {
                                      const newThresholds = [...editThresholds];
                                      newThresholds[idx].minValue = e.target.value;
                                      setEditThresholds(newThresholds);
                                    }}
                                    data-testid={`input-min-${idx}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Máximo</Label>
                                  <Input
                                    type="number"
                                    placeholder="Sem limite"
                                    value={threshold.maxValue}
                                    onChange={(e) => {
                                      const newThresholds = [...editThresholds];
                                      newThresholds[idx].maxValue = e.target.value;
                                      setEditThresholds(newThresholds);
                                    }}
                                    data-testid={`input-max-${idx}`}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">Cor</Label>
                                <Select
                                  value={threshold.color}
                                  onValueChange={(value) => {
                                    const newThresholds = [...editThresholds];
                                    newThresholds[idx].color = value as MetricColor;
                                    setEditThresholds(newThresholds);
                                  }}
                                >
                                  <SelectTrigger data-testid={`select-color-${idx}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(COLOR_TOKENS).map(([key, val]) => (
                                      <SelectItem key={key} value={key}>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-3 h-3 rounded-full ${val.bg || 'bg-gray-400'}`} />
                                          {val.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleAddThreshold}
                          data-testid="button-add-threshold"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Adicionar Faixa
                        </Button>

                        <Button
                          className="w-full"
                          onClick={handleSaveMetric}
                          disabled={saveRulesMutation.isPending}
                          data-testid="button-save-metric-rules"
                        >
                          {saveRulesMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : null}
                          Salvar Regras
                        </Button>
                      </div>
                    )}
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="relative h-[calc(100vh-380px)] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 z-50 bg-zinc-900 dark:bg-zinc-900 shadow-md [&>th]:bg-zinc-900 dark:[&>th]:bg-zinc-900">
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
                      <TableHead className="whitespace-nowrap text-xs bg-zinc-900 text-zinc-100">Desc. %</TableHead>
                      <TableHead className="whitespace-nowrap text-xs bg-zinc-900 text-zinc-100">Desc. MQL %</TableHead>
                      <TableHead className="whitespace-nowrap text-xs bg-zinc-900 text-zinc-100">Desc. NMQL %</TableHead>
                      <SortableHeader column="percRa" label="RA %" />
                      <SortableHeader column="percRaMql" label="RA MQL %" />
                      <SortableHeader column="percRaNmql" label="RA NMQL %" />
                      <SortableHeader column="percRr" label="RR %" />
                      <SortableHeader column="percRrMql" label="RR MQL %" />
                      <SortableHeader column="percRrNmql" label="RR NMQL %" />
                      <SortableHeader column="percRrVendas" label="RR→V %" />
                      <SortableHeader column="percRrMqlVendas" label="RR MQL→V %" />
                      <SortableHeader column="percRrNmqlVendas" label="RR NMQL→V %" />
                      <SortableHeader column="clientesUnicos" label="Neg. ganho" />
                      <SortableHeader column="leadTime" label="Lead Time" />
                      <SortableHeader column="aov" label="AOV" />
                      <SortableHeader column="receitaPontual" label="Rec. pontual" />
                      <SortableHeader column="receitaRecorrente" label="Rec. recorrente" />
                      <SortableHeader column="cacUnico" label="CAC único" />
                      <SortableHeader column="cacContrato" label="CAC contrato" />
                      <SortableHeader column="roas" label="ROAS" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Linha de médias */}
                    {averages && (
                      <TableRow className="bg-zinc-800/50 dark:bg-zinc-800/50 border-b-2 border-zinc-700 font-semibold text-xs">
                        <TableCell className="sticky left-0 z-10 bg-zinc-800" />
                        <TableCell className="text-muted-foreground sticky left-[52px] z-10 bg-zinc-800">Média</TableCell>
                        <TableCell className="sticky left-[220px] z-10 bg-zinc-800" />
                        <TableCell className="sticky left-[470px] z-10 bg-zinc-800 border-r border-zinc-700" />
                        {(() => {
                          const avgCell = (val: string, col: string) => (
                            <>
                              <TableCell className="text-right">{val}</TableCell>
                              {isCompareActive && expandedColumns.has(col) && <TableCell className="bg-zinc-800/30" />}
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
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              {avgCell(formatPercent(averages.percRa), 'percRa')}
                              {avgCell(formatPercent(averages.percRaMql), 'percRaMql')}
                              {avgCell(formatPercent(averages.percRaNmql), 'percRaNmql')}
                              {avgCell(formatPercent(averages.percRr), 'percRr')}
                              {avgCell(formatPercent(averages.percRrMql), 'percRrMql')}
                              {avgCell(formatPercent(averages.percRrNmql), 'percRrNmql')}
                              {avgCell(formatPercent(averages.percRrVendas), 'percRrVendas')}
                              {avgCell(formatPercent(averages.percRrMqlVendas), 'percRrMqlVendas')}
                              {avgCell(formatPercent(averages.percRrNmqlVendas), 'percRrNmqlVendas')}
                              {avgCell(formatNumber(averages.clientesUnicos), 'clientesUnicos')}
                              {avgCell(averages.leadTime !== null ? `${averages.leadTime}d` : '-', 'leadTime')}
                              {avgCell(formatCurrency(averages.aov), 'aov')}
                              {avgCell(formatCurrency(averages.receitaPontual), 'receitaPontual')}
                              {avgCell(formatCurrency(averages.receitaRecorrente), 'receitaRecorrente')}
                              {avgCell(formatCurrency(averages.cacUnico), 'cacUnico')}
                              {avgCell(formatCurrency(averages.cacContrato), 'cacContrato')}
                              {avgCell(averages.roas !== null ? `${averages.roas}x` : '-', 'roas')}
                            </>
                          );
                        })()}
                      </TableRow>
                    )}
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
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              <TableCell className="text-right text-muted-foreground">-</TableCell>
                              {renderCell(item.percRa, c?.percRa ?? null, 'percRa', formatPercent, getCellColor(item.percRa, 'percRa'))}
                              {renderCell(item.percRaMql, c?.percRaMql ?? null, 'percRaMql', formatPercent, getCellColor(item.percRaMql, 'percRaMql'))}
                              {renderCell(item.percRaNmql, c?.percRaNmql ?? null, 'percRaNmql', formatPercent, getCellColor(item.percRaNmql, 'percRaNmql'))}
                              {renderCell(item.percRr, c?.percRr ?? null, 'percRr', formatPercent, getCellColor(item.percRr, 'percRr'))}
                              {renderCell(item.percRrMql, c?.percRrMql ?? null, 'percRrMql', formatPercent, getCellColor(item.percRrMql, 'percRrMql'))}
                              {renderCell(item.percRrNmql, c?.percRrNmql ?? null, 'percRrNmql', formatPercent, getCellColor(item.percRrNmql, 'percRrNmql'))}
                              {renderCell(item.percRrVendas, c?.percRrVendas ?? null, 'percRrVendas', formatPercent, getCellColor(item.percRrVendas, 'percRrVendas'))}
                              {renderCell(item.percRrMqlVendas, c?.percRrMqlVendas ?? null, 'percRrMqlVendas', formatPercent, getCellColor(item.percRrMqlVendas, 'percRrMqlVendas'))}
                              {renderCell(item.percRrNmqlVendas, c?.percRrNmqlVendas ?? null, 'percRrNmqlVendas', formatPercent, getCellColor(item.percRrNmqlVendas, 'percRrNmqlVendas'))}
                              {renderCell(item.clientesUnicos, c?.clientesUnicos ?? null, 'clientesUnicos', formatNumber)}
                              {renderCell(item.leadTime, c?.leadTime ?? null, 'leadTime', (v) => v !== null ? `${v}d` : '-')}
                              {renderCell(item.aov, c?.aov ?? null, 'aov', formatCurrency)}
                              {renderCell(item.receitaPontual || null, c?.receitaPontual || null, 'receitaPontual', formatCurrency)}
                              {renderCell(item.receitaRecorrente || null, c?.receitaRecorrente || null, 'receitaRecorrente', formatCurrency)}
                              {renderCell(item.cacUnico, c?.cacUnico ?? null, 'cacUnico', formatCurrency, getCellColor(item.cacUnico, 'cacUnico'), true)}
                              {renderCell(item.cacContrato, c?.cacContrato ?? null, 'cacContrato', formatCurrency, getCellColor(item.cacContrato, 'cacContrato'), true)}
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
        </Card>
      </div>
    </div>
  );
}
