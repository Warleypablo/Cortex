import { useState, useMemo, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, Users, BarChart3, Megaphone, Loader2, Wallet, UserCheck, Receipt, Calendar, Phone, ShoppingCart, Camera, Play, Briefcase, Music, Download, FileText, FileSpreadsheet, ChevronRight, ChevronDown, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PLATFORM_MULTISELECT_OPTIONS, PLATFORM_TO_UTM, TIER3_METRIC_IDS } from "@/lib/metasBudgetConfig";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
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
  realizadoAnterior?: number | null;
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
  banner?: React.ReactNode;
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
  dealsGanhos: number;
  contratosGanhos: number;
}

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
  dealsGanhos: number;
  contratosGanhos: number;
}

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
  sessoes: number;
  leads: number;
  mqls: number;
  cpl: number;
  cpmql: number;
  percMqls: number;
  ra?: number;
  raMql?: number;
  raNmql?: number;
  rr?: number;
  rrMql?: number;
  rrNmql?: number;
  cpra?: number | null;
  cpraMql?: number | null;
  cpraNmql?: number | null;
  cprr?: number | null;
  cprrMql?: number | null;
  cprrNmql?: number | null;
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

// Cálculos de inteligência de meta
function calcDesvioMeta(orcado: number | null, realizado: number | null, propDias: number): number | null {
  if (orcado === null || realizado === null || orcado === 0 || propDias === 0) return null;
  const esperado = orcado * propDias;
  return ((realizado - esperado) / esperado) * 100;
}

function calcPrevisaoAsIs(realizado: number | null, propDias: number): number | null {
  if (realizado === null || propDias === 0) return null;
  return realizado / propDias;
}

// Recálculo Meta para métricas absolutas: retorna o % de aceleração necessária
// nos dias restantes em relação ao ritmo planejado. Ex: +80,9% = precisa performar
// 80,9% acima do ritmo orçado para fechar o mês na meta.
function calcRecalculoMeta(orcado: number | null, realizado: number | null, diasRestantes: number, totalDias: number): number | null {
  if (orcado === null || realizado === null) return null;
  if (orcado === 0 || totalDias === 0) return null;
  if (diasRestantes <= 0) return null;
  const falta = orcado - realizado;
  if (falta <= 0) return 0;
  const esperadoNoRestante = orcado * (diasRestantes / totalDias);
  if (esperadoNoRestante === 0) return null;
  return (falta / esperadoNoRestante - 1) * 100;
}

// Recálculo Meta para métricas-taxa: gap em pontos percentuais (orçado − realizado).
// Valores armazenados em decimal (0,30 = 30%), então multiplicamos por 100 para retornar pp.
function calcRecalculoMetaPercent(orcado: number | null, realizado: number | null): number | null {
  if (orcado === null || realizado === null) return null;
  return (orcado - realizado) * 100;
}

// ===== Export helpers =====

interface ExportParams {
  sections: MetricSection[];
  viewName: string;
  dateLabel: string;
  propDias: number;
  diasRestantes: number;
  totalDias: number;
  periodo: string;
  plataformas: string;
  produtos: string;
  origem: string;
  contagem: string;
}

// Converte URL do Linktree em rótulo curto e legível.
// Linktree não envia link_text via GA4, então a melhor heurística é usar
// hostname + pathname (sem query/UTMs), com casos especiais nos domínios mais comuns.
function humanizeLinktreeLink(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.replace(/\/$/, '');
    if (host === 'forms.clickup.com') return 'Formulário ClickUp';
    if (host === 'api.whatsapp.com') return 'WhatsApp';
    if (host.endsWith('youtube.com')) {
      const channel = path.match(/^\/(@[\w.-]+)/)?.[1];
      return channel ? `YouTube ${channel}` : 'YouTube';
    }
    return path && path !== '' ? `${host}${path}` : host;
  } catch {
    return url;
  }
}

function buildOrcadoRealizadoExportRows(
  params: ExportParams,
  mode: 'csv' | 'xlsx'
): { rows: (string | number | null)[][]; header: string[] } {
  const header = ['Métrica', 'Orçado', 'Realizado', '% Atingido', 'Desvio Meta', 'Previsão As Is', 'Recálculo Meta'];
  const rows: (string | number | null)[][] = [];

  // Metadata rows
  rows.push(['Período', params.periodo]);
  rows.push(['Visualização', params.viewName]);
  rows.push(['Plataforma', params.plataformas]);
  rows.push(['Produto / Funil', params.produtos]);
  rows.push(['Contagem', params.contagem]);
  rows.push([]);

  const fmt = (val: number | null, f: 'currency' | 'number' | 'percent'): string | number | null => {
    if (val === null) return mode === 'csv' ? '-' : null;
    if (mode === 'xlsx') return val;
    return formatValue(val, f);
  };

  const fmtPct = (val: number | null): string | number | null => {
    if (val === null) return mode === 'csv' ? '-' : null;
    if (mode === 'xlsx') return val / 100;
    return `${val.toFixed(1)}%`;
  };

  const fmtDesvio = (val: number | null): string | number | null => {
    if (val === null) return mode === 'csv' ? '-' : null;
    if (mode === 'xlsx') return val / 100;
    return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
  };

  const fmtRecalculo = (val: number | null, isPp: boolean): string | number | null => {
    if (val === null) return mode === 'csv' ? '-' : null;
    if (mode === 'xlsx') return val / 100;
    const suffix = isPp ? 'pp' : '%';
    return `${val >= 0 ? '+' : ''}${val.toFixed(1)}${suffix}`;
  };

  for (const section of params.sections) {
    rows.push([section.title, '', '', '', '', '', '']);

    for (const m of section.metrics) {
      const orcadoNum = typeof m.orcado === 'number' ? m.orcado : null;
      const realizadoNum = typeof m.realizado === 'number' ? m.realizado : null;

      const isPercent = m.format === 'percent';
      const desvio = isPercent
        ? (orcadoNum !== null && realizadoNum !== null && orcadoNum !== 0
            ? ((realizadoNum - orcadoNum) / orcadoNum) * 100
            : null)
        : calcDesvioMeta(orcadoNum, realizadoNum, params.propDias);
      const previsao = isPercent ? null : calcPrevisaoAsIs(realizadoNum, params.propDias);
      const recalculo = isPercent
        ? calcRecalculoMetaPercent(orcadoNum, realizadoNum)
        : calcRecalculoMeta(orcadoNum, realizadoNum, params.diasRestantes, params.totalDias);

      rows.push([
        m.name,
        fmt(orcadoNum, m.format),
        fmt(realizadoNum, m.format),
        fmtPct(m.percentual),
        fmtDesvio(desvio),
        fmt(previsao, m.format),
        fmtRecalculo(recalculo, isPercent),
      ]);
    }

    rows.push([]);
  }

  return { rows, header };
}

function exportOrcadoRealizadoCSV(params: ExportParams) {
  const { rows, header } = buildOrcadoRealizadoExportRows(params, 'csv');
  const csvRows = rows.map(r => r.map(c => `"${c ?? ''}"`).join(';'));
  const csv = [header.map(h => `"${h}"`).join(';'), ...csvRows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `OrcadoRealizado_${params.viewName}_${params.dateLabel}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportOrcadoRealizadoXLSX(params: ExportParams) {
  const XLSX = await import('xlsx');
  const { rows, header } = buildOrcadoRealizadoExportRows(params, 'xlsx');
  const wsData = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 40 }, // Métrica
    { wch: 16 }, // Orçado
    { wch: 16 }, // Realizado
    { wch: 14 }, // % Atingido
    { wch: 14 }, // Desvio Meta
    { wch: 18 }, // Previsão As Is
    { wch: 18 }, // Recálculo Meta
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, params.viewName);
  XLSX.writeFile(wb, `OrcadoRealizado_${params.viewName}_${params.dateLabel}.xlsx`);
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
  sessoes: 0,
  taxaConversaoPagina: 0,
  connectRate: 0,
  leads: 0,
  mqls: 0,
  cpl: 0,
  cpmql: 0,
  percMqls: 0,
};

// Platform-specific defaults for Aprofundado view
const DEFAULT_ORCADO_META_ADS = {
  investimento: 0, cpm: 0, ctr: 0, videoHook: 0, videoHold: 0, videoP75: 0, videoP100: 0,
  visualizacoesPagina: 0, sessoes: 0, taxaConversaoPagina: 0, connectRate: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

const DEFAULT_ORCADO_GOOGLE_ADS = {
  investimento: 0, cpm: 0, ctr: 0,
  visualizacoesPagina: 0, sessoes: 0, taxaConversaoPagina: 0, connectRate: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

const DEFAULT_ORCADO_INSTAGRAM = {
  comecaramSeguir: 0, deixaramSeguir: 0, percPerdaSeguidores: 0,
  deltaSeguidores: 0, totalSeguidores: 0, percCrescimentoSeguidores: 0,
  visualizacoesTotais: 0, percVisualizacoesOrganicas: 0, visualizacoesOrganicas: 0,
  percVisualizacoesPagas: 0, visualizacoesPagas: 0,
  alcanceTotal: 0, alcanceOrganico: 0, alcancePago: 0,
  frequenciaAlcance: 0, ctrAlcanceVisitas: 0, visitasPerfil: 0,
  percEngajamento: 0, interacoes: 0, ctrAlcanceCliques: 0,
  ctrVisitasCliques: 0, cliquesLinkBio: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

const DEFAULT_ORCADO_YOUTUBE = {
  inscritos: 0, crescimentoInscritos: 0, visualizacoes: 0, horasAssistidas: 0,
  ctrImpressoes: 0, retencaoMedia: 0, curtidas: 0, comentarios: 0,
  compartilhamentos: 0, videosPublicados: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

const DEFAULT_ORCADO_LINKEDIN = {
  seguidores: 0, crescimentoSeguidores: 0, impressoes: 0, cliquesPost: 0,
  taxaEngajamento: 0, postsPublicados: 0, reacoes: 0, comentarios: 0,
  compartilhamentos: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

const DEFAULT_ORCADO_TIKTOK = {
  seguidores: 0, crescimentoSeguidores: 0, visualizacoes: 0,
  curtidas: 0, comentarios: 0, compartilhamentos: 0, videosPublicados: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

const DEFAULT_ORCADO_TIKTOK_ADS = {
  investimento: 0, cpm: 0, ctr: 0, impressoes: 0, cliques: 0,
  visualizacoesPagina: 0, sessoes: 0, taxaConversaoPagina: 0, connectRate: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

const DEFAULT_ORCADO_LINKEDIN_ADS = {
  investimento: 0, cpm: 0, ctr: 0, impressoes: 0, cliques: 0,
  visualizacoesPagina: 0, sessoes: 0, taxaConversaoPagina: 0, connectRate: 0,
  // Funnel
  leads: 0, mqls: 0, cpl: 0, cpmql: 0, percMqls: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0,
  percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: 0, aov: 0,
  receita: 0, receitaPontual: 0, receitaRecorrente: 0,
  cac: 0, cacUnico: 0, cacContrato: 0,
};

// Mapeamento de metric.id → segmento/chave no banco de budgets
const METRIC_BUDGET_MAP: Record<string, { segment: string; key: string }> = {
  // MQL
  mql_ra_perc: { segment: 'mql', key: 'percReuniaoAgendada' },
  mql_ra_num: { segment: 'mql', key: 'reunioesAgendadas' },
  mql_rr_num: { segment: 'mql', key: 'reunioesRealizadas' },
  mql_noshow: { segment: 'mql', key: 'percNoShow' },
  mql_rr_perc: { segment: 'mql', key: 'percRr' },
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
  nmql_rr_perc: { segment: 'nao_mql', key: 'percRr' },
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
  // Ads (consolidated)
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
  // Meta Ads (platform-specific)
  ...Object.fromEntries(['investimento','cpm','ctr','videoHook','videoHold','videoP75','videoP100','visualizacoesPagina','taxaConversaoPagina','connectRate','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`meta_${k}`, { segment: 'meta_ads', key: k }])),
  // Google Ads (platform-specific)
  ...Object.fromEntries(['investimento','cpm','ctr','visualizacoesPagina','taxaConversaoPagina','connectRate','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`gads_${k}`, { segment: 'google_ads', key: k }])),
  // Instagram (platform-specific)
  ...Object.fromEntries(['comecaramSeguir','deixaramSeguir','percPerdaSeguidores','deltaSeguidores','totalSeguidores','percCrescimentoSeguidores','visualizacoesTotais','percVisualizacoesOrganicas','visualizacoesOrganicas','percVisualizacoesPagas','visualizacoesPagas','alcanceTotal','alcanceOrganico','alcancePago','frequenciaAlcance','ctrAlcanceVisitas','visitasPerfil','percEngajamento','interacoes','ctrAlcanceCliques','ctrVisitasCliques','cliquesLinkBio','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`ig_${k}`, { segment: 'instagram', key: k }])),
  // YouTube (platform-specific)
  ...Object.fromEntries(['inscritos','crescimentoInscritos','visualizacoes','horasAssistidas','ctrImpressoes','retencaoMedia','curtidas','comentarios','compartilhamentos','videosPublicados','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`yt_${k}`, { segment: 'youtube', key: k }])),
  // LinkedIn (platform-specific)
  ...Object.fromEntries(['seguidores','crescimentoSeguidores','impressoes','cliquesPost','taxaEngajamento','postsPublicados','reacoes','comentarios','compartilhamentos','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`li_${k}`, { segment: 'linkedin', key: k }])),
  // TikTok (platform-specific)
  ...Object.fromEntries(['seguidores','crescimentoSeguidores','visualizacoes','curtidas','comentarios','compartilhamentos','videosPublicados','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`tt_${k}`, { segment: 'tiktok', key: k }])),
  // TikTok Ads (platform-specific — mídia paga)
  ...Object.fromEntries(['investimento','cpm','ctr','impressoes','cliques','visualizacoesPagina','sessoes','taxaConversaoPagina','connectRate','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`tta_${k}`, { segment: 'tiktok_ads', key: k }])),
  // LinkedIn Ads (platform-specific — mídia paga)
  ...Object.fromEntries(['investimento','cpm','ctr','impressoes','cliques','visualizacoesPagina','sessoes','taxaConversaoPagina','connectRate','leads','mqls','cpl','cpmql','percMqls','percRa','percRaMql','percRaNmql','percRr','percRrMql','percRrNmql','percRrVendas','percRrMqlVendas','percRrNmqlVendas','negocioGanho','leadTime','aov','receita','receitaPontual','receitaRecorrente','cac','cacUnico','cacContrato'].map(k => [`lia_${k}`, { segment: 'linkedin_ads', key: k }])),
};

const PERCENT_METRICS = new Set([
  'mql_ra_perc', 'mql_noshow', 'mql_taxa_vendas', 'mql_tx_recorrente', 'mql_tx_implantacao', 'mql_rr_perc',
  'nmql_ra_perc', 'nmql_noshow', 'nmql_taxa_vendas', 'nmql_tx_recorrente', 'nmql_tx_implantacao', 'nmql_rr_perc',
  'ctr', 'perc_mqls',
  // Meta Ads
  'meta_ctr', 'meta_videoP75', 'meta_videoP100',
  'meta_taxaConversaoPagina', 'meta_connectRate', 'meta_percMqls',
  'meta_percRa', 'meta_percRaMql', 'meta_percRaNmql', 'meta_percRr', 'meta_percRrMql', 'meta_percRrNmql',
  'meta_percRrVendas', 'meta_percRrMqlVendas', 'meta_percRrNmqlVendas',
  // Google Ads
  'gads_ctr', 'gads_taxaConversaoPagina', 'gads_connectRate', 'gads_percMqls',
  'gads_percRa', 'gads_percRaMql', 'gads_percRaNmql', 'gads_percRr', 'gads_percRrMql', 'gads_percRrNmql',
  'gads_percRrVendas', 'gads_percRrMqlVendas', 'gads_percRrNmqlVendas',
  // Instagram
  'ig_percPerdaSeguidores', 'ig_percCrescimentoSeguidores',
  'ig_percVisualizacoesOrganicas', 'ig_percVisualizacoesPagas',
  'ig_ctrAlcanceVisitas', 'ig_percEngajamento', 'ig_ctrAlcanceCliques', 'ig_ctrVisitasCliques',
  'ig_percMqls', 'ig_percRa', 'ig_percRaMql', 'ig_percRaNmql',
  'ig_percRr', 'ig_percRrMql', 'ig_percRrNmql',
  'ig_percRrVendas', 'ig_percRrMqlVendas', 'ig_percRrNmqlVendas',
  // YouTube
  'yt_ctrImpressoes', 'yt_retencaoMedia', 'yt_percMqls',
  'yt_percRa', 'yt_percRaMql', 'yt_percRaNmql', 'yt_percRr', 'yt_percRrMql', 'yt_percRrNmql',
  'yt_percRrVendas', 'yt_percRrMqlVendas', 'yt_percRrNmqlVendas',
  // LinkedIn
  'li_taxaEngajamento', 'li_percMqls',
  'li_percRa', 'li_percRaMql', 'li_percRaNmql', 'li_percRr', 'li_percRrMql', 'li_percRrNmql',
  'li_percRrVendas', 'li_percRrMqlVendas', 'li_percRrNmqlVendas',
  // TikTok
  'tt_percMqls',
  'tt_percRa', 'tt_percRaMql', 'tt_percRaNmql', 'tt_percRr', 'tt_percRrMql', 'tt_percRrNmql',
  'tt_percRrVendas', 'tt_percRrMqlVendas', 'tt_percRrNmqlVendas',
  // TikTok Ads
  'tta_ctr', 'tta_taxaConversaoPagina', 'tta_connectRate', 'tta_percMqls',
  'tta_percRa', 'tta_percRaMql', 'tta_percRaNmql', 'tta_percRr', 'tta_percRrMql', 'tta_percRrNmql',
  'tta_percRrVendas', 'tta_percRrMqlVendas', 'tta_percRrNmqlVendas',
  // LinkedIn Ads
  'lia_ctr', 'lia_taxaConversaoPagina', 'lia_connectRate', 'lia_percMqls',
  'lia_percRa', 'lia_percRaMql', 'lia_percRaNmql', 'lia_percRr', 'lia_percRrMql', 'lia_percRrNmql',
  'lia_percRrVendas', 'lia_percRrMqlVendas', 'lia_percRrNmqlVendas',
]);

// Métricas onde "menor é melhor" — cores invertidas na tabela
const INVERTED_METRIC_IDS = new Set([
  // Custo por resultado
  'cpm', 'cpl', 'cpmql',
  'meta_cpm', 'meta_cpl', 'meta_cpmql',
  'gads_cpm', 'gads_cpl', 'gads_cpmql',
  'ig_cpl', 'ig_cpmql',
  'yt_cpl', 'yt_cpmql',
  'li_cpl', 'li_cpmql',
  'tt_cpl', 'tt_cpmql',
  'tta_cpm', 'tta_cpl', 'tta_cpmql',
  'lia_cpm', 'lia_cpl', 'lia_cpmql',
  // CAC
  'total_cac_ads', 'total_cac_contrato',
  'meta_cac', 'meta_cacUnico', 'meta_cacContrato',
  'gads_cac', 'gads_cacUnico', 'gads_cacContrato',
  'ig_cac', 'ig_cacUnico', 'ig_cacContrato',
  'yt_cac', 'yt_cacUnico', 'yt_cacContrato',
  'li_cac', 'li_cacUnico', 'li_cacContrato',
  'tt_cac', 'tt_cacUnico', 'tt_cacContrato',
  'tta_cac', 'tta_cacUnico', 'tta_cacContrato',
  'lia_cac', 'lia_cacUnico', 'lia_cacContrato',
  // No-show
  'mql_noshow', 'nmql_noshow', 'total_noshow',
  // Lead time
  'meta_leadTime', 'gads_leadTime', 'ig_leadTime', 'yt_leadTime', 'li_leadTime', 'tt_leadTime', 'tta_leadTime', 'lia_leadTime',
  // Perda de seguidores
  'ig_percPerdaSeguidores', 'ig_deixaramSeguir',
]);

// Merge realizadoAnterior do array `prev` no array `cur` casando por id.
function mergePrevRealizado(cur: Metric[], prev: Metric[]): Metric[] {
  const prevMap = new Map<string, number | null>();
  for (const m of prev) {
    prevMap.set(m.id, typeof m.realizado === 'number' ? m.realizado : null);
  }
  return cur.map(m => ({
    ...m,
    realizadoAnterior: prevMap.has(m.id) ? prevMap.get(m.id)! : null,
  }));
}

export default function GrowthOrcadoRealizado() {
  usePageTitle("Gestão de Metas");
  useSetPageInfo("Gestão de Metas", "Controle de Métricas de Marketing e Vendas");
  
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const hoje = new Date();
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(hoje),
    to: endOfMonth(hoje),
  });
  const [activeSection, setActiveSection] = useState<'consolidado' | 'aprofundado'>('consolidado');
  const [selectedPlataformas, setSelectedPlataformas] = useState<string[]>([]);

  const [selectedProdutos, setSelectedProdutos] = useState<string[]>([]);
  // Editing is only allowed when at most 1 product and 1 platform is selected
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
  const [expandedLinkBio, setExpandedLinkBio] = useState(false);
  // Expand state pra linhas IG com breakdown por origem (Linktree / Contato IG / Social Selling)
  const [expandedIgOrigem, setExpandedIgOrigem] = useState<Record<'leads' | 'mqls' | 'negocioGanho' | 'receita', boolean>>({
    leads: false, mqls: false, negocioGanho: false, receita: false,
  });
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

  // Proporção de dias passados/restantes para cálculos de meta
  const { propDias, diasRestantes, totalDias } = useMemo(() => {
    const start = parse(dateRange.startDate, 'yyyy-MM-dd', new Date());
    const end = endOfMonth(start);
    const total = differenceInCalendarDays(end, start) + 1;
    const today = new Date();
    const elapsed = Math.min(differenceInCalendarDays(today, start) + 1, total);
    return {
      propDias: elapsed / total,
      diasRestantes: Math.max(total - elapsed, 0),
      totalDias: total,
    };
  }, [dateRange.startDate]);

  const prevDateRange = useMemo(() => {
    if (!compareEnabled || !compareRange?.from || !compareRange?.to) {
      return null;
    }
    return {
      startDate: format(compareRange.from, 'yyyy-MM-dd'),
      endDate: format(compareRange.to, 'yyyy-MM-dd'),
    };
  }, [compareEnabled, compareRange]);

  const compareActive = !!prevDateRange;
  const [compareColumnsOpen, setCompareColumnsOpen] = useState(false);
  const showCompareColumns = compareActive && compareColumnsOpen;
  const compareTableColSpan = showCompareColumns ? 10 : 7;

  // Label dos dois períodos no cabeçalho da tabela (ex.: "01/05/2026 – 19/05/2026")
  const currentRangeLabel = useMemo(() => {
    if (!customDateRange?.from || !customDateRange?.to) return null;
    return `${format(customDateRange.from, 'dd/MM/yyyy')} – ${format(customDateRange.to, 'dd/MM/yyyy')}`;
  }, [customDateRange]);
  const compareRangeLabel = useMemo(() => {
    if (!compareRange?.from || !compareRange?.to) return null;
    return `${format(compareRange.from, 'dd/MM/yyyy')} – ${format(compareRange.to, 'dd/MM/yyyy')}`;
  }, [compareRange]);

  // Fetch budgets from DB (falls back to defaults)
  const { data: budgetsData } = useQuery<Record<string, any>>({
    queryKey: ['/api/growth/orcado-realizado/budgets', dateRange.startDate, dateRange.endDate, selectedProdutos],
    queryFn: async () => {
      const budgetFunil = selectedProdutos.length === 1 ? selectedProdutos[0] : 'todos';
      const params = new URLSearchParams({
        startDate: format(customDateRange?.from || startOfMonth(parse(selectedMonth, 'yyyy-MM', new Date())), 'yyyy-MM'),
        endDate: format(customDateRange?.to || endOfMonth(parse(selectedMonth, 'yyyy-MM', new Date())), 'yyyy-MM'),
        funil: budgetFunil,
      });
      const res = await fetch(`/api/growth/orcado-realizado/budgets?${params}`, { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const ORCADO_MQL = useMemo(() => ({ ...DEFAULT_ORCADO_MQL, ...(budgetsData?.mql || {}) }), [budgetsData]);
  const ORCADO_NAO_MQL = useMemo(() => ({ ...DEFAULT_ORCADO_NAO_MQL, ...(budgetsData?.nao_mql || {}) }), [budgetsData]);
  const ORCADO_ADS = useMemo(() => ({ ...DEFAULT_ORCADO_ADS, ...(budgetsData?.ads || {}) }), [budgetsData]);
  // Platform-specific budgets
  const ORCADO_META_ADS = useMemo(() => ({ ...DEFAULT_ORCADO_META_ADS, ...(budgetsData?.meta_ads || {}) }), [budgetsData]);
  const ORCADO_GOOGLE_ADS = useMemo(() => ({ ...DEFAULT_ORCADO_GOOGLE_ADS, ...(budgetsData?.google_ads || {}) }), [budgetsData]);
  const ORCADO_INSTAGRAM = useMemo(() => ({ ...DEFAULT_ORCADO_INSTAGRAM, ...(budgetsData?.instagram || {}) }), [budgetsData]);
  const ORCADO_YOUTUBE = useMemo(() => ({ ...DEFAULT_ORCADO_YOUTUBE, ...(budgetsData?.youtube || {}) }), [budgetsData]);
  const ORCADO_LINKEDIN = useMemo(() => ({ ...DEFAULT_ORCADO_LINKEDIN, ...(budgetsData?.linkedin || {}) }), [budgetsData]);
  const ORCADO_TIKTOK = useMemo(() => ({ ...DEFAULT_ORCADO_TIKTOK, ...(budgetsData?.tiktok || {}) }), [budgetsData]);
  const ORCADO_TIKTOK_ADS = useMemo(() => ({ ...DEFAULT_ORCADO_TIKTOK_ADS, ...(budgetsData?.tiktok_ads || {}) }), [budgetsData]);
  const ORCADO_LINKEDIN_ADS = useMemo(() => ({ ...DEFAULT_ORCADO_LINKEDIN_ADS, ...(budgetsData?.linkedin_ads || {}) }), [budgetsData]);
  const ORCADO_TOTAL = useMemo(() => {
    const totalRA = ORCADO_MQL.reunioesAgendadas + ORCADO_NAO_MQL.reunioesAgendadas;
    const totalRR = ORCADO_MQL.reunioesRealizadas + ORCADO_NAO_MQL.reunioesRealizadas;
    // Estimar total de leads a partir de %RA: leads = RA / %RA
    const mqlLeads = ORCADO_MQL.percReuniaoAgendada > 0 ? ORCADO_MQL.reunioesAgendadas / ORCADO_MQL.percReuniaoAgendada : 0;
    const nmqlLeads = ORCADO_NAO_MQL.percReuniaoAgendada > 0 ? ORCADO_NAO_MQL.reunioesAgendadas / ORCADO_NAO_MQL.percReuniaoAgendada : 0;
    const totalLeads = mqlLeads + nmqlLeads;

    return {
      percRA: totalLeads > 0 ? totalRA / totalLeads : 0.2317,
      reunioesAgendadas: totalRA,
      reunioesRealizadas: totalRR,
      percNoShow: 0.05,
      percRr: totalLeads > 0 ? totalRR / totalLeads : undefined,
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
  }, [ORCADO_MQL, ORCADO_NAO_MQL]);

  const renderOrcadoCell = (metric: Metric) => {
    // For Tier 3 metrics with no budget, show "—" instead of 0
    if (TIER3_METRIC_IDS.has(metric.id) && (metric.orcado === 0 || metric.orcado === null)) {
      return '—';
    }
    return formatValue(metric.orcado, metric.format);
  };

  // Helpers para colunas de comparação
  const renderDeltaAbs = (
    atual: number | null,
    anterior: number | null | undefined,
    format: 'currency' | 'number' | 'percent',
    isInverted: boolean,
  ) => {
    if (atual === null || anterior === null || anterior === undefined) {
      return <span className="text-muted-foreground">—</span>;
    }
    const diff = atual - anterior;
    const isGood = isInverted ? diff <= 0 : diff >= 0;
    const color = diff === 0
      ? ''
      : isGood
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';
    const sign = diff > 0 ? '+' : '';
    return <span className={color}>{sign}{formatValue(diff, format)}</span>;
  };

  const renderDeltaPct = (
    atual: number | null,
    anterior: number | null | undefined,
    isInverted: boolean,
  ) => {
    if (atual === null || anterior === null || anterior === undefined || anterior === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    const pct = ((atual - anterior) / Math.abs(anterior)) * 100;
    const isGood = isInverted ? pct <= 0 : pct >= 0;
    const color = pct === 0
      ? ''
      : isGood
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';
    const sign = pct > 0 ? '+' : '';
    return <span className={color}>{sign}{pct.toFixed(1)}%</span>;
  };

  // Shared table body renderer for Consolidado & Aprofundado
  const renderMetricTableBody = (sections: MetricSection[]) =>
    sections.map((section, sIdx) => (
      <Fragment key={`section-${section.title}`}>
        {/* Section header */}
        <TableRow className="bg-muted/50 border-l-4 border-l-primary/40">
          <TableCell colSpan={compareTableColSpan} className="text-xs font-semibold uppercase tracking-wide py-2.5 text-muted-foreground">
            {section.title}
          </TableCell>
        </TableRow>
        {section.banner && (
          <TableRow className="bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-l-amber-400 dark:border-l-amber-500">
            <TableCell colSpan={compareTableColSpan} className="text-xs py-2 text-amber-900 dark:text-amber-200">
              {section.banner}
            </TableCell>
          </TableRow>
        )}
        {/* Metric rows */}
        {section.metrics.map(m => {
          const isPercent = m.format === 'percent';
          const isInverted = INVERTED_METRIC_IDS.has(m.id);
          const orcadoNum = typeof m.orcado === 'number' ? m.orcado : null;
          const realizadoNum = typeof m.realizado === 'number' ? m.realizado : null;

          // Cores do % Atingido: invertidas para métricas de custo
          const percColor = (() => {
            if (m.percentual === null) return '';
            if (isInverted) {
              if (m.percentual <= 100) return "text-emerald-600 dark:text-emerald-400";
              if (m.percentual <= 120) return "text-amber-600 dark:text-amber-400";
              return "text-red-600 dark:text-red-400";
            }
            if (m.percentual >= 100) return "text-emerald-600 dark:text-emerald-400";
            if (m.percentual >= 80) return "text-amber-600 dark:text-amber-400";
            return "text-red-600 dark:text-red-400";
          })();

          const barColor = (() => {
            if (m.percentual === null) return "bg-muted";
            if (isInverted) {
              return m.percentual <= 100 ? "bg-emerald-500" : m.percentual <= 120 ? "bg-amber-500" : "bg-red-500";
            }
            return m.percentual >= 100 ? "bg-emerald-500" : m.percentual >= 80 ? "bg-amber-500" : "bg-red-500";
          })();

          // BUG 1 fix: métricas de % não escalam com dias — Desvio = diferença simples
          const desvio = isPercent
            ? (orcadoNum !== null && realizadoNum !== null && orcadoNum !== 0
                ? ((realizadoNum - orcadoNum) / orcadoNum) * 100
                : null)
            : calcDesvioMeta(orcadoNum, realizadoNum, propDias);

          // Para métricas invertidas, desvio positivo = ruim
          const desvioColor = (() => {
            if (desvio === null) return '';
            if (isInverted) return desvio <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
            return desvio >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
          })();

          const isLinkBio = m.id === 'ig_cliquesLinkBio';
          const linkBioBreakdown = instagramDetailData?.cliquesPorLink ?? [];
          const linkBioByDomain = instagramDetailData?.cliquesPorDominio ?? [];
          const linkBioFonte = instagramDetailData?.cliquesLinkBioFonte;
          const showExpand = isLinkBio && (linkBioBreakdown.length > 0 || linkBioByDomain.length > 0);
          const expanded = isLinkBio && expandedLinkBio;

          // IG breakdown por origem (Linktree / Contato Instagram / Social Selling).
          // Aplica em linhas IG-prefixadas (ig_leads, ig_mqls, ig_negocioGanho) e em
          // linhas TOTAL quando filtro é único e = Instagram (TOTAL == só IG nesse caso).
          const isIgOnlyFilter = selectedPlataformas.length === 1 && selectedPlataformas[0] === 'instagram';
          const igOrigemFieldMap: Record<string, 'leads' | 'mqls' | 'negocioGanho' | 'receita'> = {
            ig_leads: 'leads',
            ig_mqls: 'mqls',
            ig_negocioGanho: 'negocioGanho',
            ...(isIgOnlyFilter ? {
              total_novos_clientes: 'negocioGanho' as const,
              total_faturamento: 'receita' as const,
            } : {}),
          };
          const igOrigemField = igOrigemFieldMap[m.id];
          const igOrigemRows = instagramDetailData?.leadsPorOrigem ?? [];
          const igOrigemRowsPrev = prevInstagramDetailData?.leadsPorOrigem ?? [];
          const showIgOrigemExpand = !!igOrigemField && igOrigemRows.length > 0;
          const igOrigemExpanded = !!igOrigemField && expandedIgOrigem[igOrigemField as keyof typeof expandedIgOrigem];

          return (
            <Fragment key={m.id}>
            <TableRow className={cn(
              "hover:bg-muted/30 transition-colors",
              !isPercent && "bg-blue-500/[0.04] dark:bg-blue-400/[0.03]"
            )}>
              <TableCell className="text-sm font-medium">
                {showExpand ? (
                  <button
                    type="button"
                    onClick={() => setExpandedLinkBio(v => !v)}
                    className="inline-flex items-center gap-1.5 text-left hover:text-primary transition-colors"
                    data-testid="toggle-clicks-breakdown"
                  >
                    {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span>{m.name}</span>
                    {linkBioFonte === 'linktree_ga4' && (
                      <span className="text-[10px] font-normal text-muted-foreground ml-1 px-1.5 py-0.5 rounded bg-muted">via Linktree</span>
                    )}
                  </button>
                ) : showIgOrigemExpand ? (
                  <button
                    type="button"
                    onClick={() => setExpandedIgOrigem(prev => ({ ...prev, [igOrigemField!]: !prev[igOrigemField!] }))}
                    className="inline-flex items-center gap-1.5 text-left hover:text-primary transition-colors"
                    data-testid={`toggle-ig-origem-${igOrigemField}`}
                  >
                    {igOrigemExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span>{m.name}</span>
                  </button>
                ) : (
                  m.name
                )}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {renderOrcadoCell(m)}
              </TableCell>
              <TableCell className="text-right text-sm font-medium">
                {formatValue(m.realizado, m.format)}
              </TableCell>
              {showCompareColumns && (
                <>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {m.realizadoAnterior !== null && m.realizadoAnterior !== undefined
                      ? formatValue(m.realizadoAnterior, m.format)
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {renderDeltaAbs(realizadoNum, m.realizadoAnterior, m.format, isInverted)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {renderDeltaPct(realizadoNum, m.realizadoAnterior, isInverted)}
                  </TableCell>
                </>
              )}
              <TableCell className={cn("text-right text-sm font-semibold", percColor)}>
                <div className="flex flex-col items-end gap-0.5">
                  <span>{m.percentual !== null ? `${m.percentual.toFixed(1)}%` : '-'}</span>
                  {m.percentual !== null && (
                    <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", barColor)}
                        style={{ width: `${Math.min(isInverted ? (200 - m.percentual) : m.percentual, 100)}%` }} />
                    </div>
                  )}
                </div>
              </TableCell>
              {/* Desvio Meta */}
              <TableCell className={cn("text-right text-sm font-semibold", desvioColor)}>
                {desvio !== null ? `${desvio >= 0 ? '+' : ''}${desvio.toFixed(1)}%` : '-'}
              </TableCell>
              {/* Previsão As Is — não se aplica a métricas de taxa */}
              <TableCell className="text-right text-sm font-medium">
                {isPercent ? '-' : (() => {
                  const p = calcPrevisaoAsIs(realizadoNum, propDias);
                  return p !== null ? formatValue(p, m.format) : '-';
                })()}
              </TableCell>
              {/* Recálculo Meta — % de aceleração necessária a partir de hoje */}
              {(() => {
                const r = isPercent
                  ? calcRecalculoMetaPercent(orcadoNum, realizadoNum)
                  : calcRecalculoMeta(orcadoNum, realizadoNum, diasRestantes, totalDias);
                const recalculoColor = (() => {
                  if (r === null) return '';
                  if (isPercent) {
                    if (isInverted) return r >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
                    return r <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
                  }
                  if (r <= 0) return "text-emerald-600 dark:text-emerald-400";
                  if (r <= 30) return "text-amber-600 dark:text-amber-400";
                  return "text-red-600 dark:text-red-400";
                })();
                const formatted = r === null
                  ? '-'
                  : isPercent
                    ? `${r >= 0 ? '+' : ''}${r.toFixed(1)}pp`
                    : `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`;
                return (
                  <TableCell className={cn("text-right text-sm font-semibold", recalculoColor)}>
                    {formatted}
                  </TableCell>
                );
              })()}
            </TableRow>
            {expanded && linkBioBreakdown.slice(0, 15).map((row, idx) => (
              <TableRow key={`linkbio-${idx}`} className="bg-muted/20 hover:bg-muted/30" data-testid="row-clicks-breakdown-link">
                <TableCell className="text-sm pl-10 text-muted-foreground">
                  <a
                    href={row.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={row.linkUrl}
                    className="hover:text-primary hover:underline"
                  >
                    {humanizeLinktreeLink(row.linkUrl)}
                  </a>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-right text-sm font-medium">{row.clicks.toLocaleString('pt-BR')}</TableCell>
                {showCompareColumns && (
                  <>
                    <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                  </>
                )}
                <TableCell className="text-right text-sm text-muted-foreground">-</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">-</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">-</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">-</TableCell>
              </TableRow>
            ))}
            {expanded && linkBioFonte !== 'linktree_ga4' && (
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableCell colSpan={compareTableColSpan} className="text-[11px] text-muted-foreground italic pl-10 py-2">
                  Fonte: Instagram (profile_links_taps). Detalhamento por link disponível apenas via Linktree GA4.
                </TableCell>
              </TableRow>
            )}
            {igOrigemExpanded && igOrigemField && igOrigemRows.map((row) => {
              const valorAtual = row[igOrigemField as keyof typeof row] as number;
              const prevRow = igOrigemRowsPrev.find((p) => p.origem === row.origem);
              const valorAnterior = prevRow ? (prevRow[igOrigemField as keyof typeof prevRow] as number) : null;
              const subFormat = igOrigemField === 'receita' ? 'currency' : 'number';
              return (
                <TableRow key={`ig-origem-${m.id}-${row.origem}`} className="bg-muted/20 hover:bg-muted/30" data-testid={`row-ig-origem-${igOrigemField}-${row.origem}`}>
                  <TableCell className="text-sm pl-10 text-muted-foreground">{row.label}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatValue(valorAtual, subFormat)}</TableCell>
                  {showCompareColumns && (
                    <>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {valorAnterior !== null && valorAnterior !== undefined
                          ? formatValue(valorAnterior, subFormat)
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {renderDeltaAbs(valorAtual, valorAnterior, subFormat, isInverted)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {renderDeltaPct(valorAtual, valorAnterior, isInverted)}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-right text-sm text-muted-foreground">-</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">-</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">-</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">-</TableCell>
                </TableRow>
              );
            })}
            </Fragment>
          );
        })}
        {/* Section separator */}
        {sIdx < sections.length - 1 && (
          <TableRow className="h-2 border-0 hover:bg-transparent">
            <TableCell colSpan={compareTableColSpan} className="p-0 h-2" />
          </TableRow>
        )}
      </Fragment>
    ));

  const { data: funis } = useQuery<string[]>({
    queryKey: ['/api/growth/orcado-realizado/funis'],
    queryFn: async () => {
      const res = await fetch('/api/growth/orcado-realizado/funis');
      if (!res.ok) throw new Error('Failed to fetch funis');
      return res.json();
    },
  });

  const funilParam = selectedProdutos.length > 0 ? `&funilNgc=${selectedProdutos.map(p => encodeURIComponent(p)).join(',')}` : '';
  const derivedUtmSources = selectedPlataformas.map(p => PLATFORM_TO_UTM[p]).filter(Boolean);
  const utmSourceParam = derivedUtmSources.length > 0 ? `&utmSource=${derivedUtmSources.join(',')}` : '';

  const { data: mqlData, isLoading: mqlLoading } = useQuery<MQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/mql', dateRange.startDate, dateRange.endDate, selectedProdutos, selectedPlataformas],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/mql?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) throw new Error('Failed to fetch MQL metrics');
      return res.json();
    },
    staleTime: 0,
  });

  const { data: naoMqlData, isLoading: naoMqlLoading } = useQuery<NaoMQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/nao-mql', dateRange.startDate, dateRange.endDate, selectedProdutos, selectedPlataformas],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/nao-mql?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) throw new Error('Failed to fetch Não-MQL metrics');
      return res.json();
    },
    staleTime: 0,
  });

  const { data: adsData, isLoading: adsLoading } = useQuery<AdsMetrics>({
    queryKey: ['/api/growth/orcado-realizado/ads', dateRange.startDate, dateRange.endDate, selectedProdutos, selectedPlataformas],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/ads?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) throw new Error('Failed to fetch Ads metrics');
      return res.json();
    },
    staleTime: 0,
  });

  // Previous period queries for comparison (only when compare is enabled)
  const { data: prevMqlData } = useQuery<MQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/mql', prevDateRange?.startDate, prevDateRange?.endDate, selectedProdutos, selectedPlataformas, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/mql?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange,
    staleTime: 0,
  });

  const { data: prevNaoMqlData } = useQuery<NaoMQLMetrics>({
    queryKey: ['/api/growth/orcado-realizado/nao-mql', prevDateRange?.startDate, prevDateRange?.endDate, selectedProdutos, selectedPlataformas, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/nao-mql?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange,
    staleTime: 0,
  });

  const { data: prevAdsData } = useQuery<AdsMetrics>({
    queryKey: ['/api/growth/orcado-realizado/ads', prevDateRange?.startDate, prevDateRange?.endDate, selectedProdutos, selectedPlataformas, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/ads?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange,
    staleTime: 0,
  });

  // ===== Platform-specific queries (only in aprofundado view) =====
  interface MetaAdsDetailMetrics {
    investimento: number; impressoes: number; alcance: number; frequencia: number;
    cpm: number; ctr: number; videoHook: number; videoHold: number;
    videoP75: number; videoP100: number; visualizacoesPagina: number; connectRate: number;
    sessoes: number;
  }

  interface GoogleAdsDetailMetrics {
    investimento: number; impressoes: number; cliques: number;
    cpm: number; cpc: number; ctr: number;
    visualizacoesPagina: number; connectRate: number;
    conversoes: number; valorConversoes: number; custoConversao: number;
    sessoes: number;
  }

  interface InstagramDetailMetrics {
    postsPublicados: number;
    comecaramSeguir: number; deixaramSeguir: number; percPerdaSeguidores: number;
    deltaSeguidores: number; totalSeguidores: number; percCrescimentoSeguidores: number;
    visualizacoesTotais: number; percVisualizacoesOrganicas: number; visualizacoesOrganicas: number;
    percVisualizacoesPagas: number; visualizacoesPagas: number;
    alcanceTotal: number; alcanceOrganico: number; alcancePago: number;
    frequenciaAlcance: number; ctrAlcanceVisitas: number; visitasPerfil: number;
    percEngajamento: number; interacoes: number; ctrAlcanceCliques: number;
    ctrVisitasCliques: number; cliquesLinkBio: number;
    cliquesLinkBioFonte?: 'linktree_ga4' | 'instagram_profile_taps';
    cliquesPorLink?: Array<{ linkUrl: string; linkDomain: string; clicks: number }>;
    cliquesPorDominio?: Array<{ domain: string; clicks: number }>;
    leadsPorOrigem?: Array<{ origem: string; label: string; leads: number; mqls: number; negocioGanho: number; receita: number }>;
    investimentoPago: number;
    hasConnection: boolean;
    snapshotCount: number;
  }

  interface YoutubeDetailMetrics {
    comecaramInscrever: number; deixaramInscrever: number; percPerdaInscritos: number;
    deltaInscritos: number; totalInscritos: number; percCrescimentoInscritos: number;
    inscritos: number; ganhoLiquidoInscritos: number; visualizacoes: number;
    horasAssistidas: number; avgViewDuration: number; retencaoMedia: number;
    curtidas: number; comentarios: number;
    compartilhamentos: number; videosPublicados: number; hasConnection: boolean;
  }

  interface TiktokDetailMetrics {
    comecaramSeguir: number; deixaramSeguir: number; percPerdaSeguidores: number;
    deltaSeguidores: number; totalSeguidores: number; percCrescimentoSeguidores: number;
    seguidores: number; crescimentoSeguidores: number; visualizacoes: number;
    curtidas: number; comentarios: number; compartilhamentos: number;
    videosPublicados: number; hasConnection: boolean;
  }

  interface TiktokAdsDetailMetrics {
    investimento: number; impressoes: number; cliques: number; conversoes: number;
    cpm: number; ctr: number;
    visualizacoesPagina: number; sessoes: number; connectRate: number;
    hasConnection: boolean;
  }

  interface LinkedinAdsDetailMetrics {
    investimento: number; impressoes: number; cliques: number; conversoes: number;
    cpm: number; ctr: number;
    visualizacoesPagina: number; sessoes: number; connectRate: number;
    hasConnection: boolean;
  }

  interface LinkedinDetailMetrics {
    comecaramSeguir: number; deixaramSeguir: number; percPerdaSeguidores: number;
    deltaSeguidores: number; totalSeguidores: number; percCrescimentoSeguidores: number;
    seguidores: number; novosSeguidores: number; impressoes: number;
    cliques: number; ctr: number; reacoes: number; comentarios: number; compartilhamentos: number;
    engajamento: number; pageViews: number; hasConnection: boolean;
  }

  interface PlatformFunnelData {
    leads: number; mqls: number; cpl: number | null; cpmql: number | null; percMqls: number;
    ra: number; raMql: number; raNmql: number;
    rr: number; rrMql: number; rrNmql: number;
    percRa: number; percRaMql: number; percRaNmql: number;
    percRr: number; percRrMql: number; percRrNmql: number;
    percRrVendas: number; percRrMqlVendas: number; percRrNmqlVendas: number;
    negocioGanho: number; leadTime: number | null; aov: number | null;
    receita: number | null; receitaPontual: number | null; receitaRecorrente: number | null;
    cac: number | null; cacUnico: number | null; cacContrato: number | null;
    clientesUnicos: number; contratos: number;
  }

  const needsPlatformData = activeSection === 'aprofundado' || selectedPlataformas.length > 0;

  const { data: metaAdsDetailData } = useQuery<MetaAdsDetailMetrics>({
    queryKey: ['/api/growth/orcado-realizado/meta-ads', dateRange.startDate, dateRange.endDate, selectedProdutos, selectedPlataformas],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/meta-ads?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) throw new Error('Failed to fetch Meta Ads metrics');
      return res.json();
    },
    enabled: needsPlatformData,
    staleTime: 0,
  });

  const { data: googleAdsDetailData } = useQuery<GoogleAdsDetailMetrics>({
    queryKey: ['/api/growth/orcado-realizado/google-ads', dateRange.startDate, dateRange.endDate, selectedProdutos, selectedPlataformas],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/google-ads?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) throw new Error('Failed to fetch Google Ads metrics');
      return res.json();
    },
    enabled: needsPlatformData,
    staleTime: 0,
  });

  const { data: instagramDetailData } = useQuery<InstagramDetailMetrics>({
    queryKey: ['/api/growth/orcado-realizado/instagram', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/instagram?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch Instagram metrics');
      return res.json();
    },
    enabled: needsPlatformData,
    staleTime: 0,
  });

  const { data: youtubeDetailData } = useQuery<YoutubeDetailMetrics>({
    queryKey: ['/api/growth/orcado-realizado/youtube', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/youtube?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch YouTube metrics');
      return res.json();
    },
    enabled: needsPlatformData,
    staleTime: 0,
  });

  const { data: tiktokDetailData } = useQuery<TiktokDetailMetrics>({
    queryKey: ['/api/growth/orcado-realizado/tiktok', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/tiktok?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch TikTok metrics');
      return res.json();
    },
    enabled: needsPlatformData,
    staleTime: 0,
  });

  const { data: linkedinDetailData } = useQuery<LinkedinDetailMetrics>({
    queryKey: ['/api/growth/orcado-realizado/linkedin', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/linkedin?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch LinkedIn metrics');
      return res.json();
    },
    enabled: needsPlatformData,
    staleTime: 0,
  });

  const { data: tiktokAdsDetailData } = useQuery<TiktokAdsDetailMetrics>({
    queryKey: ['/api/growth/orcado-realizado/tiktok-ads', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/tiktok-ads?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch TikTok Ads metrics');
      return res.json();
    },
    enabled: needsPlatformData,
    staleTime: 0,
  });

  const { data: linkedinAdsDetailData } = useQuery<LinkedinAdsDetailMetrics>({
    queryKey: ['/api/growth/orcado-realizado/linkedin-ads', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/linkedin-ads?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch LinkedIn Ads metrics');
      return res.json();
    },
    enabled: needsPlatformData,
    staleTime: 0,
  });

  const { data: funnelByPlatformData } = useQuery<Record<string, PlatformFunnelData>>({
    queryKey: ['/api/growth/orcado-realizado/funnel-by-platform', dateRange.startDate, dateRange.endDate, selectedProdutos, selectedPlataformas],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcado-realizado/funnel-by-platform?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) throw new Error('Failed to fetch funnel by platform');
      return res.json();
    },
    enabled: needsPlatformData,
    staleTime: 0,
  });

  // ===== Previous-period queries for platform-specific data (aprofundado view) =====
  const { data: prevMetaAdsDetailData } = useQuery<MetaAdsDetailMetrics | null>({
    queryKey: ['/api/growth/orcado-realizado/meta-ads', prevDateRange?.startDate, prevDateRange?.endDate, selectedProdutos, selectedPlataformas, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/meta-ads?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange && needsPlatformData,
    staleTime: 0,
  });

  const { data: prevGoogleAdsDetailData } = useQuery<GoogleAdsDetailMetrics | null>({
    queryKey: ['/api/growth/orcado-realizado/google-ads', prevDateRange?.startDate, prevDateRange?.endDate, selectedProdutos, selectedPlataformas, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/google-ads?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange && needsPlatformData,
    staleTime: 0,
  });

  const { data: prevInstagramDetailData } = useQuery<InstagramDetailMetrics | null>({
    queryKey: ['/api/growth/orcado-realizado/instagram', prevDateRange?.startDate, prevDateRange?.endDate, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/instagram?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange && needsPlatformData,
    staleTime: 0,
  });

  const { data: prevYoutubeDetailData } = useQuery<YoutubeDetailMetrics | null>({
    queryKey: ['/api/growth/orcado-realizado/youtube', prevDateRange?.startDate, prevDateRange?.endDate, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/youtube?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange && needsPlatformData,
    staleTime: 0,
  });

  const { data: prevTiktokDetailData } = useQuery<TiktokDetailMetrics | null>({
    queryKey: ['/api/growth/orcado-realizado/tiktok', prevDateRange?.startDate, prevDateRange?.endDate, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/tiktok?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange && needsPlatformData,
    staleTime: 0,
  });

  const { data: prevLinkedinDetailData } = useQuery<LinkedinDetailMetrics | null>({
    queryKey: ['/api/growth/orcado-realizado/linkedin', prevDateRange?.startDate, prevDateRange?.endDate, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/linkedin?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange && needsPlatformData,
    staleTime: 0,
  });

  const { data: prevTiktokAdsDetailData } = useQuery<TiktokAdsDetailMetrics | null>({
    queryKey: ['/api/growth/orcado-realizado/tiktok-ads', prevDateRange?.startDate, prevDateRange?.endDate, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/tiktok-ads?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange && needsPlatformData,
    staleTime: 0,
  });

  const { data: prevLinkedinAdsDetailData } = useQuery<LinkedinAdsDetailMetrics | null>({
    queryKey: ['/api/growth/orcado-realizado/linkedin-ads', prevDateRange?.startDate, prevDateRange?.endDate, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/linkedin-ads?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange && needsPlatformData,
    staleTime: 0,
  });

  const { data: prevFunnelByPlatformData } = useQuery<Record<string, PlatformFunnelData> | null>({
    queryKey: ['/api/growth/orcado-realizado/funnel-by-platform', prevDateRange?.startDate, prevDateRange?.endDate, selectedProdutos, selectedPlataformas, 'prev'],
    queryFn: async () => {
      if (!prevDateRange) return null;
      const res = await fetch(`/api/growth/orcado-realizado/funnel-by-platform?startDate=${prevDateRange.startDate}&endDate=${prevDateRange.endDate}${funilParam}${utmSourceParam}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!prevDateRange && needsPlatformData,
    staleTime: 0,
  });

  const buildMqlMetrics = (data: MQLMetrics, investimento: number | null = null): Metric[] => {
    const invest = investimento ?? 0;
    const raCount = data.reunioesAgendadas ?? 0;
    const rrCount = data.reunioesRealizadas ?? 0;
    const cpraMql = invest > 0 && raCount > 0 ? invest / raCount : null;
    const cprrMql = invest > 0 && rrCount > 0 ? invest / rrCount : null;
    return [
      {
        id: 'mql_ra_perc',
        name: '%RA MQL',
        type: 'manual',
        orcado: ORCADO_MQL.percReuniaoAgendada,
        realizado: data.percReuniaoAgendada ?? null,
        percentual: calcPercentual(ORCADO_MQL.percReuniaoAgendada, data.percReuniaoAgendada),
        format: 'percent'
      },
      {
        id: 'mql_ra_num',
        name: 'Nº RA MQL',
        type: 'formula',
        orcado: ORCADO_MQL.reunioesAgendadas,
        realizado: data.reunioesAgendadas ?? 0,
        percentual: calcPercentual(ORCADO_MQL.reunioesAgendadas, data.reunioesAgendadas),
        format: 'number'
      },
      {
        id: 'mql_cpra',
        name: 'CPRA MQL',
        type: 'formula',
        orcado: (ORCADO_MQL as any).cpraMql ?? null,
        realizado: cpraMql,
        percentual: calcPercentual((ORCADO_MQL as any).cpraMql ?? null, cpraMql),
        format: 'currency',
      },
      {
        id: 'mql_rr_num',
        name: 'Nº RR MQL',
        type: 'formula',
        orcado: ORCADO_MQL.reunioesRealizadas,
        realizado: data.reunioesRealizadas ?? 0,
        percentual: calcPercentual(ORCADO_MQL.reunioesRealizadas, data.reunioesRealizadas),
        format: 'number'
      },
      {
        id: 'mql_cprr',
        name: 'CPRR MQL',
        type: 'formula',
        orcado: (ORCADO_MQL as any).cprrMql ?? null,
        realizado: cprrMql,
        percentual: calcPercentual((ORCADO_MQL as any).cprrMql ?? null, cprrMql),
        format: 'currency',
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
        id: 'mql_rr_perc',
        name: '%RR MQL',
        type: 'formula',
        orcado: ORCADO_MQL.percRr ?? null,
        realizado: data.totalMqls > 0 ? data.reunioesRealizadas / data.totalMqls : null,
        percentual: calcPercentual(ORCADO_MQL.percRr ?? null, data.totalMqls > 0 ? data.reunioesRealizadas / data.totalMqls : null),
        format: 'percent'
      },
      {
        id: 'mql_taxa_vendas',
        name: 'RR→V% MQL',
        type: 'manual', 
        orcado: ORCADO_MQL.taxaVendas, 
        realizado: data.taxaVendas ?? null, 
        percentual: calcPercentual(ORCADO_MQL.taxaVendas, data.taxaVendas), 
        format: 'percent' 
      },
      {
        id: 'mql_novos_clientes',
        name: 'Negócios Ganhos MQL',
        type: 'formula',
        orcado: ORCADO_MQL.novosClientes,
        realizado: data.dealsGanhos ?? 0,
        percentual: calcPercentual(ORCADO_MQL.novosClientes, data.dealsGanhos),
        format: 'number'
      },
      {
        id: 'mql_contratos_ganhos',
        name: 'Contratos Ganhos MQL',
        type: 'formula',
        orcado: null,
        realizado: data.contratosGanhos ?? 0,
        percentual: null,
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
      {
        id: 'mql_fat_total',
        name: 'Faturamento Total MQL',
        type: 'formula',
        orcado: ORCADO_MQL.faturamentoAceleracao + ORCADO_MQL.faturamentoImplantacao,
        realizado: (data.faturamentoAceleracao ?? 0) + (data.faturamentoImplantacao ?? 0),
        percentual: calcPercentual(ORCADO_MQL.faturamentoAceleracao + ORCADO_MQL.faturamentoImplantacao, (data.faturamentoAceleracao ?? 0) + (data.faturamentoImplantacao ?? 0)),
        format: 'currency'
      },
    ];
  };

  const mqlMetrics: Metric[] = useMemo(() => {
    const cur = buildMqlMetrics(mqlData || {} as MQLMetrics, adsData?.investimento ?? null);
    if (!prevMqlData) return cur;
    return mergePrevRealizado(cur, buildMqlMetrics(prevMqlData, prevAdsData?.investimento ?? null));
  }, [mqlData, prevMqlData, adsData, prevAdsData, ORCADO_MQL]);

  // Métricas de Marketing (usando dados reais da API)
  const buildAdsMetrics = (data: AdsMetrics): Metric[] => [
      { id: 'investimento', name: 'Investimento', type: 'manual', orcado: ORCADO_ADS.investimento, realizado: data.investimento ?? 0, percentual: calcPercentual(ORCADO_ADS.investimento, data.investimento), format: 'currency' },
      { id: 'cpm', name: 'CPM', type: 'formula', orcado: ORCADO_ADS.cpm, realizado: data.cpm ?? null, percentual: calcPercentual(ORCADO_ADS.cpm, data.cpm), format: 'currency' },
      { id: 'ctr', name: 'CTR', type: 'manual', orcado: ORCADO_ADS.ctr, realizado: data.ctr ?? null, percentual: calcPercentual(ORCADO_ADS.ctr, data.ctr), format: 'percent' },
      { id: 'visualizacoes_pagina', name: 'Visualizações de Página', type: 'formula', orcado: ORCADO_ADS.visualizacoesPagina, realizado: data.visualizacoesPagina ?? 0, percentual: calcPercentual(ORCADO_ADS.visualizacoesPagina, data.visualizacoesPagina), format: 'number' },
      { id: 'sessoes', name: 'Sessões', type: 'formula', orcado: ORCADO_ADS.sessoes, realizado: data.sessoes ?? 0, percentual: calcPercentual(ORCADO_ADS.sessoes, data.sessoes), format: 'number' },
      { id: 'connect_rate', name: 'Connect Rate', type: 'formula', orcado: ORCADO_ADS.connectRate, realizado: data.connectRate ?? 0, percentual: calcPercentual(ORCADO_ADS.connectRate, data.connectRate), format: 'percent' },
      { id: 'taxa_conversao_pagina', name: 'Tx Conversão da Página', type: 'formula', orcado: ORCADO_ADS.taxaConversaoPagina, realizado: (data.visualizacoesPagina ?? 0) > 0 ? (data.leads ?? 0) / (data.visualizacoesPagina ?? 1) : 0, percentual: calcPercentual(ORCADO_ADS.taxaConversaoPagina, (data.visualizacoesPagina ?? 0) > 0 ? (data.leads ?? 0) / (data.visualizacoesPagina ?? 1) : 0), format: 'percent' },
      { id: 'leads', name: 'Leads', type: 'formula', orcado: ORCADO_ADS.leads, realizado: data.leads ?? 0, percentual: calcPercentual(ORCADO_ADS.leads, data.leads), format: 'number' },
      { id: 'mqls', name: 'MQLs', type: 'formula', orcado: ORCADO_ADS.mqls, realizado: data.mqls ?? 0, percentual: calcPercentual(ORCADO_ADS.mqls, data.mqls), format: 'number' },
      { id: 'cpl', name: 'CPL', type: 'formula', orcado: ORCADO_ADS.cpl, realizado: data.cpl ?? null, percentual: calcPercentual(ORCADO_ADS.cpl, data.cpl), format: 'currency' },
      { id: 'cpmql', name: 'CPMQL', type: 'formula', orcado: ORCADO_ADS.cpmql, realizado: data.cpmql ?? null, percentual: calcPercentual(ORCADO_ADS.cpmql, data.cpmql), format: 'currency' },
      // CPRA e CPRR movidos pras seções VENDAS — MQL e VENDAS — não-MQL
      // (perto de Nº RA / Nº RR), onde fazem mais sentido semanticamente.
      { id: 'perc_mqls', name: '% MQLs', type: 'formula', orcado: ORCADO_ADS.percMqls, realizado: data.percMqls ?? null, percentual: calcPercentual(ORCADO_ADS.percMqls, data.percMqls), format: 'percent' },
    ];

  const adsMetrics: Metric[] = useMemo(() => {
    const cur = buildAdsMetrics(adsData || {} as AdsMetrics);
    if (!prevAdsData) return cur;
    return mergePrevRealizado(cur, buildAdsMetrics(prevAdsData));
  }, [adsData, prevAdsData, ORCADO_ADS]);

  const marketingSections: MetricSection[] = [
    {
      title: 'Métricas de Marketing',
      icon: <Megaphone className="w-5 h-5" />,
      metrics: adsMetrics,
    },
  ];

  // ===== Platform-specific metric builders for Aprofundado view =====

  // Helper: build lead/MQL metrics for a platform (rest of funnel comes from MQL/NMQL/Total sections)
  const buildFunnelMetrics = (prefix: string, funnel: PlatformFunnelData | undefined, orcado: any, investimento: number | null): Metric[] => {
    const f = funnel || {} as PlatformFunnelData;
    const invest = investimento !== null && investimento > 0 ? investimento : 0;
    const cpl = invest > 0 && (f.leads || 0) > 0 ? invest / f.leads : null;
    const cpmql = invest > 0 && (f.mqls || 0) > 0 ? invest / f.mqls : null;
    // CPRA e CPRR (e splits MQL/nMQL) NÃO entram aqui: são métricas de vendas e
    // vivem nas seções VENDAS — MQL, VENDAS — não-MQL e Total. Mantê-las nos
    // breakdowns por plataforma duplicava no lugar errado e dava R$ NaN nos
    // canais orgânicos (sem investimento). Alinhado com o consolidado de Marketing.
    return [
      { id: `${prefix}_leads`, name: 'Leads', type: 'formula', orcado: orcado.leads, realizado: f.leads ?? 0, percentual: calcPercentual(orcado.leads, f.leads), format: 'number' },
      { id: `${prefix}_mqls`, name: 'MQLs', type: 'formula', orcado: orcado.mqls, realizado: f.mqls ?? 0, percentual: calcPercentual(orcado.mqls, f.mqls), format: 'number' },
      { id: `${prefix}_cpl`, name: 'CPL', type: 'formula', orcado: orcado.cpl, realizado: cpl, percentual: calcPercentual(orcado.cpl, cpl), format: 'currency' },
      { id: `${prefix}_cpmql`, name: 'CPMQL', type: 'formula', orcado: orcado.cpmql, realizado: cpmql, percentual: calcPercentual(orcado.cpmql, cpmql), format: 'currency' },
      { id: `${prefix}_percMqls`, name: '% MQLs', type: 'formula', orcado: orcado.percMqls, realizado: f.percMqls ?? null, percentual: calcPercentual(orcado.percMqls, f.percMqls), format: 'percent' },
    ];
  };

  // Meta Ads platform metrics
  const buildMetaAdsMetrics = (
    d: MetaAdsDetailMetrics,
    funnel: PlatformFunnelData | undefined,
  ): Metric[] => {
    const O = ORCADO_META_ADS;
    const taxaConversaoPagina = (d.sessoes ?? 0) > 0
      ? ((funnel?.leads ?? 0) / d.sessoes) : 0;
    const topMetrics: Metric[] = [
      { id: 'meta_investimento', name: 'Investimento', type: 'manual', orcado: O.investimento, realizado: d.investimento ?? 0, percentual: calcPercentual(O.investimento, d.investimento), format: 'currency' },
      { id: 'meta_cpm', name: 'CPM', type: 'formula', orcado: O.cpm, realizado: d.cpm ?? null, percentual: calcPercentual(O.cpm, d.cpm), format: 'currency' },
      { id: 'meta_ctr', name: 'CTR', type: 'manual', orcado: O.ctr, realizado: d.ctr ?? null, percentual: calcPercentual(O.ctr, d.ctr), format: 'percent' },
      { id: 'meta_visualizacoesPagina', name: 'Visualizações de Página', type: 'formula', orcado: O.visualizacoesPagina, realizado: d.visualizacoesPagina ?? 0, percentual: calcPercentual(O.visualizacoesPagina, d.visualizacoesPagina), format: 'number' },
      { id: 'meta_sessoes', name: 'Sessões', type: 'formula', orcado: O.sessoes, realizado: d.sessoes ?? 0, percentual: calcPercentual(O.sessoes, d.sessoes), format: 'number' },
      { id: 'meta_connectRate', name: 'Connect Rate', type: 'formula', orcado: O.connectRate, realizado: d.connectRate ?? 0, percentual: calcPercentual(O.connectRate, d.connectRate), format: 'percent' },
      { id: 'meta_taxaConversaoPagina', name: 'Tx Conversão da Página', type: 'formula', orcado: O.taxaConversaoPagina, realizado: taxaConversaoPagina, percentual: calcPercentual(O.taxaConversaoPagina, taxaConversaoPagina), format: 'percent' },
    ];
    return [...topMetrics, ...buildFunnelMetrics('meta', funnel, O, d.investimento ?? null)];
  };

  const metaAdsPlatformMetrics: Metric[] = useMemo(() => {
    const cur = buildMetaAdsMetrics(metaAdsDetailData || {} as MetaAdsDetailMetrics, funnelByPlatformData?.meta_ads);
    if (!prevMetaAdsDetailData && !prevFunnelByPlatformData) return cur;
    const prev = buildMetaAdsMetrics(
      prevMetaAdsDetailData || {} as MetaAdsDetailMetrics,
      prevFunnelByPlatformData?.meta_ads,
    );
    return mergePrevRealizado(cur, prev);
  }, [metaAdsDetailData, funnelByPlatformData, prevMetaAdsDetailData, prevFunnelByPlatformData, ORCADO_META_ADS]);

  // Google Ads platform metrics
  const buildGoogleAdsMetrics = (
    d: GoogleAdsDetailMetrics,
    funnel: PlatformFunnelData | undefined,
  ): Metric[] => {
    const O = ORCADO_GOOGLE_ADS;
    const taxaConversaoPagina = (d.sessoes ?? 0) > 0
      ? ((funnel?.leads ?? 0) / d.sessoes) : 0;
    const topMetrics: Metric[] = [
      { id: 'gads_investimento', name: 'Investimento', type: 'manual', orcado: O.investimento, realizado: d.investimento ?? 0, percentual: calcPercentual(O.investimento, d.investimento), format: 'currency' },
      { id: 'gads_cpm', name: 'CPM', type: 'formula', orcado: O.cpm, realizado: d.cpm ?? null, percentual: calcPercentual(O.cpm, d.cpm), format: 'currency' },
      { id: 'gads_ctr', name: 'CTR', type: 'manual', orcado: O.ctr, realizado: d.ctr ?? null, percentual: calcPercentual(O.ctr, d.ctr), format: 'percent' },
      { id: 'gads_visualizacoesPagina', name: 'Visualizações de Página', type: 'formula', orcado: O.visualizacoesPagina, realizado: d.visualizacoesPagina ?? 0, percentual: calcPercentual(O.visualizacoesPagina, d.visualizacoesPagina), format: 'number' },
      { id: 'gads_sessoes', name: 'Sessões', type: 'formula', orcado: O.sessoes, realizado: d.sessoes ?? 0, percentual: calcPercentual(O.sessoes, d.sessoes), format: 'number' },
      { id: 'gads_connectRate', name: 'Connect Rate', type: 'formula', orcado: O.connectRate, realizado: d.connectRate ?? 0, percentual: calcPercentual(O.connectRate, d.connectRate), format: 'percent' },
      { id: 'gads_taxaConversaoPagina', name: 'Tx Conversão da Página', type: 'formula', orcado: O.taxaConversaoPagina, realizado: taxaConversaoPagina, percentual: calcPercentual(O.taxaConversaoPagina, taxaConversaoPagina), format: 'percent' },
    ];
    return [...topMetrics, ...buildFunnelMetrics('gads', funnel, O, d.investimento ?? null)];
  };

  const googleAdsPlatformMetrics: Metric[] = useMemo(() => {
    const cur = buildGoogleAdsMetrics(googleAdsDetailData || {} as GoogleAdsDetailMetrics, funnelByPlatformData?.google_ads);
    if (!prevGoogleAdsDetailData && !prevFunnelByPlatformData) return cur;
    const prev = buildGoogleAdsMetrics(
      prevGoogleAdsDetailData || {} as GoogleAdsDetailMetrics,
      prevFunnelByPlatformData?.google_ads,
    );
    return mergePrevRealizado(cur, prev);
  }, [googleAdsDetailData, funnelByPlatformData, prevGoogleAdsDetailData, prevFunnelByPlatformData, ORCADO_GOOGLE_ADS]);

  // Instagram platform metrics
  const buildInstagramMetrics = (
    d: InstagramDetailMetrics,
    funnel: PlatformFunnelData | undefined,
  ): Metric[] => {
    const O = ORCADO_INSTAGRAM;
    const topMetrics: Metric[] = [
      { id: 'ig_postsPublicados', name: 'Posts Publicados', type: 'formula', orcado: (O as any).postsPublicados, realizado: d.postsPublicados ?? 0, percentual: calcPercentual((O as any).postsPublicados, d.postsPublicados), format: 'number' },
      { id: 'ig_comecaramSeguir', name: 'Começaram a Seguir', type: 'formula', orcado: O.comecaramSeguir, realizado: d.comecaramSeguir ?? 0, percentual: calcPercentual(O.comecaramSeguir, d.comecaramSeguir), format: 'number' },
      { id: 'ig_deixaramSeguir', name: 'Deixaram de Seguir', type: 'formula', orcado: O.deixaramSeguir, realizado: d.deixaramSeguir ?? 0, percentual: calcPercentual(O.deixaramSeguir, d.deixaramSeguir), format: 'number' },
      { id: 'ig_percPerdaSeguidores', name: '% Perda de Seguidores', type: 'formula', orcado: O.percPerdaSeguidores, realizado: d.percPerdaSeguidores ?? null, percentual: calcPercentual(O.percPerdaSeguidores, d.percPerdaSeguidores), format: 'percent' },
      { id: 'ig_deltaSeguidores', name: 'Delta de Seguidores', type: 'formula', orcado: O.deltaSeguidores, realizado: d.deltaSeguidores ?? 0, percentual: calcPercentual(O.deltaSeguidores, d.deltaSeguidores), format: 'number' },
      { id: 'ig_totalSeguidores', name: 'Total de Seguidores', type: 'formula', orcado: O.totalSeguidores, realizado: d.totalSeguidores ?? 0, percentual: calcPercentual(O.totalSeguidores, d.totalSeguidores), format: 'number' },
      { id: 'ig_percCrescimentoSeguidores', name: '% Crescimento de Seguidores', type: 'formula', orcado: O.percCrescimentoSeguidores, realizado: d.percCrescimentoSeguidores ?? null, percentual: calcPercentual(O.percCrescimentoSeguidores, d.percCrescimentoSeguidores), format: 'percent' },
      { id: 'ig_visualizacoesTotais', name: 'Visualizações Totais', type: 'formula', orcado: O.visualizacoesTotais, realizado: d.visualizacoesTotais ?? 0, percentual: calcPercentual(O.visualizacoesTotais, d.visualizacoesTotais), format: 'number' },
      { id: 'ig_percVisualizacoesOrganicas', name: '% Visualizações Orgânicas', type: 'formula', orcado: O.percVisualizacoesOrganicas, realizado: d.percVisualizacoesOrganicas ?? null, percentual: calcPercentual(O.percVisualizacoesOrganicas, d.percVisualizacoesOrganicas), format: 'percent' },
      { id: 'ig_visualizacoesOrganicas', name: 'Visualizações Orgânicas', type: 'formula', orcado: O.visualizacoesOrganicas, realizado: d.visualizacoesOrganicas ?? 0, percentual: calcPercentual(O.visualizacoesOrganicas, d.visualizacoesOrganicas), format: 'number' },
      { id: 'ig_percVisualizacoesPagas', name: '% Visualizações Pagas', type: 'formula', orcado: O.percVisualizacoesPagas, realizado: d.percVisualizacoesPagas ?? null, percentual: calcPercentual(O.percVisualizacoesPagas, d.percVisualizacoesPagas), format: 'percent' },
      { id: 'ig_visualizacoesPagas', name: 'Visualizações Pagas', type: 'formula', orcado: O.visualizacoesPagas, realizado: d.visualizacoesPagas ?? 0, percentual: calcPercentual(O.visualizacoesPagas, d.visualizacoesPagas), format: 'number' },
      { id: 'ig_alcanceTotal', name: 'Alcance Total', type: 'formula', orcado: O.alcanceTotal, realizado: d.alcanceTotal ?? 0, percentual: calcPercentual(O.alcanceTotal, d.alcanceTotal), format: 'number' },
      { id: 'ig_alcanceOrganico', name: 'Alcance Orgânico', type: 'formula', orcado: O.alcanceOrganico, realizado: d.alcanceOrganico ?? 0, percentual: calcPercentual(O.alcanceOrganico, d.alcanceOrganico), format: 'number' },
      { id: 'ig_alcancePago', name: 'Alcance Pago', type: 'formula', orcado: O.alcancePago, realizado: d.alcancePago ?? 0, percentual: calcPercentual(O.alcancePago, d.alcancePago), format: 'number' },
      { id: 'ig_frequenciaAlcance', name: 'Frequência de Alcance', type: 'formula', orcado: O.frequenciaAlcance, realizado: d.frequenciaAlcance ?? null, percentual: calcPercentual(O.frequenciaAlcance, d.frequenciaAlcance), format: 'number' },
      { id: 'ig_ctrAlcanceVisitas', name: 'CTR Alcance > Visitas', type: 'formula', orcado: O.ctrAlcanceVisitas, realizado: d.ctrAlcanceVisitas ?? null, percentual: calcPercentual(O.ctrAlcanceVisitas, d.ctrAlcanceVisitas), format: 'percent' },
      { id: 'ig_visitasPerfil', name: 'Visitas ao Perfil', type: 'formula', orcado: O.visitasPerfil, realizado: d.visitasPerfil ?? 0, percentual: calcPercentual(O.visitasPerfil, d.visitasPerfil), format: 'number' },
      { id: 'ig_percEngajamento', name: '% Engajamento (Alcance > Interações)', type: 'formula', orcado: O.percEngajamento, realizado: d.percEngajamento ?? null, percentual: calcPercentual(O.percEngajamento, d.percEngajamento), format: 'percent' },
      { id: 'ig_interacoes', name: 'Interações', type: 'formula', orcado: O.interacoes, realizado: d.interacoes ?? 0, percentual: calcPercentual(O.interacoes, d.interacoes), format: 'number' },
      { id: 'ig_ctrAlcanceCliques', name: 'CTR Alcance > Cliques', type: 'formula', orcado: O.ctrAlcanceCliques, realizado: d.ctrAlcanceCliques ?? null, percentual: calcPercentual(O.ctrAlcanceCliques, d.ctrAlcanceCliques), format: 'percent' },
      { id: 'ig_ctrVisitasCliques', name: 'CTR Visitas > Cliques', type: 'formula', orcado: O.ctrVisitasCliques, realizado: d.ctrVisitasCliques ?? null, percentual: calcPercentual(O.ctrVisitasCliques, d.ctrVisitasCliques), format: 'percent' },
      { id: 'ig_cliquesLinkBio', name: 'Cliques no Link Bio', type: 'formula', orcado: O.cliquesLinkBio, realizado: d.cliquesLinkBio ?? 0, percentual: calcPercentual(O.cliquesLinkBio, d.cliquesLinkBio), format: 'number' },
    ];
    return [...topMetrics, ...buildFunnelMetrics('ig', funnel, O, d.investimentoPago ?? null)];
  };

  const instagramPlatformMetrics: Metric[] = useMemo(() => {
    const cur = buildInstagramMetrics(instagramDetailData || {} as InstagramDetailMetrics, funnelByPlatformData?.instagram);
    if (!prevInstagramDetailData && !prevFunnelByPlatformData) return cur;
    const prev = buildInstagramMetrics(
      prevInstagramDetailData || {} as InstagramDetailMetrics,
      prevFunnelByPlatformData?.instagram,
    );
    return mergePrevRealizado(cur, prev);
  }, [instagramDetailData, funnelByPlatformData, prevInstagramDetailData, prevFunnelByPlatformData, ORCADO_INSTAGRAM]);

  // YouTube platform metrics (orgânico — lê youtube.* via endpoint)
  const buildYoutubeMetrics = (d: YoutubeDetailMetrics, funnel: PlatformFunnelData | undefined): Metric[] => {
    const O = ORCADO_YOUTUBE;
    const topMetrics: Metric[] = [
      { id: 'yt_videosPublicados', name: 'Vídeos Publicados', type: 'formula', orcado: O.videosPublicados, realizado: d.videosPublicados ?? 0, percentual: calcPercentual(O.videosPublicados, d.videosPublicados), format: 'number' },
      // Audiência (inscritos) — espelha o breakdown de seguidores do Instagram
      { id: 'yt_comecaramInscrever', name: 'Começaram a Inscrever', type: 'formula', orcado: O.comecaramInscrever, realizado: d.comecaramInscrever ?? 0, percentual: calcPercentual(O.comecaramInscrever, d.comecaramInscrever), format: 'number' },
      { id: 'yt_deixaramInscrever', name: 'Deixaram de Inscrever', type: 'formula', orcado: O.deixaramInscrever, realizado: d.deixaramInscrever ?? 0, percentual: calcPercentual(O.deixaramInscrever, d.deixaramInscrever), format: 'number' },
      { id: 'yt_percPerdaInscritos', name: '% Perda de Inscritos', type: 'formula', orcado: O.percPerdaInscritos, realizado: d.percPerdaInscritos ?? null, percentual: calcPercentual(O.percPerdaInscritos, d.percPerdaInscritos), format: 'percent' },
      { id: 'yt_deltaInscritos', name: 'Delta de Inscritos', type: 'formula', orcado: O.deltaInscritos, realizado: d.deltaInscritos ?? 0, percentual: calcPercentual(O.deltaInscritos, d.deltaInscritos), format: 'number' },
      { id: 'yt_totalInscritos', name: 'Total de Inscritos', type: 'formula', orcado: O.totalInscritos, realizado: d.totalInscritos ?? 0, percentual: calcPercentual(O.totalInscritos, d.totalInscritos), format: 'number' },
      { id: 'yt_percCrescimentoInscritos', name: '% Crescimento de Inscritos', type: 'formula', orcado: O.percCrescimentoInscritos, realizado: d.percCrescimentoInscritos ?? null, percentual: calcPercentual(O.percCrescimentoInscritos, d.percCrescimentoInscritos), format: 'percent' },
      // Conteúdo / distribuição
      // CTR de thumbnail NÃO existe na YouTube Analytics API pública (Studio-only,
      // issue 254665034) → entrada manual. Retenção vem do nível de vídeo (agregada).
      { id: 'yt_ctrImpressoes', name: 'CTR Impressões (Thumbnail)', type: 'manual', orcado: O.ctrImpressoes, realizado: null, percentual: null, format: 'percent' },
      { id: 'yt_visualizacoes', name: 'Visualizações', type: 'formula', orcado: O.visualizacoes, realizado: d.visualizacoes ?? 0, percentual: calcPercentual(O.visualizacoes, d.visualizacoes), format: 'number' },
      { id: 'yt_retencaoMedia', name: 'Retenção Média', type: 'formula', orcado: O.retencaoMedia, realizado: d.retencaoMedia ?? null, percentual: calcPercentual(O.retencaoMedia, d.retencaoMedia), format: 'percent' },
      { id: 'yt_avgViewDuration', name: 'Duração Média (s)', type: 'formula', orcado: O.avgViewDuration, realizado: d.avgViewDuration ?? 0, percentual: calcPercentual(O.avgViewDuration, d.avgViewDuration), format: 'number' },
      { id: 'yt_horasAssistidas', name: 'Horas Assistidas', type: 'formula', orcado: O.horasAssistidas, realizado: d.horasAssistidas ?? 0, percentual: calcPercentual(O.horasAssistidas, d.horasAssistidas), format: 'number' },
    ];
    return [...topMetrics, ...buildFunnelMetrics('yt', funnel, O, null)];
  };

  const youtubePlatformMetrics: Metric[] = useMemo(() => {
    const cur = buildYoutubeMetrics(youtubeDetailData || {} as YoutubeDetailMetrics, funnelByPlatformData?.youtube);
    if (!prevYoutubeDetailData && !prevFunnelByPlatformData) return cur;
    return mergePrevRealizado(cur, buildYoutubeMetrics(prevYoutubeDetailData || {} as YoutubeDetailMetrics, prevFunnelByPlatformData?.youtube));
  }, [youtubeDetailData, funnelByPlatformData, prevYoutubeDetailData, prevFunnelByPlatformData, ORCADO_YOUTUBE]);

  // LinkedIn platform metrics (orgânico — lê linkedin.* via endpoint)
  const buildLinkedinMetrics = (d: LinkedinDetailMetrics, funnel: PlatformFunnelData | undefined): Metric[] => {
    const O = ORCADO_LINKEDIN;
    const topMetrics: Metric[] = [
      // Posts publicados não vêm do sync orgânico atual → manual
      { id: 'li_postsPublicados', name: 'Posts Publicados', type: 'manual', orcado: O.postsPublicados, realizado: null, percentual: null, format: 'number' },
      // Audiência (seguidores) — espelha o breakdown do Instagram/YouTube
      { id: 'li_comecaramSeguir', name: 'Começaram a Seguir', type: 'formula', orcado: O.comecaramSeguir, realizado: d.comecaramSeguir ?? 0, percentual: calcPercentual(O.comecaramSeguir, d.comecaramSeguir), format: 'number' },
      { id: 'li_deixaramSeguir', name: 'Deixaram de Seguir', type: 'formula', orcado: O.deixaramSeguir, realizado: d.deixaramSeguir ?? 0, percentual: calcPercentual(O.deixaramSeguir, d.deixaramSeguir), format: 'number' },
      { id: 'li_percPerdaSeguidores', name: '% Perda de Seguidores', type: 'formula', orcado: O.percPerdaSeguidores, realizado: d.percPerdaSeguidores ?? null, percentual: calcPercentual(O.percPerdaSeguidores, d.percPerdaSeguidores), format: 'percent' },
      { id: 'li_deltaSeguidores', name: 'Delta de Seguidores', type: 'formula', orcado: O.deltaSeguidores, realizado: d.deltaSeguidores ?? 0, percentual: calcPercentual(O.deltaSeguidores, d.deltaSeguidores), format: 'number' },
      { id: 'li_totalSeguidores', name: 'Total de Seguidores', type: 'formula', orcado: O.totalSeguidores, realizado: d.totalSeguidores ?? 0, percentual: calcPercentual(O.totalSeguidores, d.totalSeguidores), format: 'number' },
      { id: 'li_percCrescimentoSeguidores', name: '% Crescimento de Seguidores', type: 'formula', orcado: O.percCrescimentoSeguidores, realizado: d.percCrescimentoSeguidores ?? null, percentual: calcPercentual(O.percCrescimentoSeguidores, d.percCrescimentoSeguidores), format: 'percent' },
      // Distribuição / intenção
      { id: 'li_impressoes', name: 'Impressões', type: 'formula', orcado: O.impressoes, realizado: d.impressoes ?? 0, percentual: calcPercentual(O.impressoes, d.impressoes), format: 'number' },
      { id: 'li_ctr', name: 'CTR', type: 'formula', orcado: O.ctr, realizado: d.ctr ?? null, percentual: calcPercentual(O.ctr, d.ctr), format: 'percent' },
      { id: 'li_visualizacoesPagina', name: 'Visualizações de Página', type: 'formula', orcado: O.visualizacoesPagina, realizado: d.pageViews ?? 0, percentual: calcPercentual(O.visualizacoesPagina, d.pageViews), format: 'number' },
      { id: 'li_taxaEngajamento', name: 'Taxa de Engajamento', type: 'formula', orcado: O.taxaEngajamento, realizado: d.engajamento ?? null, percentual: calcPercentual(O.taxaEngajamento, d.engajamento), format: 'percent' },
    ];
    return [...topMetrics, ...buildFunnelMetrics('li', funnel, O, null)];
  };

  const linkedinPlatformMetrics: Metric[] = useMemo(() => {
    const cur = buildLinkedinMetrics(linkedinDetailData || {} as LinkedinDetailMetrics, funnelByPlatformData?.linkedin);
    if (!prevLinkedinDetailData && !prevFunnelByPlatformData) return cur;
    return mergePrevRealizado(cur, buildLinkedinMetrics(prevLinkedinDetailData || {} as LinkedinDetailMetrics, prevFunnelByPlatformData?.linkedin));
  }, [linkedinDetailData, funnelByPlatformData, prevLinkedinDetailData, prevFunnelByPlatformData, ORCADO_LINKEDIN]);

  // TikTok platform metrics (orgânico — lê tiktok.* via endpoint)
  const buildTiktokMetrics = (d: TiktokDetailMetrics, funnel: PlatformFunnelData | undefined): Metric[] => {
    const O = ORCADO_TIKTOK;
    const topMetrics: Metric[] = [
      { id: 'tt_videosPublicados', name: 'Vídeos Publicados', type: 'formula', orcado: O.videosPublicados, realizado: d.videosPublicados ?? 0, percentual: calcPercentual(O.videosPublicados, d.videosPublicados), format: 'number' },
      // Audiência (seguidores) — espelha o breakdown do Instagram/YouTube/LinkedIn
      { id: 'tt_comecaramSeguir', name: 'Começaram a Seguir', type: 'formula', orcado: O.comecaramSeguir, realizado: d.comecaramSeguir ?? 0, percentual: calcPercentual(O.comecaramSeguir, d.comecaramSeguir), format: 'number' },
      { id: 'tt_deixaramSeguir', name: 'Deixaram de Seguir', type: 'formula', orcado: O.deixaramSeguir, realizado: d.deixaramSeguir ?? 0, percentual: calcPercentual(O.deixaramSeguir, d.deixaramSeguir), format: 'number' },
      { id: 'tt_percPerdaSeguidores', name: '% Perda de Seguidores', type: 'formula', orcado: O.percPerdaSeguidores, realizado: d.percPerdaSeguidores ?? null, percentual: calcPercentual(O.percPerdaSeguidores, d.percPerdaSeguidores), format: 'percent' },
      { id: 'tt_deltaSeguidores', name: 'Delta de Seguidores', type: 'formula', orcado: O.deltaSeguidores, realizado: d.deltaSeguidores ?? 0, percentual: calcPercentual(O.deltaSeguidores, d.deltaSeguidores), format: 'number' },
      { id: 'tt_totalSeguidores', name: 'Total de Seguidores', type: 'formula', orcado: O.totalSeguidores, realizado: d.totalSeguidores ?? 0, percentual: calcPercentual(O.totalSeguidores, d.totalSeguidores), format: 'number' },
      { id: 'tt_percCrescimentoSeguidores', name: '% Crescimento de Seguidores', type: 'formula', orcado: O.percCrescimentoSeguidores, realizado: d.percCrescimentoSeguidores ?? null, percentual: calcPercentual(O.percCrescimentoSeguidores, d.percCrescimentoSeguidores), format: 'percent' },
      // Distribuição
      { id: 'tt_visualizacoes', name: 'Visualizações', type: 'formula', orcado: O.visualizacoes, realizado: d.visualizacoes ?? 0, percentual: calcPercentual(O.visualizacoes, d.visualizacoes), format: 'number' },
      { id: 'tt_compartilhamentos', name: 'Compartilhamentos', type: 'formula', orcado: O.compartilhamentos, realizado: d.compartilhamentos ?? 0, percentual: calcPercentual(O.compartilhamentos, d.compartilhamentos), format: 'number' },
    ];
    return [...topMetrics, ...buildFunnelMetrics('tt', funnel, O, null)];
  };

  const tiktokPlatformMetrics: Metric[] = useMemo(() => {
    const cur = buildTiktokMetrics(tiktokDetailData || {} as TiktokDetailMetrics, funnelByPlatformData?.tiktok);
    if (!prevTiktokDetailData && !prevFunnelByPlatformData) return cur;
    return mergePrevRealizado(cur, buildTiktokMetrics(prevTiktokDetailData || {} as TiktokDetailMetrics, prevFunnelByPlatformData?.tiktok));
  }, [tiktokDetailData, funnelByPlatformData, prevTiktokDetailData, prevFunnelByPlatformData, ORCADO_TIKTOK]);

  // TikTok Ads platform metrics (mídia paga — lê tiktok.ad_metrics_daily via endpoint)
  const buildTiktokAdsMetrics = (d: TiktokAdsDetailMetrics, funnel: PlatformFunnelData | undefined): Metric[] => {
    const O = ORCADO_TIKTOK_ADS;
    const taxaConversaoPagina = (d.sessoes ?? 0) > 0
      ? ((funnel?.leads ?? 0) / d.sessoes) : 0;
    const topMetrics: Metric[] = [
      { id: 'tta_investimento', name: 'Investimento', type: 'manual', orcado: O.investimento, realizado: d.investimento ?? 0, percentual: calcPercentual(O.investimento, d.investimento), format: 'currency' },
      { id: 'tta_cpm', name: 'CPM', type: 'formula', orcado: O.cpm, realizado: d.cpm ?? null, percentual: calcPercentual(O.cpm, d.cpm), format: 'currency' },
      { id: 'tta_ctr', name: 'CTR', type: 'formula', orcado: O.ctr, realizado: d.ctr ?? null, percentual: calcPercentual(O.ctr, d.ctr), format: 'percent' },
      { id: 'tta_visualizacoesPagina', name: 'Visualizações de Página', type: 'formula', orcado: O.visualizacoesPagina, realizado: d.visualizacoesPagina ?? 0, percentual: calcPercentual(O.visualizacoesPagina, d.visualizacoesPagina), format: 'number' },
      { id: 'tta_sessoes', name: 'Sessões', type: 'formula', orcado: O.sessoes, realizado: d.sessoes ?? 0, percentual: calcPercentual(O.sessoes, d.sessoes), format: 'number' },
      { id: 'tta_connectRate', name: 'Connect Rate', type: 'formula', orcado: O.connectRate, realizado: d.connectRate ?? 0, percentual: calcPercentual(O.connectRate, d.connectRate), format: 'percent' },
      { id: 'tta_taxaConversaoPagina', name: 'Tx Conversão da Página', type: 'formula', orcado: O.taxaConversaoPagina, realizado: taxaConversaoPagina, percentual: calcPercentual(O.taxaConversaoPagina, taxaConversaoPagina), format: 'percent' },
    ];
    return [...topMetrics, ...buildFunnelMetrics('tta', funnel, O, d.investimento ?? null)];
  };

  const tiktokAdsPlatformMetrics: Metric[] = useMemo(() => {
    const cur = buildTiktokAdsMetrics(tiktokAdsDetailData || {} as TiktokAdsDetailMetrics, funnelByPlatformData?.tiktok_ads);
    if (!prevTiktokAdsDetailData && !prevFunnelByPlatformData) return cur;
    return mergePrevRealizado(cur, buildTiktokAdsMetrics(prevTiktokAdsDetailData || {} as TiktokAdsDetailMetrics, prevFunnelByPlatformData?.tiktok_ads));
  }, [tiktokAdsDetailData, funnelByPlatformData, prevTiktokAdsDetailData, prevFunnelByPlatformData, ORCADO_TIKTOK_ADS]);

  // LinkedIn Ads platform metrics (mídia paga — lê linkedin.ad_metrics_daily via endpoint)
  const buildLinkedinAdsMetrics = (d: LinkedinAdsDetailMetrics, funnel: PlatformFunnelData | undefined): Metric[] => {
    const O = ORCADO_LINKEDIN_ADS;
    const taxaConversaoPagina = (d.sessoes ?? 0) > 0
      ? ((funnel?.leads ?? 0) / d.sessoes) : 0;
    const topMetrics: Metric[] = [
      { id: 'lia_investimento', name: 'Investimento', type: 'manual', orcado: O.investimento, realizado: d.investimento ?? 0, percentual: calcPercentual(O.investimento, d.investimento), format: 'currency' },
      { id: 'lia_cpm', name: 'CPM', type: 'formula', orcado: O.cpm, realizado: d.cpm ?? null, percentual: calcPercentual(O.cpm, d.cpm), format: 'currency' },
      { id: 'lia_ctr', name: 'CTR', type: 'formula', orcado: O.ctr, realizado: d.ctr ?? null, percentual: calcPercentual(O.ctr, d.ctr), format: 'percent' },
      { id: 'lia_visualizacoesPagina', name: 'Visualizações de Página', type: 'formula', orcado: O.visualizacoesPagina, realizado: d.visualizacoesPagina ?? 0, percentual: calcPercentual(O.visualizacoesPagina, d.visualizacoesPagina), format: 'number' },
      { id: 'lia_sessoes', name: 'Sessões', type: 'formula', orcado: O.sessoes, realizado: d.sessoes ?? 0, percentual: calcPercentual(O.sessoes, d.sessoes), format: 'number' },
      { id: 'lia_connectRate', name: 'Connect Rate', type: 'formula', orcado: O.connectRate, realizado: d.connectRate ?? 0, percentual: calcPercentual(O.connectRate, d.connectRate), format: 'percent' },
      { id: 'lia_taxaConversaoPagina', name: 'Tx Conversão da Página', type: 'formula', orcado: O.taxaConversaoPagina, realizado: taxaConversaoPagina, percentual: calcPercentual(O.taxaConversaoPagina, taxaConversaoPagina), format: 'percent' },
    ];
    return [...topMetrics, ...buildFunnelMetrics('lia', funnel, O, d.investimento ?? null)];
  };

  const linkedinAdsPlatformMetrics: Metric[] = useMemo(() => {
    const cur = buildLinkedinAdsMetrics(linkedinAdsDetailData || {} as LinkedinAdsDetailMetrics, funnelByPlatformData?.linkedin_ads);
    if (!prevLinkedinAdsDetailData && !prevFunnelByPlatformData) return cur;
    return mergePrevRealizado(cur, buildLinkedinAdsMetrics(prevLinkedinAdsDetailData || {} as LinkedinAdsDetailMetrics, prevFunnelByPlatformData?.linkedin_ads));
  }, [linkedinAdsDetailData, funnelByPlatformData, prevLinkedinAdsDetailData, prevFunnelByPlatformData, ORCADO_LINKEDIN_ADS]);

  // Instagram empty-state banner: distinguish "no connection" from "connection ok but no data"
  const instagramBanner = useMemo<React.ReactNode | undefined>(() => {
    if (!instagramDetailData) return undefined;
    if (instagramDetailData.hasConnection === false) {
      return 'Nenhuma conexão Instagram ativa. Configure em Integrações para começar a coletar métricas.';
    }
    if (instagramDetailData.snapshotCount === 0) {
      return 'Sem dados sincronizados para este período. O sync roda a cada 6h — aguarde ou cheque logs do Instagram sync.';
    }
    return undefined;
  }, [instagramDetailData]);

  // Banner de "sem conexão" para os orgânicos nativos (YouTube/LinkedIn/TikTok)
  const youtubeBanner = useMemo<React.ReactNode | undefined>(() => {
    if (youtubeDetailData && youtubeDetailData.hasConnection === false) {
      return 'Nenhum canal YouTube conectado. Configure em Integrações para coletar métricas.';
    }
    return undefined;
  }, [youtubeDetailData]);

  const linkedinBanner = useMemo<React.ReactNode | undefined>(() => {
    if (linkedinDetailData && linkedinDetailData.hasConnection === false) {
      return 'Nenhuma organização LinkedIn conectada. Configure em Integrações para coletar métricas.';
    }
    return undefined;
  }, [linkedinDetailData]);

  const tiktokBanner = useMemo<React.ReactNode | undefined>(() => {
    if (tiktokDetailData && tiktokDetailData.hasConnection === false) {
      return 'Nenhuma conta TikTok conectada. Configure em Integrações para coletar métricas.';
    }
    return undefined;
  }, [tiktokDetailData]);

  const tiktokAdsBanner = useMemo<React.ReactNode | undefined>(() => {
    if (tiktokAdsDetailData && tiktokAdsDetailData.hasConnection === false) {
      return 'Nenhuma conta de anúncios TikTok (advertiser) conectada. Autorize o fluxo de Ads em Integrações.';
    }
    return undefined;
  }, [tiktokAdsDetailData]);

  const linkedinAdsBanner = useMemo<React.ReactNode | undefined>(() => {
    if (linkedinAdsDetailData && linkedinAdsDetailData.hasConnection === false) {
      return 'Nenhuma conta de anúncios LinkedIn conectada. Re-autorize com escopos de Ads em Integrações.';
    }
    return undefined;
  }, [linkedinAdsDetailData]);

  // Aprofundado sections with platform-specific metrics
  const aprofundadoPlatformSections: MetricSection[] = useMemo(() => [
    { title: 'Meta Ads', icon: <Megaphone className="w-5 h-5" />, metrics: metaAdsPlatformMetrics },
    { title: 'Google Ads', icon: <Megaphone className="w-5 h-5" />, metrics: googleAdsPlatformMetrics },
    { title: 'Instagram', icon: <Camera className="w-5 h-5" />, metrics: instagramPlatformMetrics, banner: instagramBanner },
    { title: 'YouTube', icon: <Play className="w-5 h-5" />, metrics: youtubePlatformMetrics, banner: youtubeBanner },
    { title: 'LinkedIn', icon: <Briefcase className="w-5 h-5" />, metrics: linkedinPlatformMetrics, banner: linkedinBanner },
    { title: 'TikTok', icon: <Music className="w-5 h-5" />, metrics: tiktokPlatformMetrics, banner: tiktokBanner },
    { title: 'TikTok Ads', icon: <Megaphone className="w-5 h-5" />, metrics: tiktokAdsPlatformMetrics, banner: tiktokAdsBanner },
    { title: 'LinkedIn Ads', icon: <Megaphone className="w-5 h-5" />, metrics: linkedinAdsPlatformMetrics, banner: linkedinAdsBanner },
  ], [metaAdsPlatformMetrics, googleAdsPlatformMetrics, instagramPlatformMetrics, instagramBanner, youtubePlatformMetrics, youtubeBanner, linkedinPlatformMetrics, linkedinBanner, tiktokPlatformMetrics, tiktokBanner, tiktokAdsPlatformMetrics, tiktokAdsBanner, linkedinAdsPlatformMetrics, linkedinAdsBanner]);

  const buildNaoMqlMetrics = (data: NaoMQLMetrics, investimento: number | null = null): Metric[] => {
    const invest = investimento ?? 0;
    const raCount = data.reunioesAgendadas ?? 0;
    const rrCount = data.reunioesRealizadas ?? 0;
    const cpraNmql = invest > 0 && raCount > 0 ? invest / raCount : null;
    const cprrNmql = invest > 0 && rrCount > 0 ? invest / rrCount : null;
    return [
      {
        id: 'nmql_ra_perc',
        name: '%RA não-MQL',
        type: 'manual',
        orcado: ORCADO_NAO_MQL.percReuniaoAgendada,
        realizado: data.percReuniaoAgendada ?? null,
        percentual: calcPercentual(ORCADO_NAO_MQL.percReuniaoAgendada, data.percReuniaoAgendada),
        format: 'percent'
      },
      {
        id: 'nmql_ra_num',
        name: 'Nº RA não-MQL',
        type: 'formula',
        orcado: ORCADO_NAO_MQL.reunioesAgendadas,
        realizado: data.reunioesAgendadas ?? 0,
        percentual: calcPercentual(ORCADO_NAO_MQL.reunioesAgendadas, data.reunioesAgendadas),
        format: 'number'
      },
      {
        id: 'nmql_cpra',
        name: 'CPRA não-MQL',
        type: 'formula',
        orcado: (ORCADO_NAO_MQL as any).cpraNmql ?? null,
        realizado: cpraNmql,
        percentual: calcPercentual((ORCADO_NAO_MQL as any).cpraNmql ?? null, cpraNmql),
        format: 'currency',
      },
      {
        id: 'nmql_rr_num',
        name: 'Nº RR não-MQL',
        type: 'formula',
        orcado: ORCADO_NAO_MQL.reunioesRealizadas,
        realizado: data.reunioesRealizadas ?? 0,
        percentual: calcPercentual(ORCADO_NAO_MQL.reunioesRealizadas, data.reunioesRealizadas),
        format: 'number'
      },
      {
        id: 'nmql_cprr',
        name: 'CPRR não-MQL',
        type: 'formula',
        orcado: (ORCADO_NAO_MQL as any).cprrNmql ?? null,
        realizado: cprrNmql,
        percentual: calcPercentual((ORCADO_NAO_MQL as any).cprrNmql ?? null, cprrNmql),
        format: 'currency',
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
        id: 'nmql_rr_perc',
        name: '%RR não-MQL',
        type: 'formula',
        orcado: ORCADO_NAO_MQL.percRr ?? null,
        realizado: data.totalNaoMqls > 0 ? data.reunioesRealizadas / data.totalNaoMqls : null,
        percentual: calcPercentual(ORCADO_NAO_MQL.percRr ?? null, data.totalNaoMqls > 0 ? data.reunioesRealizadas / data.totalNaoMqls : null),
        format: 'percent'
      },
      {
        id: 'nmql_taxa_vendas',
        name: 'RR→V% não-MQL',
        type: 'manual', 
        orcado: ORCADO_NAO_MQL.taxaVendas, 
        realizado: data.taxaVendas ?? null, 
        percentual: calcPercentual(ORCADO_NAO_MQL.taxaVendas, data.taxaVendas), 
        format: 'percent' 
      },
      {
        id: 'nmql_novos_clientes',
        name: 'Negócios Ganhos não-MQL',
        type: 'formula',
        orcado: ORCADO_NAO_MQL.novosClientes,
        realizado: data.dealsGanhos ?? 0,
        percentual: calcPercentual(ORCADO_NAO_MQL.novosClientes, data.dealsGanhos),
        format: 'number'
      },
      {
        id: 'nmql_contratos_ganhos',
        name: 'Contratos Ganhos não-MQL',
        type: 'formula',
        orcado: null,
        realizado: data.contratosGanhos ?? 0,
        percentual: null,
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
      {
        id: 'nmql_fat_total',
        name: 'Faturamento Total não-MQL',
        type: 'formula',
        orcado: ORCADO_NAO_MQL.faturamentoAceleracao + ORCADO_NAO_MQL.faturamentoImplantacao,
        realizado: (data.faturamentoAceleracao ?? 0) + (data.faturamentoImplantacao ?? 0),
        percentual: calcPercentual(ORCADO_NAO_MQL.faturamentoAceleracao + ORCADO_NAO_MQL.faturamentoImplantacao, (data.faturamentoAceleracao ?? 0) + (data.faturamentoImplantacao ?? 0)),
        format: 'currency'
      },
    ];
  };

  const naoMqlMetrics: Metric[] = useMemo(() => {
    const cur = buildNaoMqlMetrics(naoMqlData || {} as NaoMQLMetrics, adsData?.investimento ?? null);
    if (!prevNaoMqlData) return cur;
    return mergePrevRealizado(cur, buildNaoMqlMetrics(prevNaoMqlData, prevAdsData?.investimento ?? null));
  }, [naoMqlData, prevNaoMqlData, adsData, prevAdsData, ORCADO_NAO_MQL]);

  const buildTotalMetrics = (
    mql: MQLMetrics,
    naoMql: NaoMQLMetrics,
    ads: AdsMetrics,
  ): Metric[] => {
    const totalReunioesAgendadas = (mql.reunioesAgendadas ?? 0) + (naoMql.reunioesAgendadas ?? 0);
    const totalReunioesRealizadas = (mql.reunioesRealizadas ?? 0) + (naoMql.reunioesRealizadas ?? 0);
    const totalContratosAceleracao = (mql.contratosAceleracao ?? 0) + (naoMql.contratosAceleracao ?? 0);
    const totalContratosImplantacao = (mql.contratosImplantacao ?? 0) + (naoMql.contratosImplantacao ?? 0);
    const totalFatAceleracao = (mql.faturamentoAceleracao ?? 0) + (naoMql.faturamentoAceleracao ?? 0);
    const totalFatImplantacao = (mql.faturamentoImplantacao ?? 0) + (naoMql.faturamentoImplantacao ?? 0);
    const totalFaturamento = totalFatAceleracao + totalFatImplantacao;

    const totalMqls = mql.totalMqls ?? 0;
    const totalLeads = totalMqls + (naoMql.totalNaoMqls ?? 0);

    // Negócios Ganhos = deals, Contratos Ganhos = produtos
    const totalDealsGanhos = (mql.dealsGanhos ?? 0) + (naoMql.dealsGanhos ?? 0);
    const totalContratosGanhos = (mql.contratosGanhos ?? 0) + (naoMql.contratosGanhos ?? 0);

    const percNoShowReal = totalReunioesAgendadas > 0
      ? (totalReunioesAgendadas - totalReunioesRealizadas) / totalReunioesAgendadas
      : null;
    const percConversaoRRV = totalReunioesRealizadas > 0
      ? totalDealsGanhos / totalReunioesRealizadas
      : null;
    const taxaConversaoMQL = totalMqls > 0
      ? (mql.dealsGanhos ?? 0) / totalMqls
      : null;

    const ticketMedioGeral = totalDealsGanhos > 0
      ? totalFaturamento / totalDealsGanhos
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
      ? totalDealsGanhos / totalLeads
      : null;

    const investimento = ads.investimento ?? 0;
    const cacInboundOrcado = ORCADO_TOTAL.novosClientes > 0 ? ORCADO_ADS.investimento / ORCADO_TOTAL.novosClientes : 0;
    const cacInboundReal = totalDealsGanhos > 0 ? investimento / totalDealsGanhos : null;
    const cacContratoReal = totalContratosGanhos > 0 ? investimento / totalContratosGanhos : null;

    return [
      { id: 'total_perc_ra', name: '% RA', type: 'formula', orcado: ORCADO_TOTAL.percRA, realizado: percRA, percentual: calcPercentual(ORCADO_TOTAL.percRA, percRA), format: 'percent' },
      { id: 'total_ra', name: 'RA', type: 'formula', orcado: ORCADO_TOTAL.reunioesAgendadas, realizado: totalReunioesAgendadas, percentual: calcPercentual(ORCADO_TOTAL.reunioesAgendadas, totalReunioesAgendadas), format: 'number' },
      { id: 'total_cpra', name: 'CPRA', type: 'formula', orcado: null, realizado: investimento > 0 && totalReunioesAgendadas > 0 ? investimento / totalReunioesAgendadas : null, percentual: null, format: 'currency' },
      { id: 'total_rr', name: 'RR', type: 'formula', orcado: ORCADO_TOTAL.reunioesRealizadas, realizado: totalReunioesRealizadas, percentual: calcPercentual(ORCADO_TOTAL.reunioesRealizadas, totalReunioesRealizadas), format: 'number' },
      { id: 'total_cprr', name: 'CPRR', type: 'formula', orcado: null, realizado: investimento > 0 && totalReunioesRealizadas > 0 ? investimento / totalReunioesRealizadas : null, percentual: null, format: 'currency' },
      { id: 'total_noshow', name: 'No show', type: 'formula', orcado: ORCADO_TOTAL.percNoShow, realizado: percNoShowReal, percentual: calcPercentual(ORCADO_TOTAL.percNoShow, percNoShowReal), format: 'percent' },
      { id: 'total_perc_rr', name: '% RR', type: 'formula', orcado: ORCADO_TOTAL.percRr ?? null, realizado: totalLeads > 0 ? totalReunioesRealizadas / totalLeads : null, percentual: calcPercentual(ORCADO_TOTAL.percRr ?? null, totalLeads > 0 ? totalReunioesRealizadas / totalLeads : null), format: 'percent' },
      { id: 'total_conv_rrv', name: 'RR→V%', type: 'formula', orcado: ORCADO_TOTAL.percConversaoRRV, realizado: percConversaoRRV, percentual: calcPercentual(ORCADO_TOTAL.percConversaoRRV, percConversaoRRV), format: 'percent' },
      { id: 'total_novos_clientes', name: 'Negócios Ganhos', type: 'formula', orcado: ORCADO_TOTAL.novosClientes, realizado: totalDealsGanhos, percentual: calcPercentual(ORCADO_TOTAL.novosClientes, totalDealsGanhos), format: 'number' },
      { id: 'total_contratos_ganhos', name: 'Contratos Ganhos', type: 'formula', orcado: null, realizado: totalContratosGanhos, percentual: null, format: 'number' },
      { id: 'total_ganhos_acel', name: 'Negócios Ganhos Aceleração', type: 'formula', orcado: ORCADO_TOTAL.contratosAceleracao, realizado: totalContratosAceleracao, percentual: calcPercentual(ORCADO_TOTAL.contratosAceleracao, totalContratosAceleracao), format: 'number', emoji: '🏎️' },
      { id: 'total_ganhos_impl', name: 'Negócios Ganhos Implantação', type: 'formula', orcado: ORCADO_TOTAL.contratosImplantacao, realizado: totalContratosImplantacao, percentual: calcPercentual(ORCADO_TOTAL.contratosImplantacao, totalContratosImplantacao), format: 'number', emoji: '🔧' },
      { id: 'total_faturamento', name: 'Faturamento Total', type: 'formula', orcado: ORCADO_TOTAL.faturamentoTotal, realizado: totalFaturamento, percentual: calcPercentual(ORCADO_TOTAL.faturamentoTotal, totalFaturamento), format: 'currency' },
      { id: 'total_fat_acel', name: 'Faturamento A', type: 'formula', orcado: ORCADO_TOTAL.faturamentoAceleracao, realizado: totalFatAceleracao, percentual: calcPercentual(ORCADO_TOTAL.faturamentoAceleracao, totalFatAceleracao), format: 'currency', emoji: '🏎️' },
      { id: 'total_fat_impl', name: 'Faturamento I', type: 'formula', orcado: ORCADO_TOTAL.faturamentoImplantacao, realizado: totalFatImplantacao, percentual: calcPercentual(ORCADO_TOTAL.faturamentoImplantacao, totalFatImplantacao), format: 'currency', emoji: '🔧' },
      { id: 'total_conv_funil', name: 'Taxa de Conversão do Funil inteiro', type: 'formula', orcado: ORCADO_TOTAL.taxaConversaoFunil, realizado: taxaConversaoFunil, percentual: calcPercentual(ORCADO_TOTAL.taxaConversaoFunil, taxaConversaoFunil), format: 'percent' },
      { id: 'total_conv_mql', name: 'Tx de conversão MQL', type: 'formula', orcado: ORCADO_TOTAL.taxaConversaoMQL, realizado: taxaConversaoMQL, percentual: calcPercentual(ORCADO_TOTAL.taxaConversaoMQL, taxaConversaoMQL), format: 'percent' },
      { id: 'total_cac_ads', name: 'CAC - Negócios', type: 'formula', orcado: cacInboundOrcado, realizado: cacInboundReal, percentual: calcPercentual(cacInboundOrcado, cacInboundReal), format: 'currency' },
      { id: 'total_cac_contrato', name: 'CAC - Contrato', type: 'formula', orcado: null, realizado: cacContratoReal, percentual: null, format: 'currency' },
      { id: 'total_ticket_geral', name: 'Ticket Médio Geral', type: 'formula', orcado: ORCADO_TOTAL.ticketMedioGeral, realizado: ticketMedioGeral, percentual: calcPercentual(ORCADO_TOTAL.ticketMedioGeral, ticketMedioGeral), format: 'currency' },
      { id: 'total_ticket_acel', name: 'Ticket Médio Aceleração', type: 'formula', orcado: ORCADO_TOTAL.ticketMedioAceleracao, realizado: ticketMedioAceleracao, percentual: calcPercentual(ORCADO_TOTAL.ticketMedioAceleracao, ticketMedioAceleracao), format: 'currency' },
      { id: 'total_ticket_impl', name: 'Ticket Médio Implantação', type: 'formula', orcado: ORCADO_TOTAL.ticketMedioImplantacao, realizado: ticketMedioImplantacao, percentual: calcPercentual(ORCADO_TOTAL.ticketMedioImplantacao, ticketMedioImplantacao), format: 'currency' },
    ];
  };

  const totalMetrics: Metric[] = useMemo(() => {
    const cur = buildTotalMetrics(
      mqlData || {} as MQLMetrics,
      naoMqlData || {} as NaoMQLMetrics,
      adsData || {} as AdsMetrics,
    );
    if (!prevMqlData && !prevNaoMqlData && !prevAdsData) return cur;
    const prev = buildTotalMetrics(
      prevMqlData || {} as MQLMetrics,
      prevNaoMqlData || {} as NaoMQLMetrics,
      prevAdsData || {} as AdsMetrics,
    );
    return mergePrevRealizado(cur, prev);
  }, [mqlData, naoMqlData, adsData, prevMqlData, prevNaoMqlData, prevAdsData, ORCADO_MQL, ORCADO_NAO_MQL, ORCADO_ADS, ORCADO_TOTAL]);
  
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

  // Aprofundado uses platform-specific sections filtered by selected platform
  const PLATFORM_OPTIONS = [
    { key: 'todos', label: 'Todas as Plataformas' },
    { key: 'meta_ads', label: 'Meta Ads' },
    { key: 'google_ads', label: 'Google Ads' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'tiktok_ads', label: 'TikTok Ads' },
    { key: 'linkedin_ads', label: 'LinkedIn Ads' },
  ];

  const aprofundadoFilteredSections: MetricSection[] = useMemo(() => {
    const platformMap: Record<string, MetricSection> = {
      meta_ads: aprofundadoPlatformSections[0],
      google_ads: aprofundadoPlatformSections[1],
      instagram: aprofundadoPlatformSections[2],
      youtube: aprofundadoPlatformSections[3],
      linkedin: aprofundadoPlatformSections[4],
      tiktok: aprofundadoPlatformSections[5],
      tiktok_ads: aprofundadoPlatformSections[6],
      linkedin_ads: aprofundadoPlatformSections[7],
    };
    if (selectedPlataformas.length === 0) {
      return [
        ...marketingSections,
        { title: 'Vendas — MQL', icon: <Users className="w-5 h-5" />, metrics: mqlMetrics },
        { title: 'Vendas — Não-MQL', icon: <Users className="w-5 h-5" />, metrics: naoMqlMetrics },
        totalSection,
      ];
    }
    const platformSections = selectedPlataformas
      .map(p => platformMap[p])
      .filter(Boolean);
    return [
      ...(platformSections.length > 0 ? platformSections : [aprofundadoPlatformSections[0]]),
      { title: 'Vendas — MQL', icon: <Users className="w-5 h-5" />, metrics: mqlMetrics },
      { title: 'Vendas — Não-MQL', icon: <Users className="w-5 h-5" />, metrics: naoMqlMetrics },
      totalSection,
    ];
  }, [aprofundadoPlatformSections, selectedPlataformas, marketingSections, mqlMetrics, naoMqlMetrics, totalSection]);

  // Métricas amarelas para a aba Consolidado (filtradas por seção)
  const YELLOW_METRIC_IDS = new Set([
    'investimento', 'leads', 'mqls', 'cpl', 'cpmql', 'perc_mqls',
    // MQL
    'mql_ra_perc', 'mql_noshow', 'mql_rr_perc', 'mql_taxa_vendas', 'mql_novos_clientes', 'mql_contratos_ganhos', 'mql_ticket_acel', 'mql_ticket_impl', 'mql_fat_total',
    // Não-MQL
    'nmql_ra_perc', 'nmql_noshow', 'nmql_rr_perc', 'nmql_taxa_vendas', 'nmql_novos_clientes', 'nmql_contratos_ganhos', 'nmql_ticket_acel', 'nmql_ticket_impl', 'nmql_fat_total',
    // Total
    'total_perc_ra', 'total_perc_rr', 'total_conv_rrv', 'total_novos_clientes',
    'total_contratos_ganhos',
    'total_faturamento', 'total_cac_ads', 'total_cac_contrato',
    'total_ticket_acel', 'total_ticket_impl',
    // Consolidado por plataforma — só o essencial, por tipo de canal.
    // Pagos: eficiência (Invest · Connect Rate · Tx Conversão) + resultado (Leads → %MQL)
    ...['meta', 'gads', 'tta', 'lia'].flatMap(p => [
      `${p}_investimento`, `${p}_connectRate`, `${p}_taxaConversaoPagina`,
      `${p}_leads`, `${p}_mqls`, `${p}_cpl`, `${p}_cpmql`, `${p}_percMqls`,
    ]),
    // Instagram orgânico: clique na bio + posts + resultado (pode ter verba de boost → CPL/CPMQL)
    'ig_postsPublicados', 'ig_cliquesLinkBio',
    'ig_leads', 'ig_mqls', 'ig_cpl', 'ig_cpmql', 'ig_percMqls',
    // YouTube orgânico: vídeos publicados + resultado
    'yt_videosPublicados', 'yt_leads', 'yt_mqls', 'yt_percMqls',
    // LinkedIn orgânico: posts publicados + resultado
    'li_postsPublicados', 'li_leads', 'li_mqls', 'li_percMqls',
    // TikTok orgânico: vídeos publicados + resultado
    'tt_videosPublicados', 'tt_leads', 'tt_mqls', 'tt_percMqls',
  ]);

  const consolidadoSections: MetricSection[] = useMemo(() => {
    // When a specific platform is selected, use platform metrics for the marketing section
    const platformMap: Record<string, MetricSection> = {
      meta_ads: aprofundadoPlatformSections[0],
      google_ads: aprofundadoPlatformSections[1],
      instagram: aprofundadoPlatformSections[2],
      youtube: aprofundadoPlatformSections[3],
      linkedin: aprofundadoPlatformSections[4],
      tiktok: aprofundadoPlatformSections[5],
      tiktok_ads: aprofundadoPlatformSections[6],
      linkedin_ads: aprofundadoPlatformSections[7],
    };

    let baseSections: MetricSection[];
    if (selectedPlataformas.length > 0) {
      // Replace marketing section with selected platform(s)' metrics
      const platformSections = selectedPlataformas
        .map(p => platformMap[p])
        .filter(Boolean);
      if (platformSections.length > 0) {
        baseSections = [
          ...platformSections,
          ...allSections.filter(s => s.title !== 'Métricas de Marketing'),
        ];
      } else {
        baseSections = allSections;
      }
    } else {
      baseSections = allSections;
    }

    return baseSections
      .map(section => ({
        ...section,
        metrics: section.metrics.filter(m => YELLOW_METRIC_IDS.has(m.id))
      }))
      .filter(section => section.metrics.length > 0);
  }, [allSections, selectedPlataformas, aprofundadoPlatformSections]);

  const getExportParams = (viewName: 'Consolidado' | 'Aprofundado'): ExportParams => {
    const plataformaLabels: Record<string, string> = {
      meta_ads: 'Meta Ads', google_ads: 'Google Ads', instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn', tiktok: 'TikTok', tiktok_ads: 'TikTok Ads', linkedin_ads: 'LinkedIn Ads',
    };
    return {
      sections: viewName === 'Consolidado' ? consolidadoSections : aprofundadoFilteredSections,
      viewName,
      dateLabel: `${dateRange.startDate}_${dateRange.endDate}`,
      propDias,
      diasRestantes,
      totalDias,
      periodo: `${dateRange.startDate} a ${dateRange.endDate}`,
      plataformas: selectedPlataformas.length > 0
        ? selectedPlataformas.map(p => plataformaLabels[p] || p).join(', ')
        : 'Todas',
      produtos: selectedProdutos.length > 0 ? selectedProdutos.join(', ') : 'Todos',
      origem: 'Todos',
      contagem: 'Negócios (Deals) + Contratos (Produtos)',
    };
  };

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

  // Helper para calcular variação vs período anterior
  const calcVariation = (current: number, previous: number | undefined): { pct: number; isPositive: boolean } | null => {
    if (previous === undefined || previous === null || previous === 0) return null;
    const pct = ((current - previous) / previous) * 100;
    return { pct, isPositive: pct >= 0 };
  };

  // Negócios Ganhos
  const clientesRealizado = (mqlData?.dealsGanhos ?? 0) + (naoMqlData?.dealsGanhos ?? 0);
  const clientesOrcado = ORCADO_MQL.novosClientes + ORCADO_NAO_MQL.novosClientes;
  const clientesPerc = clientesOrcado > 0 ? (clientesRealizado / clientesOrcado) * 100 : 0;

  const heroDealsRealizado = clientesRealizado;
  const heroContratosRealizado = (mqlData?.contratosGanhos ?? 0) + (naoMqlData?.contratosGanhos ?? 0);

  // Faturamento: todo faturamento inbound (Negócio Ganho no período, qualquer canal).
  // Filtros de Produto/Plataforma narrow ortogonalmente — quem quiser só pago, filtra Plataforma=Meta+Google.
  const faturamentoRealizado = (mqlData?.faturamentoAceleracao ?? 0) + (mqlData?.faturamentoImplantacao ?? 0)
    + (naoMqlData?.faturamentoAceleracao ?? 0) + (naoMqlData?.faturamentoImplantacao ?? 0);
  const faturamentoOrcado = ORCADO_MQL.faturamentoAceleracao + ORCADO_MQL.faturamentoImplantacao
    + ORCADO_NAO_MQL.faturamentoAceleracao + ORCADO_NAO_MQL.faturamentoImplantacao;
  const faturamentoPerc = faturamentoOrcado > 0 ? (faturamentoRealizado / faturamentoOrcado) * 100 : 0;

  // Breakdown recorrente vs pontual (para exibir no card)
  const fatRecorrenteRealizado = (mqlData?.faturamentoAceleracao ?? 0) + (naoMqlData?.faturamentoAceleracao ?? 0);
  const fatPontualRealizado = (mqlData?.faturamentoImplantacao ?? 0) + (naoMqlData?.faturamentoImplantacao ?? 0);

  // Previous period values for hero cards
  const prevInvestimento = prevAdsData?.investimento ?? 0;
  const prevLeads = prevAdsData?.leads ?? 0;
  const prevClientes = (prevMqlData?.dealsGanhos ?? 0) + (prevNaoMqlData?.dealsGanhos ?? 0);
  const prevFaturamento = (prevMqlData?.faturamentoAceleracao ?? 0) + (prevMqlData?.faturamentoImplantacao ?? 0)
    + (prevNaoMqlData?.faturamentoAceleracao ?? 0) + (prevNaoMqlData?.faturamentoImplantacao ?? 0);

  const prevCac = prevClientes > 0 ? prevInvestimento / prevClientes : 0;

  const cacRealizado = clientesRealizado > 0 ? investimentoRealizado / clientesRealizado : 0;
  const cacOrcado = clientesOrcado > 0 ? investimentoOrcado / clientesOrcado : 0;
  const cacPerc = cacOrcado > 0 ? (cacRealizado / cacOrcado) * 100 : 0;
  const cacContratoRealizado = heroContratosRealizado > 0 ? investimentoRealizado / heroContratosRealizado : 0;

  const investimentoVar = calcVariation(investimentoRealizado, prevInvestimento);
  const leadsVar = calcVariation(mqlsRealizado, prevLeads);
  const clientesVar = calcVariation(clientesRealizado, prevClientes);
  const faturamentoVar = calcVariation(faturamentoRealizado, prevFaturamento);
  const cacVar = calcVariation(cacRealizado, prevCac);

  return (
    <div className="p-6 space-y-6" data-testid="growth-orcado-realizado-page">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-stretch">
        {/* Investimento */}
        <Card className="border bg-card flex flex-col">
          <CardContent className="pt-4 pb-3 px-4 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Investimento</span>
              <Badge variant="outline" className={cn("text-[10px] font-mono tabular-nums",
                investimentoPerc >= 100 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" :
                investimentoPerc >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950" :
                "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
              )}>
                {investimentoPerc.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-xl font-bold tracking-tight mb-1">
              {adsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatValue(investimentoRealizado, 'currency')}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Meta: {formatValue(investimentoOrcado, 'currency')}
            </div>
            {investimentoVar && (
              <div className={cn("flex items-center gap-1 text-[10px] mt-0.5",
                investimentoVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {investimentoVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{investimentoVar.isPositive ? '+' : ''}{investimentoVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
            <div className="mt-auto pt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500",
                investimentoPerc >= 100 ? "bg-emerald-500" : investimentoPerc >= 80 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${Math.min(investimentoPerc, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Leads Totais */}
        <Card className="border bg-card flex flex-col">
          <CardContent className="pt-4 pb-3 px-4 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{mqlsLabel}</span>
              <Badge variant="outline" className={cn("text-[10px] font-mono tabular-nums",
                mqlsPerc >= 100 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" :
                mqlsPerc >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950" :
                "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
              )}>
                {mqlsPerc.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-xl font-bold tracking-tight mb-1">
              {mqlLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : mqlsRealizado}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Meta: {mqlsOrcado.toLocaleString('pt-BR')} leads
            </div>
            {leadsVar && (
              <div className={cn("flex items-center gap-1 text-[10px] mt-0.5",
                leadsVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {leadsVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{leadsVar.isPositive ? '+' : ''}{leadsVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
            <div className="mt-auto pt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500",
                mqlsPerc >= 100 ? "bg-emerald-500" : mqlsPerc >= 80 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${Math.min(mqlsPerc, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Negócios Ganhos */}
        <Card className="border bg-card flex flex-col">
          <CardContent className="pt-4 pb-3 px-4 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Negócios Ganhos</span>
              <Badge variant="outline" className={cn("text-[10px] font-mono tabular-nums",
                clientesPerc >= 100 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" :
                clientesPerc >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950" :
                "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
              )}>
                {clientesPerc.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-xl font-bold tracking-tight mb-1">
              {(mqlLoading || naoMqlLoading) ? <Loader2 className="w-5 h-5 animate-spin" /> : heroDealsRealizado}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Meta: {clientesOrcado} negócios
            </div>
            {clientesVar && (
              <div className={cn("flex items-center gap-1 text-[10px] mt-0.5",
                clientesVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {clientesVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{clientesVar.isPositive ? '+' : ''}{clientesVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
            {!(mqlLoading || naoMqlLoading) && (
              <div className="flex items-center gap-2 text-[10px] mt-1.5">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="text-muted-foreground">Contratos:</span>
                  <span className="font-medium">{heroContratosRealizado}</span>
                </div>
              </div>
            )}
            <div className="mt-auto pt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500",
                clientesPerc >= 100 ? "bg-emerald-500" : clientesPerc >= 80 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${Math.min(clientesPerc, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* CAC */}
        <Card className="border bg-card flex flex-col">
          <CardContent className="pt-4 pb-3 px-4 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">CAC Negócio</span>
              <Badge variant="outline" className={cn("text-[10px] font-mono tabular-nums",
                cacPerc <= 100 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" :
                cacPerc <= 120 ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950" :
                "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
              )}>
                {cacPerc.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-xl font-bold tracking-tight mb-1">
              {(adsLoading || mqlLoading || naoMqlLoading) ? <Loader2 className="w-5 h-5 animate-spin" /> : formatValue(cacRealizado, 'currency')}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Meta: {formatValue(cacOrcado, 'currency')}
            </div>
            {cacVar && (
              <div className={cn("flex items-center gap-1 text-[10px] mt-0.5",
                !cacVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {!cacVar.isPositive ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                <span>{cacVar.isPositive ? '+' : ''}{cacVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
            {!(adsLoading || mqlLoading || naoMqlLoading) && (
              <div className="flex items-center gap-2 text-[10px] mt-1.5">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="text-muted-foreground">Contrato:</span>
                  <span className="font-medium">{formatValue(cacContratoRealizado, 'currency')}</span>
                </div>
              </div>
            )}
            <div className="mt-auto pt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500",
                cacPerc <= 100 ? "bg-emerald-500" : cacPerc <= 120 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${Math.min(cacPerc, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Faturamento */}
        <Card className="border bg-card flex flex-col">
          <CardContent className="pt-4 pb-3 px-4 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Faturamento</span>
              <Badge variant="outline" className={cn("text-[10px] font-mono tabular-nums",
                faturamentoPerc >= 100 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950" :
                faturamentoPerc >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950" :
                "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950"
              )}>
                {faturamentoPerc.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-xl font-bold tracking-tight mb-1">
              {(mqlLoading || naoMqlLoading) ? <Loader2 className="w-5 h-5 animate-spin" /> : formatValue(faturamentoRealizado, 'currency')}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Meta: {formatValue(faturamentoOrcado, 'currency')}
            </div>
            {faturamentoVar && (
              <div className={cn("flex items-center gap-1 text-[10px] mt-0.5",
                faturamentoVar.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {faturamentoVar.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{faturamentoVar.isPositive ? '+' : ''}{faturamentoVar.pct.toFixed(1)}% vs anterior</span>
              </div>
            )}
            {!(mqlLoading || naoMqlLoading) && (
              <div className="flex items-center gap-2 text-[10px] mt-1.5">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Rec:</span>
                  <span className="font-medium">{formatValue(fatRecorrenteRealizado, 'currency')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground">Pont:</span>
                  <span className="font-medium">{formatValue(fatPontualRealizado, 'currency')}</span>
                </div>
              </div>
            )}
            <div className="mt-auto pt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500",
                faturamentoPerc >= 100 ? "bg-emerald-500" : faturamentoPerc >= 80 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${Math.min(faturamentoPerc, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Seção + Filtros */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
          {([
            { key: 'consolidado', label: 'Consolidado' },
            { key: 'aprofundado', label: 'Aprofundado' },
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

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Produto:</span>
            <MultiSelect
              options={(funis || []).map(f => ({ value: f, label: f }))}
              selected={selectedProdutos}
              onChange={setSelectedProdutos}
              placeholder="Todos os Produtos"
              className="w-[180px] text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Plataforma:</span>
            <MultiSelect
              options={PLATFORM_MULTISELECT_OPTIONS}
              selected={selectedPlataformas}
              onChange={setSelectedPlataformas}
              placeholder="Todas as Plataformas"
              className="w-[180px] text-xs"
            />
          </div>
          <DateRangePicker
            value={customDateRange}
            onChange={(range) => {
              setCustomDateRange(range);
              if (range?.from) {
                const newMonth = format(range.from, 'yyyy-MM');
                if (newMonth !== selectedMonth) {
                  setSelectedMonth(newMonth);
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

      {/* Tabelas de Métricas */}
      <div className="space-y-6">
        {/* Consolidado */}
        {activeSection === 'consolidado' && (
        <Card className="border bg-card">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Consolidado</CardTitle>
              <div className="flex items-center gap-2">
                {(adsLoading || mqlLoading || naoMqlLoading) && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportOrcadoRealizadoCSV(getExportParams('Consolidado'))} className="gap-2 cursor-pointer">
                      <FileText className="w-4 h-4" />
                      Exportar CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportOrcadoRealizadoXLSX(getExportParams('Consolidado'))} className="gap-2 cursor-pointer">
                      <FileSpreadsheet className="w-4 h-4" />
                      Exportar Excel (.xlsx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Métrica</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Orçado</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">
                    <div className="flex items-start justify-end gap-1">
                      <div className="flex flex-col items-end leading-tight">
                        <span>Realizado</span>
                        {showCompareColumns && currentRangeLabel && (
                          <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                            {currentRangeLabel}
                          </span>
                        )}
                      </div>
                      {compareActive && (
                        <button
                          type="button"
                          onClick={() => setCompareColumnsOpen(v => !v)}
                          className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title={showCompareColumns ? 'Recolher comparação' : 'Expandir comparação'}
                          aria-label={showCompareColumns ? 'Recolher comparação' : 'Expandir comparação'}
                          data-testid="toggle-compare-columns"
                        >
                          {showCompareColumns ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </TableHead>
                  {showCompareColumns && (
                    <>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">
                        <div className="flex flex-col items-end leading-tight">
                          <span>Anterior</span>
                          {compareRangeLabel && (
                            <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                              {compareRangeLabel}
                            </span>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Alteração</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Alteração %</TableHead>
                    </>
                  )}
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">% Atingido</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Desvio Meta</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Previsão As Is</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Recálculo Meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderMetricTableBody(consolidadoSections)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

        {/* Aprofundado — métricas por plataforma */}
        {activeSection === 'aprofundado' && (
        <Card className="border bg-card">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Aprofundado</CardTitle>
              <div className="flex items-center gap-2">
                {(adsLoading || mqlLoading || naoMqlLoading) && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportOrcadoRealizadoCSV(getExportParams('Aprofundado'))} className="gap-2 cursor-pointer">
                      <FileText className="w-4 h-4" />
                      Exportar CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportOrcadoRealizadoXLSX(getExportParams('Aprofundado'))} className="gap-2 cursor-pointer">
                      <FileSpreadsheet className="w-4 h-4" />
                      Exportar Excel (.xlsx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Métrica</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Orçado</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">
                    <div className="flex items-start justify-end gap-1">
                      <div className="flex flex-col items-end leading-tight">
                        <span>Realizado</span>
                        {showCompareColumns && currentRangeLabel && (
                          <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                            {currentRangeLabel}
                          </span>
                        )}
                      </div>
                      {compareActive && (
                        <button
                          type="button"
                          onClick={() => setCompareColumnsOpen(v => !v)}
                          className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title={showCompareColumns ? 'Recolher comparação' : 'Expandir comparação'}
                          aria-label={showCompareColumns ? 'Recolher comparação' : 'Expandir comparação'}
                          data-testid="toggle-compare-columns"
                        >
                          {showCompareColumns ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </TableHead>
                  {showCompareColumns && (
                    <>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">
                        <div className="flex flex-col items-end leading-tight">
                          <span>Anterior</span>
                          {compareRangeLabel && (
                            <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                              {compareRangeLabel}
                            </span>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Alteração</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Alteração %</TableHead>
                    </>
                  )}
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">% Atingido</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Desvio Meta</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Previsão As Is</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Recálculo Meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderMetricTableBody(aprofundadoFilteredSections)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

      </div>

    </div>
  );
}
