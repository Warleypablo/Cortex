import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { CriativosSettingsSheet } from "@/components/criativos/CriativosSettingsSheet";
import { MultiSelect } from "@/components/ui/multi-select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CriativosTable } from "@/components/criativos/CriativosTable";
import { aggregateByLevel, sortRows, type CriativoData, type Level, type SortConfig } from "@/lib/criativosMetrics";
import { loadConfig, persistConfig, loadViews, persistViews, resolveColumns, type ColumnConfig, type SavedView } from "@/lib/criativosColumns";
import { Search, X, TrendingUp, TrendingDown, Loader2, Settings, Power, PowerOff, Sparkles, CheckCircle2, XCircle, AlertTriangle, Building2, Megaphone, Layers3, Image as ImageIcon } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { getMetricColor, getColorClasses, getBenchmarkColor, CRIATIVOS_BENCHMARK_MAP } from "@/lib/metricFormatting";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MetricRulesetWithThresholds } from "@shared/schema";
import type { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency as formatCurrencyUtil, formatDecimal as formatDecimalUtil, formatPercent as formatPercentUtil } from "@/lib/utils";

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

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

interface AgentProposal {
  id: number;
  actor_type: "human" | "agent";
  level: "ad" | "adset" | "campaign";
  entity_id: string;
  entity_name: string | null;
  action: "pause" | "resume" | "budget_update";
  payload_json: any;
  previous_value_json: any;
  reason: string;
  agent_rationale_text: string | null;
  status: "pending" | "executing" | "success" | "error" | "ignored";
  created_at: string;
}

const LEVEL_LABEL: Record<Level, string> = {
  conta: "conta",
  campanha: "campanhas",
  conjunto: "conjuntos",
  anuncio: "anúncios",
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

  // Nível de visualização (tabs): conta / campanha / conjunto / anúncio
  const [level, setLevel] = useState<Level>("anuncio");
  // Configuração de colunas (visibilidade, ordem, larguras) + visualizações salvas
  const [colConfig, setColConfig] = useState<ColumnConfig>(loadConfig);
  const [colViews, setColViews] = useState<SavedView[]>(loadViews);
  useEffect(() => { persistConfig(colConfig); }, [colConfig]);
  useEffect(() => { persistViews(colViews); }, [colViews]);
  const visibleColumns = useMemo(() => resolveColumns(colConfig), [colConfig]);
  const handleResize = useCallback((key: string, width: number) => {
    setColConfig((c) => ({ ...c, widths: { ...c.widths, [key]: width } }));
  }, []);
  // Seleção em massa + toggle de status (pausar/ativar)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [statusOverride, setStatusOverride] = useState<Map<string, string>>(new Map());
  const [bulkAction, setBulkAction] = useState<null | "pause" | "resume">(null);
  const [bulkPending, setBulkPending] = useState(false);

  const { toast } = useToast();
  const [configOpen, setConfigOpen] = useState(false);

  const startDate = format(dateRange.from, 'yyyy-MM-dd');
  const endDate = format(dateRange.to, 'yyyy-MM-dd');

  // ── Agente Gestor de Performance (admin only) ─────────────────────────
  const { data: authUser } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
  });
  const isAdmin = authUser?.role === "admin";

  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);

  const { data: pendingProposals = [], refetch: refetchProposals } = useQuery<AgentProposal[]>({
    queryKey: ["/api/meta/actions/pending"],
    queryFn: async () => {
      const res = await fetch("/api/meta/actions/pending", { credentials: "include" });
      if (!res.ok) return [];
      const j = await res.json();
      return j.proposals || [];
    },
    enabled: !!isAdmin,
    refetchInterval: agentDrawerOpen ? 15000 : false,
  });

  const pendingByEntity = useMemo(() => {
    const map = new Map<string, AgentProposal>();
    for (const p of pendingProposals) {
      if (p.status === "pending") map.set(p.entity_id, p);
    }
    return map;
  }, [pendingProposals]);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const body = {
        period: {
          startDate,
          endDate,
        },
        filters: campanhaFilters.length > 0 ? { campanhaIds: campanhaFilters } : undefined,
      };
      const res = await fetch("/api/criativos/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erro ao rodar agente");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      const n = Array.isArray(data?.proposalLogIds) ? data.proposalLogIds.length : 0;
      toast({
        title: "Análise concluída",
        description: n > 0 ? `${n} proposta(s) geradas pelo agente` : "Agente não gerou propostas",
      });
      setAgentDrawerOpen(true);
      refetchProposals();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao rodar agente", description: err.message, variant: "destructive" });
    },
  });

  const confirmProposalMutation = useMutation({
    mutationFn: async (proposal: AgentProposal) => {
      const endpoint =
        proposal.action === "pause"
          ? "/api/meta/actions/pause"
          : proposal.action === "resume"
            ? "/api/meta/actions/resume"
            : "/api/meta/actions/budget";
      const body: any = {
        level: proposal.level,
        entityId: proposal.entity_id,
        reason: proposal.agent_rationale_text?.slice(0, 500) || proposal.reason,
        fromLogId: proposal.id,
      };
      if (proposal.action === "budget_update") {
        body.newDailyBudgetCents = proposal.payload_json?.daily_budget_cents;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 409) throw new Error("Proposta já foi processada por outro admin");
        throw new Error(j.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_data, proposal) => {
      toast({ title: "Ação executada", description: `${proposal.action} aplicado em ${proposal.entity_id}` });
      refetchProposals();
      queryClient.invalidateQueries({ queryKey: ["/api/growth/criativos"] });
    },
    onError: (err: any) => {
      toast({ title: "Falha", description: err.message, variant: "destructive" });
      refetchProposals();
    },
  });

  const ignoreProposalMutation = useMutation({
    mutationFn: async (logId: number) => {
      const res = await fetch(`/api/meta/actions/${logId}/ignore`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Proposta ignorada" });
      refetchProposals();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao ignorar", description: err.message, variant: "destructive" });
    },
  });

  const formatCents = (cents: number | null | undefined): string => {
    if (cents == null) return "-";
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

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

  // Mapa de comparação agregado no mesmo nível da tab ativa
  const compareMap = useMemo(() => {
    const aggregated = aggregateByLevel(compareData, level);
    const map = new Map<string, CriativoData>();
    aggregated.forEach(item => map.set(item.id, item));
    return map;
  }, [compareData, level]);

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

  // Linhas de anúncio filtradas por busca (sem ordenação ainda)
  const searchedRows = useMemo(() => {
    if (!searchTerm) return criativos;
    const term = searchTerm.toLowerCase();
    return criativos.filter(item =>
      item.adName.toLowerCase().includes(term) ||
      item.id.toLowerCase().includes(term)
    );
  }, [criativos, searchTerm]);

  // Aplica override otimista de status (pause/resume reflete na hora;
  // o DB sincroniza com a Meta só a cada 6h)
  const applyOverride = useCallback((rows: CriativoData[]): CriativoData[] =>
    statusOverride.size === 0
      ? rows
      : rows.map(r => statusOverride.has(r.id) ? { ...r, status: statusOverride.get(r.id)! } : r),
  [statusOverride]);

  // Linhas do nível atual: agrega → ordena → aplica override
  const activeRows = useMemo(() =>
    applyOverride(sortRows(aggregateByLevel(searchedRows, level), sortConfig)),
  [searchedRows, level, sortConfig, applyOverride]);

  const handleSort = (key: keyof CriativoData) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Linha de totais (agregação de conta sobre as linhas filtradas) — somável,
  // os derivados são recalculados a partir das somas (não média de médias)
  const averages = useMemo(() => {
    if (searchedRows.length === 0) return null;
    return aggregateByLevel(searchedRows, "conta")[0] ?? null;
  }, [searchedRows]);

  // ── Handlers de seleção, toggle e ação em massa ──
  const apiLevelFor = (l: Level): "ad" | "adset" | "campaign" =>
    l === "campanha" ? "campaign" : l === "conjunto" ? "adset" : "ad";

  const handleLevelChange = (l: string) => {
    setLevel(l as Level);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleSelectAll = (checked: boolean, ids: string[]) => {
    setSelectedIds(checked ? new Set(ids) : new Set());
  };

  const handleToggleStatus = async (row: CriativoData) => {
    if (level === "conta") return;
    const apiLevel = apiLevelFor(level);
    const wasActive = row.status === "Ativo";
    const action = wasActive ? "pause" : "resume";
    setStatusOverride(prev => new Map(prev).set(row.id, wasActive ? "Pausado" : "Ativo"));
    setTogglingIds(prev => new Set(prev).add(row.id));
    try {
      const res = await fetch(`/api/meta/actions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ level: apiLevel, entityId: row.id, reason: "Ação manual via aba Criativos" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Erro ${res.status}`);
      }
      toast({ title: wasActive ? "Pausado" : "Ativado", description: row.adName });
    } catch (err: any) {
      setStatusOverride(prev => new Map(prev).set(row.id, wasActive ? "Ativo" : "Pausado"));
      toast({ title: "Falha ao alterar status", description: err.message, variant: "destructive" });
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(row.id); return s; });
    }
  };

  const runBulk = async () => {
    if (!bulkAction) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { setBulkAction(null); return; }
    const apiLevel = apiLevelFor(level);
    setBulkPending(true);
    try {
      const res = await fetch("/api/meta/actions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: bulkAction,
          reason: "Ação manual em massa via aba Criativos",
          items: ids.map(id => ({ level: apiLevel, entityId: id })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Erro ${res.status}`);
      const newStatus = bulkAction === "pause" ? "Pausado" : "Ativo";
      setStatusOverride(prev => {
        const m = new Map(prev);
        (j.results || []).filter((r: any) => r.ok).forEach((r: any) => m.set(r.entityId, newStatus));
        return m;
      });
      toast({ title: "Ação em massa concluída", description: `${j.okCount ?? 0}/${j.total ?? ids.length} aplicados` });
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: "Falha na ação em massa", description: err.message, variant: "destructive" });
    } finally {
      setBulkPending(false);
      setBulkAction(null);
    }
  };

  // Calcular variação percentual para KPI cards
  function calcVariation(current: number, compare: number | undefined, invertPositive = false) {
    if (compare === undefined || compare === null || compare === 0) return null;
    const pct = ((current - compare) / compare) * 100;
    const isPositive = invertPositive ? pct < 0 : pct > 0;
    return { pct, isPositive };
  }

  const isCompareActive = compareEnabled && compareData.length > 0;

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
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Clientes Ganhos</span>
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

      <div className="flex-1 p-4 pt-0 min-h-0">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2 space-y-2">
            {/* Tabs por nível (full width, estilo abas) */}
            <Tabs value={level} onValueChange={handleLevelChange} className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-auto gap-2 bg-transparent p-0">
                <TabsTrigger value="conta" className="h-10 gap-2 rounded-lg border border-border bg-muted/30 text-muted-foreground text-sm font-medium data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:border-b-2 data-[state=active]:shadow-sm" data-testid="tab-conta">
                  <Building2 className="w-4 h-4" /> Conta
                </TabsTrigger>
                <TabsTrigger value="campanha" className="h-10 gap-2 rounded-lg border border-border bg-muted/30 text-muted-foreground text-sm font-medium data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:border-b-2 data-[state=active]:shadow-sm" data-testid="tab-campanha">
                  <Megaphone className="w-4 h-4" /> Campanhas
                </TabsTrigger>
                <TabsTrigger value="conjunto" className="h-10 gap-2 rounded-lg border border-border bg-muted/30 text-muted-foreground text-sm font-medium data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:border-b-2 data-[state=active]:shadow-sm" data-testid="tab-conjunto">
                  <Layers3 className="w-4 h-4" /> Conjuntos
                </TabsTrigger>
                <TabsTrigger value="anuncio" className="h-10 gap-2 rounded-lg border border-border bg-muted/30 text-muted-foreground text-sm font-medium data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:border-b-2 data-[state=active]:shadow-sm" data-testid="tab-anuncio">
                  <ImageIcon className="w-4 h-4" /> Anúncios
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Linha de filtros + ações */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar criativo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[150px] h-8 text-xs"
                  data-testid="input-search"
                />
                {searchTerm && (
                  <Button variant="ghost" size="icon" className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-5 w-5" onClick={() => setSearchTerm("")}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
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
              </div>

              {/* Ações à direita */}
              <div className="flex items-center gap-2 flex-wrap">
                {isAdmin && level !== "conta" && selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 mr-1">
                    <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado(s)</span>
                    <Button size="sm" variant="outline" className="h-8" disabled={bulkPending} onClick={() => setBulkAction("resume")} data-testid="button-bulk-ativar">
                      <Power className="w-3.5 h-3.5 mr-1" /> Ativar
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-red-600 dark:text-red-400" disabled={bulkPending} onClick={() => setBulkAction("pause")} data-testid="button-bulk-pausar">
                      <PowerOff className="w-3.5 h-3.5 mr-1" /> Pausar
                    </Button>
                  </div>
                )}
                {isAdmin && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => analyzeMutation.mutate()}
                      disabled={analyzeMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 text-white h-8"
                      data-testid="button-analisar-ia"
                    >
                      {analyzeMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                      {analyzeMutation.isPending ? "Analisando..." : "Analisar com IA"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setAgentDrawerOpen(true)} data-testid="button-abrir-propostas">
                      Propostas
                      {pendingProposals.length > 0 && (
                        <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
                          {pendingProposals.length}
                        </Badge>
                      )}
                    </Button>
                  </>
                )}
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setConfigOpen(true)} data-testid="button-config-colunas" title="Configurar colunas e cores">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <CriativosTable
              level={level}
              rows={activeRows}
              compareMap={compareMap}
              averages={averages}
              isCompareActive={isCompareActive}
              isLoading={isLoading}
              sortConfig={sortConfig}
              onSort={handleSort}
              expandedColumns={expandedColumns}
              toggleColumn={toggleColumn}
              getCellColor={getCellColor}
              pendingByEntity={pendingByEntity}
              isAdmin={!!isAdmin}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onToggleStatus={handleToggleStatus}
              togglingIds={togglingIds}
              columns={visibleColumns}
              columnWidths={colConfig.widths}
              onResize={handleResize}
            />
          </CardContent>
          <div className="px-4 py-2 border-t border-border">
            <Badge variant="outline">{activeRows.length} {LEVEL_LABEL[level]}</Badge>
          </div>
        </Card>
      </div>

      {/* Configurações: colunas + cores */}
      <CriativosSettingsSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={colConfig}
        onChangeConfig={setColConfig}
        views={colViews}
        onChangeViews={setColViews}
        metricRules={metricRules}
        produtos={produtos}
        onSaveRule={(data) => saveRulesMutation.mutate(data)}
        isSavingRule={saveRulesMutation.isPending}
      />

      {/* Confirmação de ação em massa (pausar/ativar) */}
      <AlertDialog open={bulkAction !== null} onOpenChange={(o) => { if (!o) setBulkAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "pause" ? "Pausar" : "Ativar"} {selectedIds.size} {LEVEL_LABEL[level]}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação será aplicada diretamente na Meta Ads. Pode levar alguns segundos para concluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runBulk(); }} disabled={bulkPending}>
              {bulkPending ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Drawer: Propostas do Agente Gestor de Performance ───────────── */}
      <Sheet open={agentDrawerOpen} onOpenChange={setAgentDrawerOpen}>
        <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Propostas do Agente
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {pendingProposals.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                Nenhuma proposta pendente. Clique em <b>"Analisar com IA"</b> para gerar novas propostas.
              </div>
            )}

            {pendingProposals.map((p) => {
              const actionBadge =
                p.action === "pause"
                  ? { label: "Pausar", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" }
                  : p.action === "resume"
                    ? { label: "Reativar", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" }
                    : { label: "Ajustar budget", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" };

              const prevCents = p.previous_value_json?.daily_budget_cents ?? null;
              const newCents = p.payload_json?.daily_budget_cents ?? null;

              return (
                <Card
                  key={p.id}
                  className="border-gray-200 dark:border-zinc-700"
                  data-testid={`proposal-${p.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={actionBadge.cls}>{actionBadge.label}</Badge>
                          <span className="text-xs text-muted-foreground uppercase">
                            {p.level}
                          </span>
                        </div>
                        <div className="text-sm font-medium truncate" title={p.entity_name || p.entity_id}>
                          {p.entity_name || p.entity_id}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground truncate">
                          {p.entity_id}
                        </div>
                      </div>
                    </div>

                    {p.action === "budget_update" && (
                      <div className="text-sm bg-gray-50 dark:bg-zinc-800/60 rounded-md p-2 flex items-center justify-between">
                        <span className="text-muted-foreground">Daily budget</span>
                        <span className="font-medium">
                          {formatCents(prevCents)} → <span className="text-blue-600 dark:text-blue-400">{formatCents(newCents)}</span>
                        </span>
                      </div>
                    )}

                    {p.agent_rationale_text && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Ver justificativa
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-gray-700 dark:text-zinc-300">
                          {p.agent_rationale_text}
                        </p>
                      </details>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        disabled={confirmProposalMutation.isPending}
                        onClick={() => confirmProposalMutation.mutate(p)}
                        data-testid={`button-confirm-${p.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={ignoreProposalMutation.isPending}
                        onClick={() => ignoreProposalMutation.mutate(p.id)}
                        data-testid={`button-ignore-${p.id}`}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Ignorar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {pendingProposals.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800/50">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Cada proposta precisa da sua confirmação explícita antes de ser enviada à Meta Ads. Guard-rails do sistema: delta de budget máx ±30% e teto absoluto por env <code>META_ADS_MAX_DAILY_BUDGET_CENTS</code>.
                </span>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
