import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Target, DollarSign, Users, BarChart3, Megaphone, Loader2, Wallet, UserCheck, Receipt, Calendar, Phone, ShoppingCart, Pencil, Save, X, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/multi-select";
import { startOfMonth, endOfMonth, format, parse, differenceInCalendarDays, subDays } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line } from "recharts";

type MetricType = 'manual' | 'formula';

interface Metric {
  id: string;
  name: string;
  type: MetricType;
  orcado: number | string | null;
  realizado: number | string | null;
  percentual: number | null;
  format: 'currency' | 'number' | 'percent';
  isHeader?: boolean;
  indent?: number;
  emoji?: string;
}

interface MetricSection {
  title: string;
  icon: React.ReactNode;
  metrics: Metric[];
}

interface MQLMetrics {
  totalMqls: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  novosClientes: number;
  contratosAceleracao: number;
  contratosImplantacao: number;
  faturamentoAceleracao: number;
  faturamentoImplantacao: number;
  faturamentoAceleracaoTrafego: number;
  faturamentoImplantacaoTrafego: number;
  percReuniaoAgendada: number;
  percNoShow: number;
  taxaVendas: number;
  txContratosRecorrentes: number;
  txContratosImplantacao: number;
  ticketMedioAceleracao: number;
  ticketMedioImplantacao: number;
}

function formatValue(value: number | string | null, format: 'currency' | 'number' | 'percent'): string {
  if (value === null || value === '') return '-';
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    case 'percent':
      return `${(value * 100).toFixed(2)}%`;
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(value);
    default:
      return String(value);
  }
}

function getVarianceColor(percentual: number | null): string {
  if (percentual === null) return '';
  if (percentual >= 100) return 'text-green-500';
  if (percentual >= 80) return 'text-yellow-500';
  return 'text-red-500';
}

function calcPercentual(orcado: number | null, realizado: number | null): number | null {
  if (orcado === null || realizado === null || orcado === 0) return null;
  return (realizado / orcado) * 100;
}

// Valores orçados default (fallback quando não há dados no banco)
const DEFAULT_ORCADO_MQL = {
  percReuniaoAgendada: 0.30,
  reunioesAgendadas: 69,
  reunioesRealizadas: 65,
  percNoShow: 0.05,
  taxaVendas: 0.30,
  novosClientes: 19,
  txContratosRecorrentes: 0.60,
  txContratosImplantacao: 0.45,
  contratosAceleracao: 11,
  ticketMedioAceleracao: 4000,
  faturamentoAceleracao: 44641,
  contratosImplantacao: 8,
  ticketMedioImplantacao: 8500,
  faturamentoImplantacao: 71147,
};

const DEFAULT_ORCADO_NAO_MQL = {
  percReuniaoAgendada: 0.14,
  reunioesAgendadas: 152,
  reunioesRealizadas: 144,
  percNoShow: 0.05,
  taxaVendas: 0.25,
  novosClientes: 34,
  txContratosRecorrentes: 0.65,
  txContratosImplantacao: 0.45,
  contratosAceleracao: 22,
  ticketMedioAceleracao: 4000,
  faturamentoAceleracao: 89193.34,
  contratosImplantacao: 15,
  ticketMedioImplantacao: 8500,
  faturamentoImplantacao: 131217.12,
};

const DEFAULT_ORCADO_ADS = {
  investimento: 95500,
  impressoes: 955000,
  ctr: 0.009,
  cliques: 89843,
  cpm: 100,
  videoHook: 0,
  videoHold: 0,
  visualizacoesPagina: 0,
  taxaConversaoPagina: 0,
  connectRate: 0,
  leads: 0,
  mqls: 0,
  cpl: 0,
  cpmql: 0,
  percMqls: 0,
};

// Mapeamento de metric.id → segmento/chave no banco de budgets
const METRIC_BUDGET_MAP: Record<string, { segment: string; key: string }> = {
  // MQL
  mql_ra_perc: { segment: 'mql', key: 'percReuniaoAgendada' },
  mql_ra_num: { segment: 'mql', key: 'reunioesAgendadas' },
  mql_rr_num: { segment: 'mql', key: 'reunioesRealizadas' },
  mql_noshow: { segment: 'mql', key: 'percNoShow' },
  mql_taxa_vendas: { segment: 'mql', key: 'taxaVendas' },
  mql_novos_clientes: { segment: 'mql', key: 'novosClientes' },
  mql_tx_recorrente: { segment: 'mql', key: 'txContratosRecorrentes' },
  mql_tx_implantacao: { segment: 'mql', key: 'txContratosImplantacao' },
  mql_contratos_acel: { segment: 'mql', key: 'contratosAceleracao' },
  mql_ticket_acel: { segment: 'mql', key: 'ticketMedioAceleracao' },
  mql_fat_acel: { segment: 'mql', key: 'faturamentoAceleracao' },
  mql_contratos_impl: { segment: 'mql', key: 'contratosImplantacao' },
  mql_ticket_impl: { segment: 'mql', key: 'ticketMedioImplantacao' },
  mql_fat_impl: { segment: 'mql', key: 'faturamentoImplantacao' },
  // Não-MQL
  nmql_ra_perc: { segment: 'nao_mql', key: 'percReuniaoAgendada' },
  nmql_ra_num: { segment: 'nao_mql', key: 'reunioesAgendadas' },
  nmql_rr_num: { segment: 'nao_mql', key: 'reunioesRealizadas' },
  nmql_noshow: { segment: 'nao_mql', key: 'percNoShow' },
  nmql_taxa_vendas: { segment: 'nao_mql', key: 'taxaVendas' },
  nmql_novos_clientes: { segment: 'nao_mql', key: 'novosClientes' },
  nmql_tx_recorrente: { segment: 'nao_mql', key: 'txContratosRecorrentes' },
  nmql_tx_implantacao: { segment: 'nao_mql', key: 'txContratosImplantacao' },
  nmql_contratos_acel: { segment: 'nao_mql', key: 'contratosAceleracao' },
  nmql_ticket_acel: { segment: 'nao_mql', key: 'ticketMedioAceleracao' },
  nmql_fat_acel: { segment: 'nao_mql', key: 'faturamentoAceleracao' },
  nmql_contratos_impl: { segment: 'nao_mql', key: 'contratosImplantacao' },
  nmql_ticket_impl: { segment: 'nao_mql', key: 'ticketMedioImplantacao' },
  nmql_fat_impl: { segment: 'nao_mql', key: 'faturamentoImplantacao' },
  // Ads
  investimento: { segment: 'ads', key: 'investimento' },
  cpm: { segment: 'ads', key: 'cpm' },
  impressoes: { segment: 'ads', key: 'impressoes' },
  ctr: { segment: 'ads', key: 'ctr' },
  video_hook: { segment: 'ads', key: 'videoHook' },
  video_hold: { segment: 'ads', key: 'videoHold' },
  visualizacoes_pagina: { segment: 'ads', key: 'visualizacoesPagina' },
  taxa_conversao_pagina: { segment: 'ads', key: 'taxaConversaoPagina' },
  connect_rate: { segment: 'ads', key: 'connectRate' },
  leads: { segment: 'ads', key: 'leads' },
  mqls: { segment: 'ads', key: 'mqls' },
  cpl: { segment: 'ads', key: 'cpl' },
  cpmql: { segment: 'ads', key: 'cpmql' },
  perc_mqls: { segment: 'ads', key: 'percMqls' },
};

const PERCENT_METRICS = new Set([
  'mql_ra_perc', 'mql_noshow', 'mql_taxa_vendas', 'mql_tx_recorrente', 'mql_tx_implantacao',
  'nmql_ra_perc', 'nmql_noshow', 'nmql_taxa_vendas', 'nmql_tx_recorrente', 'nmql_tx_implantacao',
  'ctr', 'perc_mqls',
]);

export default function GrowthOrcadoRealizado() {
  usePageTitle("Orçado x Realizado");
  useSetPageInfo("Orçado x Realizado", "Controle de Métricas de Marketing e Vendas");
  
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const hoje = new Date();
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(hoje),
    to: endOfMonth(hoje),
  });
  const [cardFilter, setCardFilter] = useState<'todos' | 'mql' | 'nao-mql'>('todos');
  const [activeSection, setActiveSection] = useState<'consolidado' | 'marketing' | 'mql' | 'nao-mql'>('consolidado');
  const [revenueFilter, setRevenueFilter] = useState<'todos' | 'recorrente' | 'pontual'>('todos');
  const [contagemFilter, setContagemFilter] = useState<'contrato' | 'cliente'>('contrato');
  const [selectedFunis, setSelectedFunis] = useState<string[]>([]);
  const [selectedUtmSource, setSelectedUtmSource] = useState<string>('todos');
  const [selectedFunilMeta, setSelectedFunilMeta] = useState<string>('todos');
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [compareRange, setCompareRange] = useState<DateRange | undefined>(() => {
    // Default: período anterior
    const from = startOfMonth(hoje);
    const to = endOfMonth(hoje);
    const diff = differenceInCalendarDays(to, from);
    const prevEnd = subDays(from, 1);
    const prevStart = subDays(prevEnd, diff);
    return { from: prevStart, to: prevEnd };
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showCopyFrom, setShowCopyFrom] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const queryClient = useQueryClient();

  // Fetch dynamic months from API
  const { data: dynamicMonths } = useQuery<string[]>({
    queryKey: ['/api/growth/orcado-realizado/budgets/months'],
    queryFn: async () => {
      const res = await fetch('/api/growth/orcado-realizado/budgets/months', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const months = useMemo(() => {
    const monthNames: Record<string, string> = {
      '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
      '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
      '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
    };

    // Always include current month
    const allMonths = new Set<string>([currentMonth]);
    if (dynamicMonths) {
      dynamicMonths.forEach(m => allMonths.add(m));
    }

    return Array.from(allMonths)
      .sort((a, b) => b.localeCompare(a))
      .map(m => {
        const [year, month] = m.split('-');
        return { value: m, label: `${monthNames[month] || month} ${year}` };
      });
  }, [dynamicMonths, currentMonth]);

  const dateRange = useMemo(() => {
    if (customDateRange?.from && customDateRange?.to) {
      return {
        startDate: format(customDateRange.from, 'yyyy-MM-dd'),
        endDate: format(customDateRange.to, 'yyyy-MM-dd'),
      };
    }
    const monthDate = parse(selectedMonth, 'yyyy-MM', new Date());
    return {
      startDate: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(monthDate), 'yyyy-MM-dd'),
    };
  }, [customDateRange, selectedMonth]);

  const prevDateRange = useMemo(() => {
    if (!compareEnabled || !compareRange?.from || !compareRange?.to) {
      return null;
    }
    return {
      startDate: format(compareRange.from, 'yyyy-MM-dd'),
      endDate: format(compareRange.to, 'yyyy-MM-dd'),
    };
  }, [compareEnabled, compareRange]);

  // Fetch budgets from DB (falls back to defaults)
  const { data: budgetsData } = useQuery<Record<string, any>>({
    queryKey: ['/api/growth/orcado-realizado/budgets', dateRange.startDate, dateRange.endDate, selectedFunilMeta],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: format(customDateRange?.from || startOfMonth(parse(selectedMonth, 'yyyy-MM', new Date())), 'yyyy-MM'),
        endDate: format(customDateRange?.to || endOfMonth(parse(selectedMonth, 'yyyy-MM', new Date())), 'yyyy-MM'),
        funil: selectedFunilMeta,
      });
      const res = await fetch(`/api/growth/orcado-realizado/budgets?${params}`, { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const ORCADO_MQL = useMemo(() => ({ ...DEFAULT_ORCADO_MQL, ...(budgetsData?.mql || {}) }), [budgetsData]);
  const ORCADO_NAO_MQL = useMemo(() => ({ ...DEFAULT_ORCADO_NAO_MQL, ...(budgetsData?.nao_mql || {}) }), [budgetsData]);
  const ORCADO_ADS = useMemo(() => ({ ...DEFAULT_ORCADO_ADS, ...(budgetsData?.ads || {}) }), [budgetsData]);
  const ORCADO_TOTAL = useMemo(() => ({
    percRA: 0.2317,
    reunioesAgendadas: ORCADO_MQL.reunioesAgendadas + ORCADO_NAO_MQL.reunioesAgendadas,
    reunioesRealizadas: ORCADO_MQL.reunioesRealizadas + ORCADO_NAO_MQL.reunioesRealizadas,
    percNoShow: 0.05,
    percConversaoRRV: 0.28,
    novosClientes: ORCADO_MQL.novosClientes + ORCADO_NAO_MQL.novosClientes,
    contratosAceleracao: ORCADO_MQL.contratosAceleracao + ORCADO_NAO_MQL.contratosAceleracao,
    contratosImplantacao: ORCADO_MQL.contratosImplantacao + ORCADO_NAO_MQL.contratosImplantacao,
    faturamentoAceleracao: ORCADO_MQL.faturamentoAceleracao + ORCADO_NAO_MQL.faturamentoAceleracao,
    faturamentoImplantacao: ORCADO_MQL.faturamentoImplantacao + ORCADO_NAO_MQL.faturamentoImplantacao,
    faturamentoTotal: ORCADO_MQL.faturamentoAceleracao + ORCADO_NAO_MQL.faturamentoAceleracao + ORCADO_MQL.faturamentoImplantacao + ORCADO_NAO_MQL.faturamentoImplantacao,
    taxaConversaoFunil: 0.0561,
    taxaConversaoMQL: 0.0812,
    ticketMedioGeral: 4192.07,
    ticketMedioAceleracao: 4000,
    ticketMedioImplantacao: 8500,
  }), [ORCADO_MQL, ORCADO_NAO_MQL]);

  const startEditing = () => {
    const values: Record<string, number> = {};
    for (const [metricId, { segment, key }] of Object.entries(METRIC_BUDGET_MAP)) {
      const source = segment === 'mql' ? ORCADO_MQL : segment === 'nao_mql' ? ORCADO_NAO_MQL : ORCADO_ADS;
      const raw = (source as any)[key] ?? 0;
      values[metricId] = PERCENT_METRICS.has(metricId) ? raw * 100 : raw;
    }
    setEditValues(values);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditValues({});
  };

  const saveEdits = async () => {
    setIsSaving(true);
    try {
      const segments: Record<string, Record<string, number>> = {};
      for (const [metricId, value] of Object.entries(editValues)) {
        const mapping = METRIC_BUDGET_MAP[metricId];
        if (!mapping) continue;
        if (!segments[mapping.segment]) segments[mapping.segment] = {};
        segments[mapping.segment][mapping.key] = PERCENT_METRICS.has(metricId) ? value / 100 : value;
      }
      await Promise.all(
        Object.entries(segments).map(([segmento, metricas]) =>
          fetch('/api/growth/orcado-realizado/budgets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mes: selectedMonth, segmento, funil: selectedFunilMeta, metricas }),
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets'] });
      setIsEditing(false);
      setEditValues({});
    } catch (error) {
      console.error('Failed to save budgets:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const copyBudgets = async (mesOrigem: string) => {
    setIsCopying(true);
    try {
      const res = await fetch('/api/growth/orcado-realizado/budgets/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesOrigem, mesDestino: selectedMonth, funil: selectedFunilMeta }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('Copy failed:', err);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['/api/growth/orcado-realizado/budgets'] });
      setShowCopyFrom(false);
    } catch (error) {
      console.error('Failed to copy budgets:', error);
    } finally {
      setIsCopying(false);
    }
  };

  const renderOrcadoCell = (metric: Metric) => {
    if (isEditing && METRIC_BUDGET_MAP[metric.id]) {
      return (
        <div className="flex items-center justify-end gap-1">
          <input
            type="number"
            step={PERCENT_METRICS.has(metric.id) ? '0.01' : metric.format === 'currency' ? '0.01' : '1'}
            value={editValues[metric.id] ?? ''}
            onChange={(e) => setEditValues(prev => ({
              ...prev,
              [metric.id]: parseFloat(e.target.value) || 0,
            }))}
            className="w-28 px-2 py-1 text-right text-sm border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
          {PERCENT_METRICS.has(metric.id) && <span className="text-xs text-muted-foreground">%</span>}
        </div>
      );
    }
    return formatValue(metric.orcado, metric.format);
  };

  const { data: funis } = useQuery<string[]>({
    queryKey: ['/api/growth/orcado-realizado/funis'],
    queryFn: async () => {
      const res = await fetch('/api/growth/orcado-realizado/funis');
      if (!res.ok) throw new Error('Failed to fetch funis');
      return res.json();
    },
  });

  // Se todos os funis estão selecionados, tratar como "sem filtro" para não excluir campanhas sem tag
  const allFunisSelected = funis && selectedFunis.length > 0 && selectedFunis.length >= funis.length;
  const funilParam = (selectedFunis.length > 0 && !allFunisSelected) ? `&funilNgc=${selectedFunis.map(f => encodeURIComponent(f)).join(',')}` : '';
  const utmSourceParam = selectedUtmSource !== 'todos' ? `&utmSource=${encodeURIComponent(selectedUtmSource)}` : '';

  const { data: mqlData, isLoading: mqlLoading } = useQuery<MQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/mql', dateRange.startDate, dateRange.endDate, contagemFilter, selectedFunis, selectedUtmSource],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/mql?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&contagem=${contagemFilter}${funilParam}${utmSourceParam}`);
      if (!res.ok) throw new Error('Failed to fetch MQL metrics');
      return res.json();
    },
    staleTime: 0,
  });

  interface NaoMQLMetrics {
    totalNaoMqls: number;
    reunioesAgendadas: number;
    reunioesRealizadas: number;
    novosClientes: number;
    contratosAceleracao: number;
    contratosImplantacao: number;
    faturamentoAceleracao: number;
    faturamentoImplantacao: number;
    faturamentoAceleracaoTrafego: number;
    faturamentoImplantacaoTrafego: number;
    percReuniaoAgendada: number;
    percNoShow: number;
    taxaVendas: number;
    txContratosRecorrentes: number;
    txContratosImplantacao: number;
    ticketMedioAceleracao: number;
    ticketMedioImplantacao: number;
  }

  const { data: naoMqlData, isLoading: naoMqlLoading } = useQuery<NaoMQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/nao-mql', dateRange.startDate, dateRange.endDate, contagemFilter, selectedFunis, selectedUtmSource],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/nao-mql?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&contagem=${contagemFilter}${funilParam}${utmSourceParam}`);
      if (!res.ok) throw new Error('Failed to fetch Não-MQL metrics');
      return res.json();
    },
    staleTime: 0,
  });

  interface AdsMetrics {
    investimento: number;
    impressoes: number;
    cliques: number;
    cpm: number;
    ctr: number;
    videoHook: number;
    videoHold: number;
    connectRate: number;
    visualizacoesPagina: number;
    leads: number;
    mqls: number;
    cpl: number;
    cpmql: number;
    percMqls: number;
  }

  const { data: adsData, isLoading: adsLoading } = useQuery<AdsMetrics>({
    queryKey: ['/api/growth/orcado-realizado/ads', dateRange.startDate, dateRange.endDate, contagemFilter, selectedFunis, selectedUtmSource],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/ads?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&contagem=${contagemFilter}${funilParam}${utmSourceParam}`);
      if (!res.ok) throw new Error('Failed to fetch Ads metrics');
      return res.json();
    },
    staleTime: 0,
  });

  // Previous period queries for comparison (only when compare is enabled)
  const { data: prevMqlData } = useQuery<MQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/mql', prevDateRange?.startDate, prevDateRange?.endDate, contagemFilter, selectedFunis, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/mql?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}&contagem=${contagemFilter}${funilParam}${utmSourceParam}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange,
    staleTime: 0,
  });

  const { data: prevNaoMqlData } = useQuery<NaoMQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/nao-mql', prevDateRange?.startDate, prevDateRange?.endDate, contagemFilter, selectedFunis, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/nao-mql?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}&contagem=${contagemFilter}${funilParam}${utmSourceParam}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange,
    staleTime: 0,
  });

  const { data: prevAdsData } = useQuery<AdsMetrics>({
    queryKey: ['/api/growth/orcado-realizado/ads', prevDateRange?.startDate, prevDateRange?.endDate, contagemFilter, selectedFunis, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/ads?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}&contagem=${contagemFilter}${funilParam}${utmSourceParam}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange,
    staleTime: 0,
  });

  const mqlMetrics: Metric[] = useMemo(() => {
    const data = mqlData || {} as MQLMetrics;
    return [
      { 
        id: 'mql_ra_perc', 
        name: '% Reunião agendadas MQL', 
        type: 'manual', 
        orcado: ORCADO_MQL.percReuniaoAgendada, 
        realizado: data.percReuniaoAgendada ?? null, 
        percentual: calcPercentual(ORCADO_MQL.percReuniaoAgendada, data.percReuniaoAgendada), 
        format: 'percent' 
      },
      { 
        id: 'mql_ra_num', 
        name: 'Nº Reunião agendada MQL', 
        type: 'formula', 
        orcado: ORCADO_MQL.reunioesAgendadas, 
        realizado: data.reunioesAgendadas ?? 0, 
        percentual: calcPercentual(ORCADO_MQL.reunioesAgendadas, data.reunioesAgendadas), 
        format: 'number' 
      },
      { 
        id: 'mql_rr_num', 
        name: 'Nº Reunião realizada MQL', 
        type: 'formula', 
        orcado: ORCADO_MQL.reunioesRealizadas, 
        realizado: data.reunioesRealizadas ?? 0, 
        percentual: calcPercentual(ORCADO_MQL.reunioesRealizadas, data.reunioesRealizadas), 
        format: 'number' 
      },
      { 
        id: 'mql_noshow', 
        name: '% No-show', 
        type: 'manual', 
        orcado: ORCADO_MQL.percNoShow, 
        realizado: data.percNoShow ?? null, 
        percentual: calcPercentual(ORCADO_MQL.percNoShow, data.percNoShow), 
        format: 'percent' 
      },
      { 
        id: 'mql_taxa_vendas', 
        name: 'Taxa RR/Vendas MQL', 
        type: 'manual', 
        orcado: ORCADO_MQL.taxaVendas, 
        realizado: data.taxaVendas ?? null, 
        percentual: calcPercentual(ORCADO_MQL.taxaVendas, data.taxaVendas), 
        format: 'percent' 
      },
      { 
        id: 'mql_novos_clientes', 
        name: 'Novos Clientes MQL', 
        type: 'formula', 
        orcado: ORCADO_MQL.novosClientes, 
        realizado: data.novosClientes ?? 0, 
        percentual: calcPercentual(ORCADO_MQL.novosClientes, data.novosClientes), 
        format: 'number' 
      },
      { 
        id: 'mql_tx_recorrente', 
        name: 'Tx de Contratos Recorrentes', 
        type: 'manual', 
        orcado: ORCADO_MQL.txContratosRecorrentes, 
        realizado: data.txContratosRecorrentes ?? null, 
        percentual: calcPercentual(ORCADO_MQL.txContratosRecorrentes, data.txContratosRecorrentes), 
        format: 'percent' 
      },
      { 
        id: 'mql_tx_implantacao', 
        name: 'Tx de Contratos Implantação', 
        type: 'manual', 
        orcado: ORCADO_MQL.txContratosImplantacao, 
        realizado: data.txContratosImplantacao ?? null, 
        percentual: calcPercentual(ORCADO_MQL.txContratosImplantacao, data.txContratosImplantacao), 
        format: 'percent' 
      },
      { 
        id: 'mql_contratos_acel', 
        name: 'Nº Novos Contratos Aceleração MQL', 
        type: 'formula', 
        orcado: ORCADO_MQL.contratosAceleracao, 
        realizado: data.contratosAceleracao ?? 0, 
        percentual: calcPercentual(ORCADO_MQL.contratosAceleracao, data.contratosAceleracao), 
        format: 'number', 
        emoji: '🏎️' 
      },
      { 
        id: 'mql_ticket_acel', 
        name: 'Ticket Médio Aceleração MQL', 
        type: 'manual', 
        orcado: ORCADO_MQL.ticketMedioAceleracao, 
        realizado: data.ticketMedioAceleracao ?? null, 
        percentual: calcPercentual(ORCADO_MQL.ticketMedioAceleracao, data.ticketMedioAceleracao), 
        format: 'currency', 
        emoji: '🏎️' 
      },
      { 
        id: 'mql_fat_acel', 
        name: 'Faturamento Aceleração (MRR novo) de MQL', 
        type: 'formula', 
        orcado: ORCADO_MQL.faturamentoAceleracao, 
        realizado: data.faturamentoAceleracao ?? 0, 
        percentual: calcPercentual(ORCADO_MQL.faturamentoAceleracao, data.faturamentoAceleracao), 
        format: 'currency', 
        emoji: '🏎️' 
      },
      { 
        id: 'mql_contratos_impl', 
        name: 'Nº Novos Contratos Implantação MQL', 
        type: 'formula', 
        orcado: ORCADO_MQL.contratosImplantacao, 
        realizado: data.contratosImplantacao ?? 0, 
        percentual: calcPercentual(ORCADO_MQL.contratosImplantacao, data.contratosImplantacao), 
        format: 'number', 
        emoji: '🔧' 
      },
      { 
        id: 'mql_ticket_impl', 
        name: 'Ticket Médio Implantação MQL', 
        type: 'manual', 
        orcado: ORCADO_MQL.ticketMedioImplantacao, 
        realizado: data.ticketMedioImplantacao ?? null, 
        percentual: calcPercentual(ORCADO_MQL.ticketMedioImplantacao, data.ticketMedioImplantacao), 
        format: 'currency', 
        emoji: '🔧' 
      },
      { 
        id: 'mql_fat_impl', 
        name: 'Faturamento Implantação MQL', 
        type: 'formula', 
        orcado: ORCADO_MQL.faturamentoImplantacao, 
        realizado: data.faturamentoImplantacao ?? 0, 
        percentual: calcPercentual(ORCADO_MQL.faturamentoImplantacao, data.faturamentoImplantacao), 
        format: 'currency', 
        emoji: '🔧' 
      },
    ];
  }, [mqlData, ORCADO_MQL]);

  // Métricas de Marketing Ads (usando dados reais da API)
  const adsMetrics: Metric[] = useMemo(() => {
    const data = adsData || {} as AdsMetrics;
    return [
      { id: 'investimento', name: 'Investimento', type: 'manual', orcado: ORCADO_ADS.investimento, realizado: data.investimento ?? 0, percentual: calcPercentual(ORCADO_ADS.investimento, data.investimento), format: 'currency' },
      { id: 'cpm', name: 'CPM', type: 'formula', orcado: ORCADO_ADS.cpm, realizado: data.cpm ?? null, percentual: calcPercentual(ORCADO_ADS.cpm, data.cpm), format: 'currency' },
      { id: 'video_hook', name: 'Vídeo Hook', type: 'formula', orcado: ORCADO_ADS.videoHook, realizado: data.videoHook ?? null, percentual: calcPercentual(ORCADO_ADS.videoHook, data.videoHook), format: 'percent' },
      { id: 'video_hold', name: 'Vídeo Hold', type: 'formula', orcado: ORCADO_ADS.videoHold, realizado: data.videoHold ?? null, percentual: calcPercentual(ORCADO_ADS.videoHold, data.videoHold), format: 'percent' },
      { id: 'impressoes', name: 'Sessões', type: 'formula', orcado: ORCADO_ADS.impressoes, realizado: data.impressoes ?? 0, percentual: calcPercentual(ORCADO_ADS.impressoes, data.impressoes), format: 'number' },
      { id: 'ctr', name: 'CTR', type: 'manual', orcado: ORCADO_ADS.ctr, realizado: data.ctr ?? null, percentual: calcPercentual(ORCADO_ADS.ctr, data.ctr), format: 'percent' },
      { id: 'visualizacoes_pagina', name: 'Visualizações de Página', type: 'formula', orcado: ORCADO_ADS.visualizacoesPagina, realizado: data.visualizacoesPagina ?? 0, percentual: calcPercentual(ORCADO_ADS.visualizacoesPagina, data.visualizacoesPagina), format: 'number' },
      { id: 'taxa_conversao_pagina', name: 'Tx Conversão da Página', type: 'formula', orcado: ORCADO_ADS.taxaConversaoPagina, realizado: (data.visualizacoesPagina ?? 0) > 0 ? (data.leads ?? 0) / (data.visualizacoesPagina ?? 1) : 0, percentual: calcPercentual(ORCADO_ADS.taxaConversaoPagina, (data.visualizacoesPagina ?? 0) > 0 ? (data.leads ?? 0) / (data.visualizacoesPagina ?? 1) : 0), format: 'percent' },
      { id: 'connect_rate', name: 'Connect Rate', type: 'formula', orcado: ORCADO_ADS.connectRate, realizado: data.connectRate ?? 0, percentual: calcPercentual(ORCADO_ADS.connectRate, data.connectRate), format: 'percent' },
      { id: 'leads', name: 'Leads', type: 'formula', orcado: ORCADO_ADS.leads, realizado: data.leads ?? 0, percentual: calcPercentual(ORCADO_ADS.leads, data.leads), format: 'number' },
      { id: 'mqls', name: 'MQLs', type: 'formula', orcado: ORCADO_ADS.mqls, realizado: data.mqls ?? 0, percentual: calcPercentual(ORCADO_ADS.mqls, data.mqls), format: 'number' },
      { id: 'cpl', name: 'CPL', type: 'formula', orcado: ORCADO_ADS.cpl, realizado: data.cpl ?? null, percentual: calcPercentual(ORCADO_ADS.cpl, data.cpl), format: 'currency' },
      { id: 'cpmql', name: 'CPMQL', type: 'formula', orcado: ORCADO_ADS.cpmql, realizado: data.cpmql ?? null, percentual: calcPercentual(ORCADO_ADS.cpmql, data.cpmql), format: 'currency' },
      { id: 'perc_mqls', name: '% MQLs', type: 'formula', orcado: ORCADO_ADS.percMqls, realizado: data.percMqls ?? null, percentual: calcPercentual(ORCADO_ADS.percMqls, data.percMqls), format: 'percent' },
    ];
  }, [adsData, ORCADO_ADS]);

  const marketingSections: MetricSection[] = [
    {
      title: 'Métricas de Marketing: Ads',
      icon: <Megaphone className="w-5 h-5" />,
      metrics: adsMetrics,
    },
  ];

  const naoMqlMetrics: Metric[] = useMemo(() => {
    const data = naoMqlData || {} as NaoMQLMetrics;
    return [
      { 
        id: 'nmql_ra_perc', 
        name: '% Reunião agendadas não-MQL', 
        type: 'manual', 
        orcado: ORCADO_NAO_MQL.percReuniaoAgendada, 
        realizado: data.percReuniaoAgendada ?? null, 
        percentual: calcPercentual(ORCADO_NAO_MQL.percReuniaoAgendada, data.percReuniaoAgendada), 
        format: 'percent' 
      },
      { 
        id: 'nmql_ra_num', 
        name: 'Nº Reunião agendada não-MQL', 
        type: 'formula', 
        orcado: ORCADO_NAO_MQL.reunioesAgendadas, 
        realizado: data.reunioesAgendadas ?? 0, 
        percentual: calcPercentual(ORCADO_NAO_MQL.reunioesAgendadas, data.reunioesAgendadas), 
        format: 'number' 
      },
      { 
        id: 'nmql_rr_num', 
        name: 'Nº Reunião realizada não-MQL', 
        type: 'formula', 
        orcado: ORCADO_NAO_MQL.reunioesRealizadas, 
        realizado: data.reunioesRealizadas ?? 0, 
        percentual: calcPercentual(ORCADO_NAO_MQL.reunioesRealizadas, data.reunioesRealizadas), 
        format: 'number' 
      },
      { 
        id: 'nmql_noshow', 
        name: '% No-show', 
        type: 'manual', 
        orcado: ORCADO_NAO_MQL.percNoShow, 
        realizado: data.percNoShow ?? null, 
        percentual: calcPercentual(ORCADO_NAO_MQL.percNoShow, data.percNoShow), 
        format: 'percent' 
      },
      { 
        id: 'nmql_taxa_vendas', 
        name: 'Taxa RR/Vendas não MQL', 
        type: 'manual', 
        orcado: ORCADO_NAO_MQL.taxaVendas, 
        realizado: data.taxaVendas ?? null, 
        percentual: calcPercentual(ORCADO_NAO_MQL.taxaVendas, data.taxaVendas), 
        format: 'percent' 
      },
      { 
        id: 'nmql_novos_clientes', 
        name: 'Novos Clientes não MQL', 
        type: 'formula', 
        orcado: ORCADO_NAO_MQL.novosClientes, 
        realizado: data.novosClientes ?? 0, 
        percentual: calcPercentual(ORCADO_NAO_MQL.novosClientes, data.novosClientes), 
        format: 'number' 
      },
      { 
        id: 'nmql_tx_recorrente', 
        name: 'Tx de Contratos Recorrentes', 
        type: 'manual', 
        orcado: ORCADO_NAO_MQL.txContratosRecorrentes, 
        realizado: data.txContratosRecorrentes ?? null, 
        percentual: calcPercentual(ORCADO_NAO_MQL.txContratosRecorrentes, data.txContratosRecorrentes), 
        format: 'percent' 
      },
      { 
        id: 'nmql_tx_implantacao', 
        name: 'Tx de Contratos Implantação', 
        type: 'manual', 
        orcado: ORCADO_NAO_MQL.txContratosImplantacao, 
        realizado: data.txContratosImplantacao ?? null, 
        percentual: calcPercentual(ORCADO_NAO_MQL.txContratosImplantacao, data.txContratosImplantacao), 
        format: 'percent' 
      },
      { 
        id: 'nmql_contratos_acel', 
        name: 'Nº Novos Contratos Aceleração não-MQL', 
        type: 'formula', 
        orcado: ORCADO_NAO_MQL.contratosAceleracao, 
        realizado: data.contratosAceleracao ?? 0, 
        percentual: calcPercentual(ORCADO_NAO_MQL.contratosAceleracao, data.contratosAceleracao), 
        format: 'number', 
        emoji: '🏎️' 
      },
      { 
        id: 'nmql_ticket_acel', 
        name: 'Ticket Médio Aceleração não-MQL', 
        type: 'manual', 
        orcado: ORCADO_NAO_MQL.ticketMedioAceleracao, 
        realizado: data.ticketMedioAceleracao ?? null, 
        percentual: calcPercentual(ORCADO_NAO_MQL.ticketMedioAceleracao, data.ticketMedioAceleracao), 
        format: 'currency', 
        emoji: '🏎️' 
      },
      { 
        id: 'nmql_fat_acel', 
        name: 'Faturamento Aceleração (MRR novo) de não-MQL', 
        type: 'formula', 
        orcado: ORCADO_NAO_MQL.faturamentoAceleracao, 
        realizado: data.faturamentoAceleracao ?? 0, 
        percentual: calcPercentual(ORCADO_NAO_MQL.faturamentoAceleracao, data.faturamentoAceleracao), 
        format: 'currency', 
        emoji: '🏎️' 
      },
      { 
        id: 'nmql_contratos_impl', 
        name: 'Nº Novos Contratos Implantação não-MQL', 
        type: 'formula', 
        orcado: ORCADO_NAO_MQL.contratosImplantacao, 
        realizado: data.contratosImplantacao ?? 0, 
        percentual: calcPercentual(ORCADO_NAO_MQL.contratosImplantacao, data.contratosImplantacao), 
        format: 'number', 
        emoji: '🔧' 
      },
      { 
        id: 'nmql_ticket_impl', 
        name: 'Ticket Médio Implantação não-MQL', 
        type: 'manual', 
        orcado: ORCADO_NAO_MQL.ticketMedioImplantacao, 
        realizado: data.ticketMedioImplantacao ?? null, 
        percentual: calcPercentual(ORCADO_NAO_MQL.ticketMedioImplantacao, data.ticketMedioImplantacao), 
        format: 'currency', 
        emoji: '🔧' 
      },
      { 
        id: 'nmql_fat_impl', 
        name: 'Faturamento Implantação não-MQL', 
        type: 'formula', 
        orcado: ORCADO_NAO_MQL.faturamentoImplantacao, 
        realizado: data.faturamentoImplantacao ?? 0, 
        percentual: calcPercentual(ORCADO_NAO_MQL.faturamentoImplantacao, data.faturamentoImplantacao), 
        format: 'currency', 
        emoji: '🔧' 
      },
    ];
  }, [naoMqlData, ORCADO_NAO_MQL]);

  const totalMetrics: Metric[] = useMemo(() => {
    const mql = mqlData || {} as MQLMetrics;
    const naoMql = naoMqlData || {} as NaoMQLMetrics;
    const ads = adsData || {} as AdsMetrics;

    const totalReunioesAgendadas = (mql.reunioesAgendadas ?? 0) + (naoMql.reunioesAgendadas ?? 0);
    const totalReunioesRealizadas = (mql.reunioesRealizadas ?? 0) + (naoMql.reunioesRealizadas ?? 0);
    const totalNovosClientes = (mql.novosClientes ?? 0) + (naoMql.novosClientes ?? 0);
    const totalContratosAceleracao = (mql.contratosAceleracao ?? 0) + (naoMql.contratosAceleracao ?? 0);
    const totalContratosImplantacao = (mql.contratosImplantacao ?? 0) + (naoMql.contratosImplantacao ?? 0);
    const totalFatAceleracao = (mql.faturamentoAceleracao ?? 0) + (naoMql.faturamentoAceleracao ?? 0);
    const totalFatImplantacao = (mql.faturamentoImplantacao ?? 0) + (naoMql.faturamentoImplantacao ?? 0);
    const totalFaturamento = totalFatAceleracao + totalFatImplantacao;

    const totalMqls = mql.totalMqls ?? 0;
    const totalLeads = totalMqls + (naoMql.totalNaoMqls ?? 0);

    const percNoShowReal = totalReunioesAgendadas > 0
      ? (totalReunioesAgendadas - totalReunioesRealizadas) / totalReunioesAgendadas
      : null;
    const percConversaoRRV = totalReunioesRealizadas > 0
      ? totalNovosClientes / totalReunioesRealizadas
      : null;
    const taxaConversaoMQL = totalMqls > 0
      ? (mql.novosClientes ?? 0) / totalMqls
      : null;

    const ticketMedioGeral = totalNovosClientes > 0
      ? totalFaturamento / totalNovosClientes
      : null;
    const ticketMedioAceleracao = totalContratosAceleracao > 0
      ? totalFatAceleracao / totalContratosAceleracao
      : null;
    const ticketMedioImplantacao = totalContratosImplantacao > 0
      ? totalFatImplantacao / totalContratosImplantacao
      : null;

    const percRA = totalLeads > 0
      ? totalReunioesAgendadas / totalLeads
      : null;
    const taxaConversaoFunil = totalLeads > 0
      ? totalNovosClientes / totalLeads
      : null;

    const cacAdsOrcado = ORCADO_TOTAL.novosClientes > 0 ? ORCADO_ADS.investimento / ORCADO_TOTAL.novosClientes : 0;
    const cacAdsReal = totalNovosClientes > 0
      ? (ads.investimento ?? 0) / totalNovosClientes
      : null;

    return [
      { id: 'total_perc_ra', name: '% RA', type: 'formula', orcado: ORCADO_TOTAL.percRA, realizado: percRA, percentual: calcPercentual(ORCADO_TOTAL.percRA, percRA), format: 'percent' },
      { id: 'total_ra', name: 'Reuniões Agendadas', type: 'formula', orcado: ORCADO_TOTAL.reunioesAgendadas, realizado: totalReunioesAgendadas, percentual: calcPercentual(ORCADO_TOTAL.reunioesAgendadas, totalReunioesAgendadas), format: 'number' },
      { id: 'total_rr', name: 'Reuniões Realizadas', type: 'formula', orcado: ORCADO_TOTAL.reunioesRealizadas, realizado: totalReunioesRealizadas, percentual: calcPercentual(ORCADO_TOTAL.reunioesRealizadas, totalReunioesRealizadas), format: 'number' },
      { id: 'total_noshow', name: 'No show', type: 'formula', orcado: ORCADO_TOTAL.percNoShow, realizado: percNoShowReal, percentual: calcPercentual(ORCADO_TOTAL.percNoShow, percNoShowReal), format: 'percent' },
      { id: 'total_conv_rrv', name: 'Conversão de RR/V (%)', type: 'formula', orcado: ORCADO_TOTAL.percConversaoRRV, realizado: percConversaoRRV, percentual: calcPercentual(ORCADO_TOTAL.percConversaoRRV, percConversaoRRV), format: 'percent' },
      { id: 'total_novos_clientes', name: 'Novos Clientes', type: 'formula', orcado: ORCADO_TOTAL.novosClientes, realizado: totalNovosClientes, percentual: calcPercentual(ORCADO_TOTAL.novosClientes, totalNovosClientes), format: 'number' },
      { id: 'total_ganhos_acel', name: 'Negócios Ganhos Aceleração', type: 'formula', orcado: ORCADO_TOTAL.contratosAceleracao, realizado: totalContratosAceleracao, percentual: calcPercentual(ORCADO_TOTAL.contratosAceleracao, totalContratosAceleracao), format: 'number', emoji: '🏎️' },
      { id: 'total_ganhos_impl', name: 'Negócios Ganhos Implantação', type: 'formula', orcado: ORCADO_TOTAL.contratosImplantacao, realizado: totalContratosImplantacao, percentual: calcPercentual(ORCADO_TOTAL.contratosImplantacao, totalContratosImplantacao), format: 'number', emoji: '🔧' },
      { id: 'total_faturamento', name: 'Faturamento Total', type: 'formula', orcado: ORCADO_TOTAL.faturamentoTotal, realizado: totalFaturamento, percentual: calcPercentual(ORCADO_TOTAL.faturamentoTotal, totalFaturamento), format: 'currency' },
      { id: 'total_fat_acel', name: 'Faturamento A', type: 'formula', orcado: ORCADO_TOTAL.faturamentoAceleracao, realizado: totalFatAceleracao, percentual: calcPercentual(ORCADO_TOTAL.faturamentoAceleracao, totalFatAceleracao), format: 'currency', emoji: '🏎️' },
      { id: 'total_fat_impl', name: 'Faturamento I', type: 'formula', orcado: ORCADO_TOTAL.faturamentoImplantacao, realizado: totalFatImplantacao, percentual: calcPercentual(ORCADO_TOTAL.faturamentoImplantacao, totalFatImplantacao), format: 'currency', emoji: '🔧' },
      { id: 'total_conv_funil', name: 'Taxa de Conversão do Funil inteiro', type: 'formula', orcado: ORCADO_TOTAL.taxaConversaoFunil, realizado: taxaConversaoFunil, percentual: calcPercentual(ORCADO_TOTAL.taxaConversaoFunil, taxaConversaoFunil), format: 'percent' },
      { id: 'total_conv_mql', name: 'Tx de conversão MQL', type: 'formula', orcado: ORCADO_TOTAL.taxaConversaoMQL, realizado: taxaConversaoMQL, percentual: calcPercentual(ORCADO_TOTAL.taxaConversaoMQL, taxaConversaoMQL), format: 'percent' },
      { id: 'total_cac_ads', name: 'CAC ADS', type: 'formula', orcado: cacAdsOrcado, realizado: cacAdsReal, percentual: calcPercentual(cacAdsOrcado, cacAdsReal), format: 'currency' },
      { id: 'total_ticket_geral', name: 'Ticket Médio Geral', type: 'formula', orcado: ORCADO_TOTAL.ticketMedioGeral, realizado: ticketMedioGeral, percentual: calcPercentual(ORCADO_TOTAL.ticketMedioGeral, ticketMedioGeral), format: 'currency' },
      { id: 'total_ticket_acel', name: 'Ticket Médio Aceleração', type: 'formula', orcado: ORCADO_TOTAL.ticketMedioAceleracao, realizado: ticketMedioAceleracao, percentual: calcPercentual(ORCADO_TOTAL.ticketMedioAceleracao, ticketMedioAceleracao), format: 'currency' },
      { id: 'total_ticket_impl', name: 'Ticket Médio Implantação', type: 'formula', orcado: ORCADO_TOTAL.ticketMedioImplantacao, realizado: ticketMedioImplantacao, percentual: calcPercentual(ORCADO_TOTAL.ticketMedioImplantacao, ticketMedioImplantacao), format: 'currency' },
    ];
  }, [mqlData, naoMqlData, adsData, ORCADO_MQL, ORCADO_NAO_MQL, ORCADO_ADS, ORCADO_TOTAL]);
  
  const totalSection: MetricSection = {
    title: 'Total',
    icon: <BarChart3 className="w-5 h-5" />,
    metrics: totalMetrics,
  };

  const allSections: MetricSection[] = [
    ...marketingSections,
    {
      title: 'Métricas de Vendas: MQL',
      icon: <Users className="w-5 h-5" />,
      metrics: mqlMetrics,
    },
    {
      title: 'Métricas de Vendas: Não-MQL',
      icon: <Users className="w-5 h-5" />,
      metrics: naoMqlMetrics,
    },
    totalSection,
  ];

  // Seções filtradas pelo cardFilter (Origem: MQL / Não-MQL / Todos)
  const filteredSections: MetricSection[] = useMemo(() => {
    if (cardFilter === 'mql') {
      return [
        ...marketingSections,
        { title: 'Métricas de Vendas: MQL', icon: <Users className="w-5 h-5" />, metrics: mqlMetrics },
      ];
    }
    if (cardFilter === 'nao-mql') {
      return [
        ...marketingSections,
        { title: 'Métricas de Vendas: Não-MQL', icon: <Users className="w-5 h-5" />, metrics: naoMqlMetrics },
      ];
    }
    return allSections;
  }, [cardFilter, marketingSections, mqlMetrics, naoMqlMetrics, allSections]);

  // Métricas amarelas para a aba Consolidado (filtradas por seção)
  const YELLOW_METRIC_IDS = new Set([
    'leads', 'mqls', 'cpl', 'cpmql', 'perc_mqls',
    'mql_noshow', 'mql_ticket_acel', 'mql_ticket_impl',
    'nmql_noshow', 'nmql_ticket_acel', 'nmql_ticket_impl',
    'total_cac_ads', 'total_ticket_acel', 'total_ticket_impl',
  ]);

  const consolidadoSections: MetricSection[] = filteredSections
    .map(section => ({
      ...section,
      metrics: section.metrics.filter(m => YELLOW_METRIC_IDS.has(m.id))
    }))
    .filter(section => section.metrics.length > 0);

  // Helper para calcular progresso seguro (0-100)
  // Calcular métricas dos cards de resumo (reativas ao filtro)
  const investimentoRealizado = adsData?.investimento ?? 0;
  const investimentoOrcado = ORCADO_ADS.investimento;
  const investimentoPerc = investimentoOrcado > 0 ? (investimentoRealizado / investimentoOrcado) * 100 : 0;

  // Leads do card = leads de tráfego pago (Ads endpoint)
  const mqlsRealizado = adsData?.leads ?? 0;
  const mqlsOrcado = ORCADO_ADS.leads;
  const mqlsPerc = mqlsOrcado > 0 ? (mqlsRealizado / mqlsOrcado) * 100 : 0;
  const mqlsLabel = 'Leads Totais';

  // Helper para somar valores de MQL e/ou Não-MQL conforme cardFilter
  const sumByCardFilter = (mqlVal: number, naoMqlVal: number) => {
    if (cardFilter === 'mql') return mqlVal;
    if (cardFilter === 'nao-mql') return naoMqlVal;
    return mqlVal + naoMqlVal;
  };

  // Helper para calcular variação vs período anterior
  const calcVariation = (current: number, previous: number | undefined): { pct: number; isPositive: boolean } | null => {
    if (previous === undefined || previous === null || previous === 0) return null;
    const pct = ((current - previous) / previous) * 100;
    return { pct, isPositive: pct >= 0 };
  };

  // Helper para obter valor do período anterior por metric ID
  const getPrevValue = (metricId: string): number | null => {
    const prevMql = prevMqlData || {} as MQLMetrics;
    const prevNaoMql = prevNaoMqlData || {} as NaoMQLMetrics;
    const prevAds_ = prevAdsData || {} as AdsMetrics;

    const map: Record<string, number | undefined> = {
      // MQL
      mql_ra_perc: prevMql.percReuniaoAgendada,
      mql_ra_num: prevMql.reunioesAgendadas,
      mql_rr_num: prevMql.reunioesRealizadas,
      mql_noshow: prevMql.percNoShow,
      mql_taxa_vendas: prevMql.taxaVendas,
      mql_novos_clientes: prevMql.novosClientes,
      mql_tx_recorrente: prevMql.txContratosRecorrentes,
      mql_tx_implantacao: prevMql.txContratosImplantacao,
      mql_contratos_acel: prevMql.contratosAceleracao,
      mql_ticket_acel: prevMql.ticketMedioAceleracao,
      mql_fat_acel: prevMql.faturamentoAceleracao,
      mql_contratos_impl: prevMql.contratosImplantacao,
      mql_ticket_impl: prevMql.ticketMedioImplantacao,
      mql_fat_impl: prevMql.faturamentoImplantacao,
      // Não-MQL
      nmql_ra_perc: prevNaoMql.percReuniaoAgendada,
      nmql_ra_num: prevNaoMql.reunioesAgendadas,
      nmql_rr_num: prevNaoMql.reunioesRealizadas,
      nmql_noshow: prevNaoMql.percNoShow,
      nmql_taxa_vendas: prevNaoMql.taxaVendas,
      nmql_novos_clientes: prevNaoMql.novosClientes,
      nmql_tx_recorrente: prevNaoMql.txContratosRecorrentes,
      nmql_tx_implantacao: prevNaoMql.txContratosImplantacao,
      nmql_contratos_acel: prevNaoMql.contratosAceleracao,
      nmql_ticket_acel: prevNaoMql.ticketMedioAceleracao,
      nmql_fat_acel: prevNaoMql.faturamentoAceleracao,
      nmql_contratos_impl: prevNaoMql.contratosImplantacao,
      nmql_ticket_impl: prevNaoMql.ticketMedioImplantacao,
      nmql_fat_impl: prevNaoMql.faturamentoImplantacao,
      // Ads
      investimento: prevAds_.investimento,
      cpm: prevAds_.cpm,
      impressoes: prevAds_.impressoes,
      ctr: prevAds_.ctr,
      video_hook: prevAds_.videoHook,
      video_hold: prevAds_.videoHold,
      visualizacoes_pagina: prevAds_.visualizacoesPagina,
      connect_rate: prevAds_.connectRate,
      leads: prevAds_.leads,
      mqls: prevAds_.mqls,
      cpl: prevAds_.cpl,
      cpmql: prevAds_.cpmql,
      perc_mqls: prevAds_.percMqls,
    };
    const val = map[metricId];
    return val !== undefined ? val : null;
  };

  // Clientes: reage a cardFilter + revenueFilter
  const clientesRealizado = revenueFilter === 'recorrente'
    ? sumByCardFilter(mqlData?.contratosAceleracao ?? 0, naoMqlData?.contratosAceleracao ?? 0)
    : revenueFilter === 'pontual'
    ? sumByCardFilter(mqlData?.contratosImplantacao ?? 0, naoMqlData?.contratosImplantacao ?? 0)
    : sumByCardFilter(mqlData?.novosClientes ?? 0, naoMqlData?.novosClientes ?? 0);
  const clientesOrcado = revenueFilter === 'recorrente'
    ? sumByCardFilter(ORCADO_MQL.contratosAceleracao, ORCADO_NAO_MQL.contratosAceleracao)
    : revenueFilter === 'pontual'
    ? sumByCardFilter(ORCADO_MQL.contratosImplantacao, ORCADO_NAO_MQL.contratosImplantacao)
    : sumByCardFilter(ORCADO_MQL.novosClientes, ORCADO_NAO_MQL.novosClientes);
  const clientesPerc = clientesOrcado > 0 ? (clientesRealizado / clientesOrcado) * 100 : 0;
  const clientesLabel = contagemFilter === 'cliente'
    ? (revenueFilter === 'recorrente' ? 'Clientes Recorrentes'
      : revenueFilter === 'pontual' ? 'Clientes Implantação'
      : 'Novos Clientes')
    : (revenueFilter === 'recorrente' ? 'Contratos Recorrentes'
      : revenueFilter === 'pontual' ? 'Contratos Implantação'
      : 'Novos Contratos');

  // Faturamento: usa apenas dados de tráfego (utm_source = facebook/google), reage a cardFilter + revenueFilter
  const faturamentoRealizado = revenueFilter === 'recorrente'
    ? sumByCardFilter(mqlData?.faturamentoAceleracaoTrafego ?? 0, naoMqlData?.faturamentoAceleracaoTrafego ?? 0)
    : revenueFilter === 'pontual'
    ? sumByCardFilter(mqlData?.faturamentoImplantacaoTrafego ?? 0, naoMqlData?.faturamentoImplantacaoTrafego ?? 0)
    : sumByCardFilter(
        (mqlData?.faturamentoAceleracaoTrafego ?? 0) + (mqlData?.faturamentoImplantacaoTrafego ?? 0),
        (naoMqlData?.faturamentoAceleracaoTrafego ?? 0) + (naoMqlData?.faturamentoImplantacaoTrafego ?? 0)
      );
  const faturamentoOrcado = revenueFilter === 'recorrente'
    ? sumByCardFilter(ORCADO_MQL.faturamentoAceleracao, ORCADO_NAO_MQL.faturamentoAceleracao)
    : revenueFilter === 'pontual'
    ? sumByCardFilter(ORCADO_MQL.faturamentoImplantacao, ORCADO_NAO_MQL.faturamentoImplantacao)
    : sumByCardFilter(
        ORCADO_MQL.faturamentoAceleracao + ORCADO_MQL.faturamentoImplantacao,
        ORCADO_NAO_MQL.faturamentoAceleracao + ORCADO_NAO_MQL.faturamentoImplantacao
      );
  const faturamentoPerc = faturamentoOrcado > 0 ? (faturamentoRealizado / faturamentoOrcado) * 100 : 0;
  const faturamentoLabel = revenueFilter === 'recorrente' ? 'Faturamento Recorrente'
    : revenueFilter === 'pontual' ? 'Faturamento Implantação'
    : 'Faturamento';

  // Breakdown recorrente vs pontual (para exibir no card quando filtro = todos)
  const fatRecorrenteRealizado = sumByCardFilter(mqlData?.faturamentoAceleracaoTrafego ?? 0, naoMqlData?.faturamentoAceleracaoTrafego ?? 0);
  const fatPontualRealizado = sumByCardFilter(mqlData?.faturamentoImplantacaoTrafego ?? 0, naoMqlData?.faturamentoImplantacaoTrafego ?? 0);

  // Previous period values for hero cards
  const prevInvestimento = prevAdsData?.investimento ?? 0;
  const prevLeads = prevAdsData?.leads ?? 0;
  const prevClientes = revenueFilter === 'recorrente'
    ? sumByCardFilter(prevMqlData?.contratosAceleracao ?? 0, prevNaoMqlData?.contratosAceleracao ?? 0)
    : revenueFilter === 'pontual'
    ? sumByCardFilter(prevMqlData?.contratosImplantacao ?? 0, prevNaoMqlData?.contratosImplantacao ?? 0)
    : sumByCardFilter(prevMqlData?.novosClientes ?? 0, prevNaoMqlData?.novosClientes ?? 0);
  const prevFaturamento = revenueFilter === 'recorrente'
    ? sumByCardFilter(prevMqlData?.faturamentoAceleracaoTrafego ?? 0, prevNaoMqlData?.faturamentoAceleracaoTrafego ?? 0)
    : revenueFilter === 'pontual'
    ? sumByCardFilter(prevMqlData?.faturamentoImplantacaoTrafego ?? 0, prevNaoMqlData?.faturamentoImplantacaoTrafego ?? 0)
    : sumByCardFilter(
        (prevMqlData?.faturamentoAceleracaoTrafego ?? 0) + (prevMqlData?.faturamentoImplantacaoTrafego ?? 0),
        (prevNaoMqlData?.faturamentoAceleracaoTrafego ?? 0) + (prevNaoMqlData?.faturamentoImplantacaoTrafego ?? 0)
      );

  const investimentoVar = calcVariation(investimentoRealizado, prevInvestimento);
  const leadsVar = calcVariation(mqlsRealizado, prevLeads);
  const clientesVar = calcVariation(clientesRealizado, prevClientes);
  const faturamentoVar = calcVariation(faturamentoRealizado, prevFaturamento);

  return (
    <div className="p-6 space-y-6" data-testid="growth-orcado-realizado-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Orçado x Realizado</h1>
            <p className="text-muted-foreground text-sm">Acompanhamento de metas de marketing e vendas</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={saveEdits}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
              <button
                onClick={cancelEditing}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </>
          ) : (
            <>
              <Select value={selectedFunilMeta} onValueChange={setSelectedFunilMeta}>
                <SelectTrigger className="w-52 h-9 text-sm">
                  <SelectValue placeholder="Meta: Todos os funis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os funis</SelectItem>
                  {funis?.filter(f => f !== '(Vazio)').map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={startEditing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Editar Metas
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowCopyFrom(!showCopyFrom)}
                  disabled={isCopying}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  {isCopying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  Copiar Metas
                </button>
                {showCopyFrom && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-2 min-w-[200px]">
                    <p className="text-xs text-muted-foreground px-2 pb-2">Copiar metas de:</p>
                    {months.filter(m => m.value !== selectedMonth).map((month) => (
                      <button
                        key={month.value}
                        onClick={() => copyBudgets(month.value)}
                        disabled={isCopying}
                        className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        {month.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <DateRangePicker
            value={customDateRange}
            onChange={(range) => {
              setCustomDateRange(range);
              if (range?.from) {
                const newMonth = format(range.from, 'yyyy-MM');
                if (newMonth !== selectedMonth) {
                  setSelectedMonth(newMonth);
                  if (isEditing) cancelEditing();
                }
              }
            }}
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

      {/* Filtros + Cards de Resumo */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium mr-1">Contagem:</span>
          {(['contrato', 'cliente'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setContagemFilter(filter)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all border",
                contagemFilter === filter
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
              )}
            >
              {filter === 'contrato' ? 'Contrato' : 'Cliente'}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium mr-1">Funil:</span>
          <MultiSelect
            options={funis ?? []}
            selected={selectedFunis}
            onChange={setSelectedFunis}
            placeholder="Todos os funis"
            searchPlaceholder="Buscar funil..."
            className="h-8 w-56 text-xs"
          />
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium mr-1">Fonte:</span>
          <Select value={selectedUtmSource} onValueChange={setSelectedUtmSource}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Todas as fontes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as fontes</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="google">Google</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Investimento */}
        <Card className="border bg-card">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Investimento</span>
              <Badge variant="outline" className={cn("text-xs font-mono tabular-nums",
                investimentoPerc >= 100 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" :
                investimentoPerc >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950" :
                "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
              )}>
                {investimentoPerc.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-2xl font-bold tracking-tight mb-1">
              {adsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatValue(investimentoRealizado, 'currency')}
            </div>
            <div className="text-xs text-muted-foreground">
              Meta: {formatValue(investimentoOrcado, 'currency')}
            </div>
            {investimentoVar && (
              <div className={cn("flex items-center gap-1 text-xs mt-0.5",
                investimentoVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {investimentoVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{investimentoVar.isPositive ? '+' : ''}{investimentoVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500",
                investimentoPerc >= 100 ? "bg-emerald-500" : investimentoPerc >= 80 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${Math.min(investimentoPerc, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Leads Totais */}
        <Card className="border bg-card">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{mqlsLabel}</span>
              <Badge variant="outline" className={cn("text-xs font-mono tabular-nums",
                mqlsPerc >= 100 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" :
                mqlsPerc >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950" :
                "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
              )}>
                {mqlsPerc.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-2xl font-bold tracking-tight mb-1">
              {mqlLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : mqlsRealizado}
            </div>
            <div className="text-xs text-muted-foreground">
              Meta: {mqlsOrcado.toLocaleString('pt-BR')} leads
            </div>
            {leadsVar && (
              <div className={cn("flex items-center gap-1 text-xs mt-0.5",
                leadsVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {leadsVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{leadsVar.isPositive ? '+' : ''}{leadsVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500",
                mqlsPerc >= 100 ? "bg-emerald-500" : mqlsPerc >= 80 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${Math.min(mqlsPerc, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Contratos/Clientes */}
        <Card className="border bg-card">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{clientesLabel}</span>
              <Badge variant="outline" className={cn("text-xs font-mono tabular-nums",
                clientesPerc >= 100 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" :
                clientesPerc >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950" :
                "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
              )}>
                {clientesPerc.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-2xl font-bold tracking-tight mb-1">
              {(mqlLoading || naoMqlLoading) ? <Loader2 className="w-5 h-5 animate-spin" /> : clientesRealizado}
            </div>
            <div className="text-xs text-muted-foreground">
              Meta: {clientesOrcado} {revenueFilter === 'recorrente' ? 'contratos' : revenueFilter === 'pontual' ? 'contratos' : 'clientes'}
            </div>
            {clientesVar && (
              <div className={cn("flex items-center gap-1 text-xs mt-0.5",
                clientesVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {clientesVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{clientesVar.isPositive ? '+' : ''}{clientesVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500",
                clientesPerc >= 100 ? "bg-emerald-500" : clientesPerc >= 80 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${Math.min(clientesPerc, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Faturamento */}
        <Card className="border bg-card">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{faturamentoLabel}</span>
              <Badge variant="outline" className={cn("text-xs font-mono tabular-nums",
                faturamentoPerc >= 100 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" :
                faturamentoPerc >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950" :
                "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
              )}>
                {faturamentoPerc.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-2xl font-bold tracking-tight mb-1">
              {(mqlLoading || naoMqlLoading) ? <Loader2 className="w-5 h-5 animate-spin" /> : formatValue(faturamentoRealizado, 'currency')}
            </div>
            <div className="text-xs text-muted-foreground">
              Meta: {formatValue(faturamentoOrcado, 'currency')}
            </div>
            {faturamentoVar && (
              <div className={cn("flex items-center gap-1 text-xs mt-0.5",
                faturamentoVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {faturamentoVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{faturamentoVar.isPositive ? '+' : ''}{faturamentoVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
            {revenueFilter === 'todos' && !(mqlLoading || naoMqlLoading) && (
              <div className="flex items-center gap-3 text-xs mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Rec:</span>
                  <span className="font-medium">{formatValue(fatRecorrenteRealizado, 'currency')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground">Pont:</span>
                  <span className="font-medium">{formatValue(fatPontualRealizado, 'currency')}</span>
                </div>
              </div>
            )}
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500",
                faturamentoPerc >= 100 ? "bg-emerald-500" : faturamentoPerc >= 80 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${Math.min(faturamentoPerc, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Seção */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {([
          { key: 'consolidado', label: 'Consolidado' },
          { key: 'marketing', label: 'Marketing' },
          { key: 'mql', label: 'Vendas MQL' },
          { key: 'nao-mql', label: 'Vendas Não-MQL' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              activeSection === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabelas de Métricas */}
      <div className="space-y-6">
        {/* Consolidado */}
        {activeSection === 'consolidado' && (
        <Card className="border bg-card">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Consolidado</CardTitle>
              {(adsLoading || mqlLoading || naoMqlLoading) && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[30%] text-xs font-semibold uppercase tracking-wide">Métrica</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Orçado</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Realizado</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">% Atingido</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Anterior</TableHead>
                  <TableHead className="text-right w-[10%] text-xs font-semibold uppercase tracking-wide">Var %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consolidadoSections.map((section) => (
                  <>
                    <TableRow key={`header-${section.title}`} className="bg-muted/30">
                      <TableCell colSpan={6} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.title}
                      </TableCell>
                    </TableRow>
                    {section.metrics.map(m => (
                      <TableRow key={m.id} className="hover:bg-muted/20">
                        <TableCell className="text-sm font-medium">{m.name}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {renderOrcadoCell(m)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatValue(m.realizado, m.format)}
                        </TableCell>
                        <TableCell className={cn("text-right text-sm font-semibold",
                          m.percentual !== null && m.percentual >= 100 && "text-emerald-600 dark:text-emerald-400",
                          m.percentual !== null && m.percentual >= 80 && m.percentual < 100 && "text-amber-600 dark:text-amber-400",
                          m.percentual !== null && m.percentual < 80 && "text-red-600 dark:text-red-400"
                        )}>
                          {m.percentual !== null ? `${m.percentual.toFixed(1)}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {(() => {
                            const prev = getPrevValue(m.id);
                            return prev !== null ? formatValue(prev, m.format) : '-';
                          })()}
                        </TableCell>
                        <TableCell className={cn("text-right text-sm font-medium",
                          (() => {
                            const prev = getPrevValue(m.id);
                            const curr = typeof m.realizado === 'number' ? m.realizado : 0;
                            if (prev === null || prev === 0) return '';
                            return curr >= prev ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
                          })()
                        )}>
                          {(() => {
                            const prev = getPrevValue(m.id);
                            const curr = typeof m.realizado === 'number' ? m.realizado : 0;
                            if (prev === null || prev === 0) return '-';
                            const variation = ((curr - prev) / prev) * 100;
                            return `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`;
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

        {/* Marketing — Ads */}
        {activeSection === 'marketing' && (
        <Card className="border bg-card">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Marketing — Ads</CardTitle>
              {adsLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[30%] text-xs font-semibold uppercase tracking-wide">Métrica</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Orçado</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Realizado</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">% Atingido</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Anterior</TableHead>
                  <TableHead className="text-right w-[10%] text-xs font-semibold uppercase tracking-wide">Var %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adsMetrics.map(m => (
                  <TableRow key={m.id} className="hover:bg-muted/20">
                    <TableCell className="text-sm font-medium">{m.name}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {renderOrcadoCell(m)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatValue(m.realizado, m.format)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {(() => {
                        const prev = getPrevValue(m.id);
                        return prev !== null ? formatValue(prev, m.format) : '-';
                      })()}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold",
                      m.percentual !== null && m.percentual >= 100 && "text-emerald-600 dark:text-emerald-400",
                      m.percentual !== null && m.percentual >= 80 && m.percentual < 100 && "text-amber-600 dark:text-amber-400",
                      m.percentual !== null && m.percentual < 80 && "text-red-600 dark:text-red-400"
                    )}>
                      {m.percentual !== null ? `${m.percentual.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm font-medium",
                      (() => {
                        const prev = getPrevValue(m.id);
                        const curr = typeof m.realizado === 'number' ? m.realizado : 0;
                        if (prev === null || prev === 0) return '';
                        return curr >= prev ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
                      })()
                    )}>
                      {(() => {
                        const prev = getPrevValue(m.id);
                        const curr = typeof m.realizado === 'number' ? m.realizado : 0;
                        if (prev === null || prev === 0) return '-';
                        const variation = ((curr - prev) / prev) * 100;
                        return `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`;
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

        {/* Vendas — MQL */}
        {activeSection === 'mql' && cardFilter !== 'nao-mql' && (
        <Card className="border bg-card">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Vendas — MQL</CardTitle>
              {mqlLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[30%] text-xs font-semibold uppercase tracking-wide">Métrica</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Orçado</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Realizado</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">% Atingido</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Anterior</TableHead>
                  <TableHead className="text-right w-[10%] text-xs font-semibold uppercase tracking-wide">Var %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mqlMetrics.map(m => (
                  <TableRow key={m.id} className="hover:bg-muted/20">
                    <TableCell className="text-sm font-medium">{m.name}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {renderOrcadoCell(m)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatValue(m.realizado, m.format)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {(() => {
                        const prev = getPrevValue(m.id);
                        return prev !== null ? formatValue(prev, m.format) : '-';
                      })()}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold",
                      m.percentual !== null && m.percentual >= 100 && "text-emerald-600 dark:text-emerald-400",
                      m.percentual !== null && m.percentual >= 80 && m.percentual < 100 && "text-amber-600 dark:text-amber-400",
                      m.percentual !== null && m.percentual < 80 && "text-red-600 dark:text-red-400"
                    )}>
                      {m.percentual !== null ? `${m.percentual.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm font-medium",
                      (() => {
                        const prev = getPrevValue(m.id);
                        const curr = typeof m.realizado === 'number' ? m.realizado : 0;
                        if (prev === null || prev === 0) return '';
                        return curr >= prev ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
                      })()
                    )}>
                      {(() => {
                        const prev = getPrevValue(m.id);
                        const curr = typeof m.realizado === 'number' ? m.realizado : 0;
                        if (prev === null || prev === 0) return '-';
                        const variation = ((curr - prev) / prev) * 100;
                        return `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`;
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

        {/* Vendas — Não-MQL */}
        {activeSection === 'nao-mql' && cardFilter !== 'mql' && (
        <Card className="border bg-card">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Vendas — Não-MQL</CardTitle>
              {naoMqlLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[30%] text-xs font-semibold uppercase tracking-wide">Métrica</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Orçado</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Realizado</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">% Atingido</TableHead>
                  <TableHead className="text-right w-[15%] text-xs font-semibold uppercase tracking-wide">Anterior</TableHead>
                  <TableHead className="text-right w-[10%] text-xs font-semibold uppercase tracking-wide">Var %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {naoMqlMetrics.map(m => (
                  <TableRow key={m.id} className="hover:bg-muted/20">
                    <TableCell className="text-sm font-medium">{m.name}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {renderOrcadoCell(m)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatValue(m.realizado, m.format)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {(() => {
                        const prev = getPrevValue(m.id);
                        return prev !== null ? formatValue(prev, m.format) : '-';
                      })()}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold",
                      m.percentual !== null && m.percentual >= 100 && "text-emerald-600 dark:text-emerald-400",
                      m.percentual !== null && m.percentual >= 80 && m.percentual < 100 && "text-amber-600 dark:text-amber-400",
                      m.percentual !== null && m.percentual < 80 && "text-red-600 dark:text-red-400"
                    )}>
                      {m.percentual !== null ? `${m.percentual.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm font-medium",
                      (() => {
                        const prev = getPrevValue(m.id);
                        const curr = typeof m.realizado === 'number' ? m.realizado : 0;
                        if (prev === null || prev === 0) return '';
                        return curr >= prev ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
                      })()
                    )}>
                      {(() => {
                        const prev = getPrevValue(m.id);
                        const curr = typeof m.realizado === 'number' ? m.realizado : 0;
                        if (prev === null || prev === 0) return '-';
                        const variation = ((curr - prev) / prev) * 100;
                        return `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`;
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

      </div>

    </div>
  );
}
