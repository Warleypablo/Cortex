import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Target, DollarSign, Users, BarChart3, Megaphone, LineChart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, format, parse } from "date-fns";

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

// Valores orçados (budget) - por enquanto fixos, depois podem vir de uma tabela
const ORCADO_MQL = {
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

const ORCADO_NAO_MQL = {
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

const ORCADO_TOTAL = {
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
};

export default function GrowthOrcadoRealizado() {
  usePageTitle("Orçado x Realizado");
  useSetPageInfo("Orçado x Realizado", "Controle de Métricas de Marketing e Vendas");
  
  const [selectedMonth, setSelectedMonth] = useState("2026-01");
  
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

  const { data: mqlData, isLoading: mqlLoading } = useQuery<MQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/mql', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/mql?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
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
    percReuniaoAgendada: number;
    percNoShow: number;
    taxaVendas: number;
    txContratosRecorrentes: number;
    txContratosImplantacao: number;
    ticketMedioAceleracao: number;
    ticketMedioImplantacao: number;
  }

  const { data: naoMqlData, isLoading: naoMqlLoading } = useQuery<NaoMQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/nao-mql', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/nao-mql?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
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
  }, [mqlData]);

  // Métricas de Marketing Ads (usando dados reais da API)
  const adsMetrics: Metric[] = useMemo(() => {
    const data = adsData || {} as AdsMetrics;
    return [
      { id: 'investimento', name: 'Investimento', type: 'manual', orcado: 95500, realizado: data.investimento ?? 0, percentual: calcPercentual(95500, data.investimento), format: 'currency' },
      { id: 'cpm', name: 'CPM', type: 'formula', orcado: 100, realizado: data.cpm ?? null, percentual: calcPercentual(100, data.cpm), format: 'currency' },
      { id: 'impressoes', name: 'Impressões', type: 'formula', orcado: 955000, realizado: data.impressoes ?? 0, percentual: calcPercentual(955000, data.impressoes), format: 'number' },
      { id: 'ctr', name: 'CTR', type: 'manual', orcado: 0.009, realizado: data.ctr ?? null, percentual: calcPercentual(0.009, data.ctr), format: 'percent' },
      { id: 'cliques_saida', name: 'Cliques de Saída', type: 'formula', orcado: 8595, realizado: data.cliquesSaida ?? 0, percentual: calcPercentual(8595, data.cliquesSaida), format: 'number' },
      { id: 'visualizacao_pagina', name: 'Visualização de Página', type: 'formula', orcado: 7306, realizado: data.visualizacaoPagina ?? null, percentual: calcPercentual(7306, data.visualizacaoPagina), format: 'number' },
      { id: 'cps', name: 'CPS', type: 'formula', orcado: 13.07, realizado: data.cps ?? null, percentual: calcPercentual(13.07, data.cps), format: 'currency' },
    ];
  }, [adsData]);

  // Métricas de Site (ainda mockadas - depende de GA4 ou outra fonte)
  const siteMetrics: Metric[] = useMemo(() => {
    return [
      { id: 'connect_rate', name: 'Connect Rate', type: 'manual', orcado: 0.85, realizado: null, percentual: null, format: 'percent' },
      { id: 'conversao_pagina', name: 'Conversão da Página', type: 'manual', orcado: 0.18, realizado: null, percentual: null, format: 'percent' },
      { id: 'cpl', name: 'CPL', type: 'formula', orcado: 73, realizado: null, percentual: null, format: 'currency' },
      { id: 'leads', name: 'Leads', type: 'formula', orcado: 1315, realizado: 0, percentual: 0, format: 'number' },
      { id: 'mql', name: 'MQL', type: 'formula', orcado: 229, realizado: mqlData?.totalMqls ?? 0, percentual: calcPercentual(229, mqlData?.totalMqls ?? null), format: 'number' },
      { id: 'mql_perc', name: 'MQL (%)', type: 'manual', orcado: 0.22, realizado: null, percentual: 0, format: 'percent' },
      { id: 'cpmql', name: 'CPMQL', type: 'formula', orcado: 417, realizado: null, percentual: 0, format: 'currency' },
    ];
  }, [mqlData]);

  const marketingSections: MetricSection[] = [
    {
      title: 'Métricas de Marketing: Ads',
      icon: <Megaphone className="w-5 h-5" />,
      metrics: adsMetrics,
    },
    {
      title: 'Métricas de Marketing: Site',
      icon: <LineChart className="w-5 h-5" />,
      metrics: siteMetrics,
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
  }, [naoMqlData]);

  const outboundSection: MetricSection = {
    title: 'Métricas de Vendas: Outbound',
    icon: <Target className="w-5 h-5" />,
    metrics: [
      { id: 'out_leads', name: 'Leads', type: 'manual', orcado: 800, realizado: null, percentual: 0, format: 'number' },
      { id: 'out_ra_perc', name: '% Reunião agendadas MQL', type: 'manual', orcado: 0.10, realizado: null, percentual: 0, format: 'percent' },
      { id: 'out_ra_num', name: 'Nº Reunião agendada MQL', type: 'formula', orcado: 84, realizado: 0, percentual: 0, format: 'number' },
      { id: 'out_rr_num', name: 'Nº Reunião realizada MQL', type: 'formula', orcado: 80, realizado: 0, percentual: 0, format: 'number' },
      { id: 'out_noshow', name: '% No-show', type: 'manual', orcado: 0.05, realizado: null, percentual: 0, format: 'percent' },
      { id: 'out_taxa_vendas', name: 'Taxa RR/Vendas MQL', type: 'manual', orcado: 0.275, realizado: null, percentual: 0, format: 'percent' },
      { id: 'out_novos_clientes', name: 'Novos Clientes não MQL', type: 'formula', orcado: 21, realizado: 0, percentual: 0, format: 'number' },
      { id: 'out_tx_recorrente', name: 'Tx de Contratos Recorrentes', type: 'manual', orcado: 0.65, realizado: null, percentual: 0, format: 'percent' },
      { id: 'out_tx_implantacao', name: 'Tx de Contratos Implantação', type: 'manual', orcado: 0.45, realizado: null, percentual: 0, format: 'percent' },
      { id: 'out_contratos_acel', name: 'Nº Novos Contratos Aceleração não-MQL', type: 'formula', orcado: 14, realizado: 0, percentual: 0, format: 'number', emoji: '🏎️' },
      { id: 'out_ticket_acel', name: 'Ticket Médio Aceleração não-MQL', type: 'manual', orcado: 4000, realizado: null, percentual: 0, format: 'currency', emoji: '🏎️' },
      { id: 'out_fat_acel', name: 'Faturamento Aceleração (MRR novo) de não-MQL', type: 'formula', orcado: 54204.15, realizado: 0, percentual: 0, format: 'currency', emoji: '🏎️' },
      { id: 'out_contratos_impl', name: 'Nº Novos Contratos Implantação não-MQL', type: 'formula', orcado: 9, realizado: 0, percentual: 0, format: 'number', emoji: '🔧' },
      { id: 'out_ticket_impl', name: 'Ticket Médio Implantação não-MQL', type: 'manual', orcado: 8500, realizado: null, percentual: null, format: 'currency', emoji: '🔧' },
      { id: 'out_fat_impl', name: 'Faturamento Implantação não-MQL', type: 'formula', orcado: 79742.64, realizado: 0, percentual: 0, format: 'currency', emoji: '🔧' },
    ],
  };

  const totalMetrics: Metric[] = useMemo(() => {
    const mql = mqlData || {} as MQLMetrics;
    const naoMql = naoMqlData || {} as NaoMQLMetrics;
    
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
    
    return [
      { 
        id: 'total_perc_ra', 
        name: '% RA', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.percRA, 
        realizado: percRA, 
        percentual: calcPercentual(ORCADO_TOTAL.percRA, percRA), 
        format: 'percent' 
      },
      { 
        id: 'total_ra', 
        name: 'Reuniões Agendadas', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.reunioesAgendadas, 
        realizado: totalReunioesAgendadas, 
        percentual: calcPercentual(ORCADO_TOTAL.reunioesAgendadas, totalReunioesAgendadas), 
        format: 'number' 
      },
      { 
        id: 'total_rr', 
        name: 'Reuniões Realizadas', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.reunioesRealizadas, 
        realizado: totalReunioesRealizadas, 
        percentual: calcPercentual(ORCADO_TOTAL.reunioesRealizadas, totalReunioesRealizadas), 
        format: 'number' 
      },
      { 
        id: 'total_noshow', 
        name: 'No show', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.percNoShow, 
        realizado: percNoShowReal, 
        percentual: calcPercentual(ORCADO_TOTAL.percNoShow, percNoShowReal), 
        format: 'percent' 
      },
      { 
        id: 'total_conv_rrv', 
        name: 'Conversão de RR/V (%)', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.percConversaoRRV, 
        realizado: percConversaoRRV, 
        percentual: calcPercentual(ORCADO_TOTAL.percConversaoRRV, percConversaoRRV), 
        format: 'percent' 
      },
      { 
        id: 'total_novos_clientes', 
        name: 'Novos Clientes', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.novosClientes, 
        realizado: totalNovosClientes, 
        percentual: calcPercentual(ORCADO_TOTAL.novosClientes, totalNovosClientes), 
        format: 'number' 
      },
      { 
        id: 'total_ganhos_acel', 
        name: 'Negócios Ganhos Aceleração', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.contratosAceleracao, 
        realizado: totalContratosAceleracao, 
        percentual: calcPercentual(ORCADO_TOTAL.contratosAceleracao, totalContratosAceleracao), 
        format: 'number', 
        emoji: '🏎️' 
      },
      { 
        id: 'total_ganhos_impl', 
        name: 'Negócios Ganhos Implantação', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.contratosImplantacao, 
        realizado: totalContratosImplantacao, 
        percentual: calcPercentual(ORCADO_TOTAL.contratosImplantacao, totalContratosImplantacao), 
        format: 'number', 
        emoji: '🔧' 
      },
      { 
        id: 'total_faturamento', 
        name: 'Faturamento Total', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.faturamentoTotal, 
        realizado: totalFaturamento, 
        percentual: calcPercentual(ORCADO_TOTAL.faturamentoTotal, totalFaturamento), 
        format: 'currency' 
      },
      { 
        id: 'total_fat_acel', 
        name: 'Faturamento A', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.faturamentoAceleracao, 
        realizado: totalFatAceleracao, 
        percentual: calcPercentual(ORCADO_TOTAL.faturamentoAceleracao, totalFatAceleracao), 
        format: 'currency', 
        emoji: '🏎️' 
      },
      { 
        id: 'total_fat_impl', 
        name: 'Faturamento I', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.faturamentoImplantacao, 
        realizado: totalFatImplantacao, 
        percentual: calcPercentual(ORCADO_TOTAL.faturamentoImplantacao, totalFatImplantacao), 
        format: 'currency', 
        emoji: '🔧' 
      },
      { 
        id: 'total_conv_funil', 
        name: 'Taxa de Conversão do Funil inteiro', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.taxaConversaoFunil, 
        realizado: taxaConversaoFunil, 
        percentual: calcPercentual(ORCADO_TOTAL.taxaConversaoFunil, taxaConversaoFunil), 
        format: 'percent' 
      },
      { 
        id: 'total_conv_mql', 
        name: 'Tx de conversão MQL', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.taxaConversaoMQL, 
        realizado: taxaConversaoMQL, 
        percentual: calcPercentual(ORCADO_TOTAL.taxaConversaoMQL, taxaConversaoMQL), 
        format: 'percent' 
      },
      { 
        id: 'total_ticket_geral', 
        name: 'Ticket Médio Geral', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.ticketMedioGeral, 
        realizado: ticketMedioGeral, 
        percentual: calcPercentual(ORCADO_TOTAL.ticketMedioGeral, ticketMedioGeral), 
        format: 'currency' 
      },
      { 
        id: 'total_ticket_acel', 
        name: 'Ticket Médio Aceleração', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.ticketMedioAceleracao, 
        realizado: ticketMedioAceleracao, 
        percentual: calcPercentual(ORCADO_TOTAL.ticketMedioAceleracao, ticketMedioAceleracao), 
        format: 'currency' 
      },
      { 
        id: 'total_ticket_impl', 
        name: 'Ticket Médio Implantação', 
        type: 'formula', 
        orcado: ORCADO_TOTAL.ticketMedioImplantacao, 
        realizado: ticketMedioImplantacao, 
        percentual: calcPercentual(ORCADO_TOTAL.ticketMedioImplantacao, ticketMedioImplantacao), 
        format: 'currency' 
      },
    ];
  }, [mqlData, naoMqlData]);
  
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
    outboundSection,
    totalSection,
  ];

  return (
    <div className="p-6 space-y-6" data-testid="growth-orcado-realizado-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Orçado x Realizado</h1>
            <p className="text-muted-foreground text-sm">Acompanhamento de metas de marketing e vendas</p>
          </div>
        </div>
        
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Investimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 95.500</div>
            <p className="text-xs text-muted-foreground">Orçado para o período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MQLs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {mqlLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : mqlData?.totalMqls ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Leads qualificados no período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Novos Clientes MQL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {mqlLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : mqlData?.novosClientes ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Negócios ganhos de MQL</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento MQL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {mqlLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatValue((mqlData?.faturamentoAceleracao ?? 0) + (mqlData?.faturamentoImplantacao ?? 0), 'currency')}
            </div>
            <p className="text-xs text-muted-foreground">Aceleração + Implantação</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {allSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {section.icon}
                {section.title}
                {section.title === 'Métricas de Vendas: MQL' && mqlLoading && (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[55%]">Métrica</TableHead>
                    <TableHead className="text-right w-[15%]">Orçado</TableHead>
                    <TableHead className="text-right w-[15%]">Realizado</TableHead>
                    <TableHead className="text-right w-[15%]">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.metrics.map((metric) => (
                    <TableRow key={metric.id} data-testid={`metric-row-${metric.id}`}>
                      <TableCell className="font-medium">
                        {metric.emoji && <span className="mr-2">{metric.emoji}</span>}
                        {metric.name}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatValue(metric.orcado, metric.format)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatValue(metric.realizado, metric.format)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono", getVarianceColor(metric.percentual))}>
                        {metric.percentual !== null ? `${metric.percentual.toFixed(2)}%` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
