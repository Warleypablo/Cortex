import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Target, DollarSign, Users, BarChart3, Megaphone, LineChart, Loader2, Wallet, UserCheck, Receipt, ArrowUpRight, ArrowDownRight, Minus, Calendar, Phone, ShoppingCart, Pencil, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/multi-select";
import { startOfMonth, endOfMonth, format, parse } from "date-fns";
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
  cps: 13.07,
  cliques: 89843,
  cliquesSaida: 8595,
  cpm: 100,
  visualizacaoPagina: 7306,
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
  cliques_saida: { segment: 'ads', key: 'cliquesSaida' },
  visualizacao_pagina: { segment: 'ads', key: 'visualizacaoPagina' },
  cps: { segment: 'ads', key: 'cps' },
};

const PERCENT_METRICS = new Set([
  'mql_ra_perc', 'mql_noshow', 'mql_taxa_vendas', 'mql_tx_recorrente', 'mql_tx_implantacao',
  'nmql_ra_perc', 'nmql_noshow', 'nmql_taxa_vendas', 'nmql_tx_recorrente', 'nmql_tx_implantacao',
  'ctr',
]);

export default function GrowthOrcadoRealizado() {
  usePageTitle("Orçado x Realizado");
  useSetPageInfo("Orçado x Realizado", "Controle de Métricas de Marketing e Vendas");
  
  const [selectedMonth, setSelectedMonth] = useState("2026-01");
  const [cardFilter, setCardFilter] = useState<'todos' | 'mql' | 'nao-mql'>('todos');
  const [revenueFilter, setRevenueFilter] = useState<'todos' | 'recorrente' | 'pontual'>('todos');
  const [contagemFilter, setContagemFilter] = useState<'contrato' | 'cliente'>('contrato');
  const [selectedFunis, setSelectedFunis] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const months = [
    { value: "2026-01", label: "Janeiro 2026" },
    { value: "2026-02", label: "Fevereiro 2026" },
    { value: "2026-03", label: "Março 2026" },
    { value: "2025-12", label: "Dezembro 2025" },
    { value: "2025-11", label: "Novembro 2025" },
    { value: "2025-10", label: "Outubro 2025" },
  ];

  const dateRange = useMemo(() => {
    const monthDate = parse(selectedMonth, 'yyyy-MM', new Date());
    return {
      startDate: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(monthDate), 'yyyy-MM-dd'),
    };
  }, [selectedMonth]);

  // Fetch budgets from DB (falls back to defaults)
  const { data: budgetsData } = useQuery<Record<string, any>>({
    queryKey: ['/api/growth/orcado-realizado/budgets', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/budgets?mes=${selectedMonth}`);
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
            body: JSON.stringify({ mes: selectedMonth, segmento, metricas }),
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

  const funilParam = selectedFunis.length > 0 ? `&funilNgc=${selectedFunis.map(f => encodeURIComponent(f)).join(',')}` : '';

  const { data: mqlData, isLoading: mqlLoading } = useQuery<MQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/mql', dateRange.startDate, dateRange.endDate, contagemFilter, selectedFunis],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/mql?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&contagem=${contagemFilter}${funilParam}`);
      if (!res.ok) throw new Error('Failed to fetch MQL metrics');
      return res.json();
    },
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
    queryKey: ['/api/growth/orcado-realizado/nao-mql', dateRange.startDate, dateRange.endDate, contagemFilter, selectedFunis],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/nao-mql?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&contagem=${contagemFilter}${funilParam}`);
      if (!res.ok) throw new Error('Failed to fetch Não-MQL metrics');
      return res.json();
    },
  });

  interface AdsMetrics {
    investimento: number;
    impressoes: number;
    cliques: number;
    cliquesSaida: number;
    cpm: number;
    ctr: number;
    cps: number;
    visualizacaoPagina: number | null;
  }

  const { data: adsData, isLoading: adsLoading } = useQuery<AdsMetrics>({
    queryKey: ['/api/growth/orcado-realizado/ads', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/ads?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch Ads metrics');
      return res.json();
    },
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
      { id: 'impressoes', name: 'Impressões', type: 'formula', orcado: ORCADO_ADS.impressoes, realizado: data.impressoes ?? 0, percentual: calcPercentual(ORCADO_ADS.impressoes, data.impressoes), format: 'number' },
      { id: 'ctr', name: 'CTR', type: 'manual', orcado: ORCADO_ADS.ctr, realizado: data.ctr ?? null, percentual: calcPercentual(ORCADO_ADS.ctr, data.ctr), format: 'percent' },
      { id: 'cliques_saida', name: 'Cliques de Saída', type: 'formula', orcado: ORCADO_ADS.cliquesSaida, realizado: data.cliquesSaida ?? 0, percentual: calcPercentual(ORCADO_ADS.cliquesSaida, data.cliquesSaida), format: 'number' },
      { id: 'visualizacao_pagina', name: 'Visualização de Página', type: 'formula', orcado: ORCADO_ADS.visualizacaoPagina, realizado: data.visualizacaoPagina ?? null, percentual: calcPercentual(ORCADO_ADS.visualizacaoPagina, data.visualizacaoPagina), format: 'number' },
      { id: 'cps', name: 'CPS', type: 'formula', orcado: ORCADO_ADS.cps, realizado: data.cps ?? null, percentual: calcPercentual(ORCADO_ADS.cps, data.cps), format: 'currency' },
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
  const getProgressValue = (percentual: number | null) => {
    if (percentual === null) return 0;
    return Math.min(Math.max(percentual, 0), 100);
  };

  // Helper para ícone de tendência
  const getTrendIcon = (percentual: number | null) => {
    if (percentual === null) return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (percentual >= 100) return <ArrowUpRight className="w-4 h-4 text-emerald-500" />;
    if (percentual >= 80) return <ArrowUpRight className="w-4 h-4 text-amber-500" />;
    return <ArrowDownRight className="w-4 h-4 text-red-500" />;
  };

  // Calcular métricas dos cards de resumo (reativas ao filtro)
  const investimentoRealizado = adsData?.investimento ?? 0;
  const investimentoOrcado = ORCADO_ADS.investimento;
  const investimentoPerc = investimentoOrcado > 0 ? (investimentoRealizado / investimentoOrcado) * 100 : 0;

  const mqlsRealizado = cardFilter === 'nao-mql'
    ? (naoMqlData?.totalNaoMqls ?? 0)
    : cardFilter === 'mql'
    ? (mqlData?.totalMqls ?? 0)
    : (mqlData?.totalMqls ?? 0) + (naoMqlData?.totalNaoMqls ?? 0);
  const mqlsOrcadoMql = ORCADO_MQL.reunioesAgendadas + ORCADO_MQL.novosClientes; // ~229 MQLs
  const mqlsOrcadoNaoMql = ORCADO_NAO_MQL.reunioesAgendadas + ORCADO_NAO_MQL.novosClientes; // ~1085 leads
  const mqlsOrcado = cardFilter === 'nao-mql' ? mqlsOrcadoNaoMql : cardFilter === 'mql' ? mqlsOrcadoMql : mqlsOrcadoMql + mqlsOrcadoNaoMql;
  const mqlsPerc = mqlsOrcado > 0 ? (mqlsRealizado / mqlsOrcado) * 100 : 0;
  const mqlsLabel = cardFilter === 'nao-mql' ? 'Leads Não-MQL' : cardFilter === 'mql' ? 'MQLs' : 'Leads Totais';

  // Helper para somar valores de MQL e/ou Não-MQL conforme cardFilter
  const sumByCardFilter = (mqlVal: number, naoMqlVal: number) => {
    if (cardFilter === 'mql') return mqlVal;
    if (cardFilter === 'nao-mql') return naoMqlVal;
    return mqlVal + naoMqlVal;
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
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Editar Metas
            </button>
          )}
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); if (isEditing) cancelEditing(); }}>
            <SelectTrigger className="w-48" data-testid="select-month">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="overflow-hidden relative group hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
          <CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Investimento</CardTitle>
            <div className="p-2 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20 group-hover:scale-110 transition-transform duration-300">
              <Wallet className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold tracking-tight">
                {adsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatValue(investimentoRealizado, 'currency')}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className={cn(
                  "font-semibold",
                  investimentoPerc >= 100 ? "text-emerald-500" : investimentoPerc >= 80 ? "text-amber-500" : "text-red-500"
                )}>
                  {investimentoPerc.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                  style={{ width: `${getProgressValue(investimentoPerc)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Meta: {formatValue(investimentoOrcado, 'currency')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative group hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-400 to-purple-600" />
          <CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{mqlsLabel}</CardTitle>
            <div className="p-2 rounded-full bg-gradient-to-br from-purple-400/20 to-purple-600/20 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-4 h-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold tracking-tight">
                {mqlLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : mqlsRealizado}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className={cn(
                  "font-semibold",
                  mqlsPerc >= 100 ? "text-emerald-500" : mqlsPerc >= 80 ? "text-amber-500" : "text-red-500"
                )}>
                  {mqlsPerc.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-600 transition-all duration-500"
                  style={{ width: `${getProgressValue(mqlsPerc)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Meta: {mqlsOrcado.toLocaleString('pt-BR')} leads</p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative group hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
          <CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{clientesLabel}</CardTitle>
            <div className="p-2 rounded-full bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 group-hover:scale-110 transition-transform duration-300">
              <UserCheck className="w-4 h-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold tracking-tight">
                {mqlLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : clientesRealizado}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className={cn(
                  "font-semibold",
                  clientesPerc >= 100 ? "text-emerald-500" : clientesPerc >= 80 ? "text-amber-500" : "text-red-500"
                )}>
                  {clientesPerc.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                  style={{ width: `${getProgressValue(clientesPerc)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Meta: {clientesOrcado} {revenueFilter === 'recorrente' ? 'contratos' : revenueFilter === 'pontual' ? 'contratos' : 'clientes'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative group hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{faturamentoLabel}</CardTitle>
            <div className="p-2 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 group-hover:scale-110 transition-transform duration-300">
              <Receipt className="w-4 h-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold tracking-tight">
                {mqlLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatValue(faturamentoRealizado, 'currency')}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className={cn(
                  "font-semibold",
                  faturamentoPerc >= 100 ? "text-emerald-500" : faturamentoPerc >= 80 ? "text-amber-500" : "text-red-500"
                )}>
                  {faturamentoPerc.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${getProgressValue(faturamentoPerc)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Meta: {formatValue(faturamentoOrcado, 'currency')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Métricas */}
      <Tabs defaultValue="visao-geral" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid lg:grid-cols-4 gap-1 h-auto p-1">
          <TabsTrigger value="visao-geral" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white">
            <LineChart className="w-4 h-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="marketing" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white">
            <Megaphone className="w-4 h-4" />
            <span className="hidden sm:inline">Marketing</span>
          </TabsTrigger>
          <TabsTrigger value="vendas" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Vendas</span>
          </TabsTrigger>
          <TabsTrigger value="total" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Consolidado</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6 mt-6">
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-orange-500 to-red-500" />
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20">
                  <LineChart className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    {cardFilter === 'mql' ? 'Métricas MQL' : cardFilter === 'nao-mql' ? 'Métricas Não-MQL' : 'Todas as Métricas'} - Orçado x Realizado
                  </CardTitle>
                  <CardDescription>
                    {cardFilter === 'mql' ? 'Métricas de marketing e vendas (apenas MQL)' : cardFilter === 'nao-mql' ? 'Métricas de marketing e vendas (apenas Não-MQL)' : 'Visão consolidada de todas as métricas de marketing e vendas'}
                  </CardDescription>
                </div>
                {(adsLoading || mqlLoading || naoMqlLoading) && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Categoria</TableHead>
                      <TableHead className="font-semibold">Métrica</TableHead>
                      <TableHead className="text-right font-semibold">Orçado</TableHead>
                      <TableHead className="text-right font-semibold">Realizado</TableHead>
                      <TableHead className="text-right font-semibold">%</TableHead>
                      <TableHead className="text-center font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSections.map((section) => (
                      section.metrics.map((metric, idx) => (
                        <TableRow 
                          key={metric.id} 
                          className={cn(
                            idx === 0 && "border-t-2",
                            metric.isHeader && "bg-muted/30 font-semibold"
                          )}
                        >
                          {idx === 0 && (
                            <TableCell 
                              rowSpan={section.metrics.length} 
                              className="align-top font-medium bg-muted/20 border-r"
                            >
                              <div className="flex items-center gap-2">
                                {section.icon}
                                <span className="text-sm">{section.title}</span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className={cn("text-sm", metric.indent && `pl-${metric.indent * 4}`)}>
                            {metric.name}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {renderOrcadoCell(metric)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatValue(metric.realizado, metric.format)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right text-sm font-semibold",
                            metric.percentual !== null && metric.percentual >= 100 && "text-emerald-500",
                            metric.percentual !== null && metric.percentual >= 80 && metric.percentual < 100 && "text-amber-500",
                            metric.percentual !== null && metric.percentual < 80 && "text-red-500"
                          )}>
                            {metric.percentual !== null ? `${metric.percentual.toFixed(0)}%` : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              {getTrendIcon(metric.percentual)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketing" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Ads */}
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                    <Megaphone className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Métricas de Ads</CardTitle>
                    <CardDescription>Investimento e performance de anúncios</CardDescription>
                  </div>
                  {adsLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {adsMetrics.map((metric) => (
                    <div key={metric.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        {getTrendIcon(metric.percentual)}
                        <span className="text-sm font-medium">{metric.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-semibold">{formatValue(metric.realizado, metric.format)}</div>
                          <div className="text-xs text-muted-foreground">de {formatValue(metric.orcado, metric.format)}</div>
                        </div>
                        <div className="w-24">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  metric.percentual !== null && metric.percentual >= 100 && "bg-emerald-500",
                                  metric.percentual !== null && metric.percentual >= 80 && metric.percentual < 100 && "bg-amber-500",
                                  metric.percentual !== null && metric.percentual < 80 && "bg-red-500",
                                  metric.percentual === null && "bg-muted-foreground/20"
                                )}
                                style={{ width: `${getProgressValue(metric.percentual)}%` }}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-medium w-8 text-right",
                              metric.percentual !== null && metric.percentual >= 100 && "text-emerald-500",
                              metric.percentual !== null && metric.percentual >= 80 && metric.percentual < 100 && "text-amber-500",
                              metric.percentual !== null && metric.percentual < 80 && "text-red-500"
                            )}>
                              {metric.percentual !== null ? `${metric.percentual.toFixed(0)}%` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        <TabsContent value="vendas" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* MQL */}
            {cardFilter !== 'nao-mql' && (
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                    <Users className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Vendas: MQL</CardTitle>
                    <CardDescription>Leads qualificados de marketing</CardDescription>
                  </div>
                  {mqlLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {mqlMetrics.map((metric) => (
                    <div key={metric.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getTrendIcon(metric.percentual)}
                        <span className="text-sm font-medium truncate">{metric.name}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-semibold">{formatValue(metric.realizado, metric.format)}</div>
                          <div className="text-xs text-muted-foreground">de {formatValue(metric.orcado, metric.format)}</div>
                        </div>
                        <div className="w-20">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  metric.percentual !== null && metric.percentual >= 100 && "bg-emerald-500",
                                  metric.percentual !== null && metric.percentual >= 80 && metric.percentual < 100 && "bg-amber-500",
                                  metric.percentual !== null && metric.percentual < 80 && "bg-red-500"
                                )}
                                style={{ width: `${getProgressValue(metric.percentual)}%` }}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-medium w-8 text-right",
                              metric.percentual !== null && metric.percentual >= 100 && "text-emerald-500",
                              metric.percentual !== null && metric.percentual >= 80 && metric.percentual < 100 && "text-amber-500",
                              metric.percentual !== null && metric.percentual < 80 && "text-red-500"
                            )}>
                              {metric.percentual !== null ? `${metric.percentual.toFixed(0)}%` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Não-MQL */}
            {cardFilter !== 'mql' && (
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                    <Phone className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Vendas: Não-MQL</CardTitle>
                    <CardDescription>Leads de outras fontes</CardDescription>
                  </div>
                  {naoMqlLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {naoMqlMetrics.map((metric) => (
                    <div key={metric.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getTrendIcon(metric.percentual)}
                        <span className="text-sm font-medium truncate">{metric.name}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-semibold">{formatValue(metric.realizado, metric.format)}</div>
                          <div className="text-xs text-muted-foreground">de {formatValue(metric.orcado, metric.format)}</div>
                        </div>
                        <div className="w-20">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  metric.percentual !== null && metric.percentual >= 100 && "bg-emerald-500",
                                  metric.percentual !== null && metric.percentual >= 80 && metric.percentual < 100 && "bg-amber-500",
                                  metric.percentual !== null && metric.percentual < 80 && "bg-red-500"
                                )}
                                style={{ width: `${getProgressValue(metric.percentual)}%` }}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-medium w-8 text-right",
                              metric.percentual !== null && metric.percentual >= 100 && "text-emerald-500",
                              metric.percentual !== null && metric.percentual >= 80 && metric.percentual < 100 && "text-amber-500",
                              metric.percentual !== null && metric.percentual < 80 && "text-red-500"
                            )}>
                              {metric.percentual !== null ? `${metric.percentual.toFixed(0)}%` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            )}
          </div>

        </TabsContent>

        <TabsContent value="total" className="space-y-6 mt-6">
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Consolidado Geral</CardTitle>
                  <CardDescription>Métricas-chave de todas as seções</CardDescription>
                </div>
                {(adsLoading || mqlLoading || naoMqlLoading) && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Categoria</TableHead>
                      <TableHead className="font-semibold">Métrica</TableHead>
                      <TableHead className="text-right font-semibold">Orçado</TableHead>
                      <TableHead className="text-right font-semibold">Realizado</TableHead>
                      <TableHead className="text-right font-semibold">%</TableHead>
                      <TableHead className="text-center font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consolidadoSections.map((section) => (
                      section.metrics.map((metric, idx) => (
                        <TableRow
                          key={metric.id}
                          className={cn(
                            idx === 0 && "border-t-2",
                            metric.isHeader && "bg-muted/30 font-semibold"
                          )}
                        >
                          {idx === 0 && (
                            <TableCell
                              rowSpan={section.metrics.length}
                              className="align-top font-medium bg-muted/20 border-r"
                            >
                              <div className="flex items-center gap-2">
                                {section.icon}
                                <span className="text-sm">{section.title}</span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className={cn("text-sm", metric.indent && `pl-${metric.indent * 4}`)}>
                            {metric.name}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {renderOrcadoCell(metric)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatValue(metric.realizado, metric.format)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right text-sm font-semibold",
                            metric.percentual !== null && metric.percentual >= 100 && "text-emerald-500",
                            metric.percentual !== null && metric.percentual >= 80 && metric.percentual < 100 && "text-amber-500",
                            metric.percentual !== null && metric.percentual < 80 && "text-red-500"
                          )}>
                            {metric.percentual !== null ? `${metric.percentual.toFixed(0)}%` : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              {getTrendIcon(metric.percentual)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
