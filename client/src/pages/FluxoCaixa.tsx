import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { YearPicker } from "@/components/ui/year-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip as TooltipUI, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowUpCircle, ArrowDownCircle, Building2,
  CalendarDays, Receipt,
  Loader2, X, UserCheck, UserX, AlertTriangle, BarChart3, Download, Info
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ReferenceLine
} from "recharts";
import type { FluxoCaixaDiarioCompleto, FluxoCaixaInsightsPeriodo, ContaBanco, ClassificacaoClientesResponse, FluxoCaixaMensalResponse } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { HeroMetric } from "@/components/HeroMetric";
import { StatsCardV2 } from "@/components/StatsCardV2";
import RelatorioSemanalFinanceiro from "./RelatorioSemanalFinanceiro";

interface FluxoDiaDetalhe {
  entradas: {
    id: number;
    descricao: string;
    valor: number;
    status: string;
    categoria: string;
    meioPagamento: string;
    conta: string;
    fornecedor: string;
  }[];
  saidas: {
    id: number;
    descricao: string;
    valor: number;
    status: string;
    categoria: string;
    meioPagamento: string;
    conta: string;
    fornecedor: string;
  }[];
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatDateFull = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getMesNome = (mes: number, ano: number) => {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${meses[mes]} ${ano}`;
};

const classificacaoConfig: Record<string, { label: string; color: string }> = {
  em_dia: { label: "Em dia", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  receoso: { label: "Receoso", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  duvidoso: { label: "Duvidoso", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

export default function FluxoCaixa() {
  usePageTitle("Fluxo de Caixa");
  useSetPageInfo("Fluxo de Caixa", "Análise de entradas e saídas do período");
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const hoje = new Date();
  const [viewMode, setViewMode] = useState<'diario' | 'mensal' | 'semanal'>('diario');
  const [selectedMonth, setSelectedMonth] = useState({ month: hoje.getMonth() + 1, year: hoje.getFullYear() });
  const [selectedYear, setSelectedYear] = useState(hoje.getFullYear());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [showInactiveAccounts, setShowInactiveAccounts] = useState(false);
  const [contaFinanceiraFiltro, setContaFinanceiraFiltro] = useState<string>('todas');

  const dataInicio = useMemo(() => {
    return new Date(selectedMonth.year, selectedMonth.month - 1, 1).toISOString().split('T')[0];
  }, [selectedMonth]);

  const dataFim = useMemo(() => {
    return new Date(selectedMonth.year, selectedMonth.month, 0).toISOString().split('T')[0];
  }, [selectedMonth]);

  const insightsDataInicio = useMemo(() => {
    return viewMode === 'diario' ? dataInicio : `${selectedYear}-01-01`;
  }, [viewMode, dataInicio, selectedYear]);

  const insightsDataFim = useMemo(() => {
    return viewMode === 'diario' ? dataFim : `${selectedYear}-12-31`;
  }, [viewMode, dataFim, selectedYear]);

  const periodoLabel = useMemo(() => {
    return getMesNome(selectedMonth.month - 1, selectedMonth.year);
  }, [selectedMonth]);

  const { data: insightsPeriodo, isLoading: isLoadingInsights } = useQuery<FluxoCaixaInsightsPeriodo>({
    queryKey: ['/api/fluxo-caixa/insights-periodo', { dataInicio: insightsDataInicio, dataFim: insightsDataFim }],
    queryFn: async () => {
      const params = new URLSearchParams({ dataInicio: insightsDataInicio, dataFim: insightsDataFim });
      const res = await fetch(`/api/fluxo-caixa/insights-periodo?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled: !!insightsDataInicio && !!insightsDataFim,
  });

  const { data: contasBancos, isLoading: isLoadingContas } = useQuery<ContaBanco[]>({
    queryKey: ['/api/fluxo-caixa/contas-bancos'],
  });

  const { data: contasFinanceiras } = useQuery<string[]>({
    queryKey: ['/api/fluxo-caixa/contas-financeiras'],
  });

  const { data: classificacaoData, isLoading: isLoadingClassificacao } = useQuery<ClassificacaoClientesResponse>({
    queryKey: ['/api/fluxo-caixa/classificacao-clientes'],
  });

  const [classificacaoFiltro, setClassificacaoFiltro] = useState<string[]>([]);

  const toggleClassificacao = (tipo: string) => {
    setClassificacaoFiltro(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  const classificacaoParam = classificacaoFiltro.length > 0 ? classificacaoFiltro.join(',') : undefined;

  const contaFinanceiraParam = contaFinanceiraFiltro !== 'todas' ? contaFinanceiraFiltro : undefined;

  const { data: fluxoDiarioResponse, isLoading: isLoadingFluxo } = useQuery<{ hasSnapshot: boolean; snapshotDate: string | null; dados: FluxoCaixaDiarioCompleto[] }>({
    queryKey: ['/api/fluxo-caixa/diario-completo', { dataInicio, dataFim, classificacao: classificacaoParam, contaFinanceira: contaFinanceiraParam }],
    queryFn: async () => {
      const params = new URLSearchParams({ dataInicio, dataFim });
      if (classificacaoParam) {
        params.append('classificacao', classificacaoParam);
      }
      if (contaFinanceiraParam) {
        params.append('contaFinanceira', contaFinanceiraParam);
      }
      const res = await fetch(`/api/fluxo-caixa/diario-completo?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch fluxo diario");
      return res.json();
    },
    enabled: viewMode === 'diario' && !!dataInicio && !!dataFim,
  });

  const { data: fluxoMensalResponse, isLoading: isLoadingFluxoMensal } = useQuery<FluxoCaixaMensalResponse>({
    queryKey: ['/api/fluxo-caixa/mensal', { ano: selectedYear, classificacao: classificacaoParam }],
    queryFn: async () => {
      const params = new URLSearchParams({ ano: String(selectedYear) });
      if (classificacaoParam) {
        params.append('classificacao', classificacaoParam);
      }
      const res = await fetch(`/api/fluxo-caixa/mensal?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch fluxo mensal");
      return res.json();
    },
    enabled: viewMode === 'mensal',
  });

  const fluxoDiario = fluxoDiarioResponse?.dados;
  const hasSnapshot = fluxoDiarioResponse?.hasSnapshot ?? false;
  const isLoadingChart = viewMode === 'diario' ? isLoadingFluxo : isLoadingFluxoMensal;

  const { data: diaDetalhe, isLoading: isLoadingDiaDetalhe } = useQuery<FluxoDiaDetalhe>({
    queryKey: ['/api/fluxo-caixa/dia-detalhe', diaSelecionado],
    queryFn: async () => {
      const res = await fetch(`/api/fluxo-caixa/dia-detalhe?data=${diaSelecionado}`);
      if (!res.ok) throw new Error("Failed to fetch dia detalhe");
      return res.json();
    },
    enabled: !!diaSelecionado,
  });

  const chartData = useMemo(() => {
    if (viewMode === 'diario') {
      if (!fluxoDiario) return [];
      return fluxoDiario.map(item => ({
        ...item,
        dataFormatada: formatDate(item.data),
      }));
    } else {
      if (!fluxoMensalResponse?.dados) return [];
      return fluxoMensalResponse.dados.map(item => ({
        ...item,
        data: item.mes,
        dataFormatada: item.mesLabel,
        entradas: item.entradas,
        saidas: item.saidas,
        saldoDia: item.saldoMes,
        saldoAcumulado: item.saldoAcumulado,
      }));
    }
  }, [viewMode, fluxoDiario, fluxoMensalResponse]);

  const chartDomains = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { barsMax: 100000, lineMin: 0, lineMax: 100000 };
    }

    const maxEntrada = Math.max(...chartData.map(d => d.entradas || 0));
    const maxSaida = Math.max(...chartData.map(d => d.saidas || 0));
    const barsAbsMax = Math.max(maxEntrada, maxSaida) * 1.1 || 100000;
    const barsMax = Math.ceil(barsAbsMax / 50000) * 50000;

    const saldosReal = chartData.map(d => d.saldoAcumulado || 0);
    const saldosEsperado = hasSnapshot ? chartData.map(d => d.saldoEsperado || 0) : [];
    const allSaldos = [...saldosReal, ...saldosEsperado];
    const lineMin = Math.min(...allSaldos);
    const lineMax = Math.max(...allSaldos);
    const linePadding = (lineMax - lineMin) * 0.1 || 100000;

    return {
      barsMax,
      lineMin: Math.floor((lineMin - linePadding) / 100000) * 100000,
      lineMax: Math.ceil((lineMax + linePadding) / 100000) * 100000,
    };
  }, [chartData, hasSnapshot]);

  const hojeFormatado = useMemo(() => {
    if (viewMode !== 'diario' || !chartData || chartData.length === 0) return null;
    const hojeStr = new Date().toISOString().split('T')[0];
    const hojeItem = chartData.find(d => d.data === hojeStr);
    return hojeItem ? hojeItem.dataFormatada : null;
  }, [viewMode, chartData]);

  const totais = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { entradas: 0, saidas: 0, saldo: 0, saldoFinal: insightsPeriodo?.saldoAtual || 0 };
    }
    const entradas = chartData.reduce((acc, item) => acc + (item.entradas || 0), 0);
    const saidas = chartData.reduce((acc, item) => acc + (item.saidas || 0), 0);
    const saldoFinal = chartData[chartData.length - 1]?.saldoAcumulado || insightsPeriodo?.saldoAtual || 0;
    return { entradas, saidas, saldo: entradas - saidas, saldoFinal };
  }, [chartData, insightsPeriodo]);

  const exportFluxoCSV = () => {
    if (!chartData || chartData.length === 0) return;
    const isDaily = viewMode === 'diario';
    const header = isDaily
      ? 'Data,Entradas,Saídas,Saldo do Dia,Saldo Acumulado'
      : 'Mês,Entradas,Saídas,Saldo do Mês,Saldo Acumulado';
    const rows = chartData.map(d => {
      const saldo = (d.entradas || 0) - (d.saidas || 0);
      return `${d.dataFormatada},${(d.entradas || 0).toFixed(2)},${(d.saidas || 0).toFixed(2)},${saldo.toFixed(2)},${(d.saldoAcumulado || 0).toFixed(2)}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluxo-caixa-${isDaily ? 'diario' : 'mensal'}-${isDaily ? `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}` : selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFluxoXLSX = async () => {
    if (!chartData || chartData.length === 0) return;
    const XLSX = await import('xlsx');
    const isDaily = viewMode === 'diario';
    const headers = isDaily
      ? ['Data', 'Entradas', 'Saídas', 'Saldo do Dia', 'Saldo Acumulado']
      : ['Mês', 'Entradas', 'Saídas', 'Saldo do Mês', 'Saldo Acumulado'];
    const data = chartData.map(d => {
      const saldo = (d.entradas || 0) - (d.saidas || 0);
      return [d.dataFormatada, d.entradas || 0, d.saidas || 0, saldo, d.saldoAcumulado || 0];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isDaily ? 'Diário' : 'Mensal');
    XLSX.writeFile(wb, `fluxo-caixa-${isDaily ? 'diario' : 'mensal'}-${isDaily ? `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}` : selectedYear}.xlsx`);
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Toggle Diário/Mensal + Seletor de Período */}
        <div className="mb-6 flex items-center gap-4">
          <div className="inline-flex h-10 items-center rounded-md bg-muted p-1">
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === 'diario' && "bg-background text-foreground shadow-sm"
              )}
              onClick={() => setViewMode('diario')}
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              Diário
            </button>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === 'mensal' && "bg-background text-foreground shadow-sm"
              )}
              onClick={() => setViewMode('mensal')}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Mensal
            </button>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === 'semanal' && "bg-background text-foreground shadow-sm"
              )}
              onClick={() => setViewMode('semanal')}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Semanal
            </button>
          </div>

          {viewMode !== 'semanal' && (
            viewMode === 'diario' ? (
              <MonthYearPicker
                value={selectedMonth}
                onChange={setSelectedMonth}
              />
            ) : (
              <YearPicker
                value={selectedYear}
                onChange={setSelectedYear}
              />
            )
          )}
        </div>

        {viewMode === 'semanal' && <RelatorioSemanalFinanceiro />}

        {viewMode !== 'semanal' && <>
        {/* Hero Metrics */}
        <div className="flex flex-wrap items-start gap-8 sm:gap-12 mb-6" data-testid="hero-metrics">
          {isLoadingInsights ? (
            <>
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-36" />
              </div>
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-36" />
              </div>
            </>
          ) : (
            <>
              <HeroMetric
                label="Saldo Atual"
                value={formatCurrency(insightsPeriodo?.saldoAtual || 0)}
              />
              <HeroMetric
                label={viewMode === 'diario' ? 'Saldo Projetado (Fim do Mês)' : 'Saldo Projetado (Fim do Ano)'}
                value={formatCurrency(insightsPeriodo?.saldoFinalPeriodo || 0)}
                subtitle="Saldo atual + entradas previstas − saídas previstas para o período selecionado."
              />
            </>
          )}
        </div>

        {/* Supporting KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="supporting-kpis">
          {isLoadingInsights ? (
            <>
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </>
          ) : (
            <>
              <StatsCardV2
                title={viewMode === 'diario' ? 'Entradas do Mês' : 'Entradas do Ano'}
                value={formatCurrency(insightsPeriodo?.entradasPeriodo || 0)}
                variant="success"
              />
              <StatsCardV2
                title={viewMode === 'diario' ? 'Saídas do Mês' : 'Saídas do Ano'}
                value={formatCurrency(insightsPeriodo?.saidasPeriodo || 0)}
                variant="error"
              />
              {(insightsPeriodo?.entradasVencidas || 0) > 0 && (
                <StatsCardV2
                  title="Entradas Vencidas"
                  value={formatCurrency(insightsPeriodo?.entradasVencidas || 0)}
                  variant="warning"
                />
              )}
              {(insightsPeriodo?.saidasVencidas || 0) > 0 && (
                <StatsCardV2
                  title="Saídas Vencidas"
                  value={formatCurrency(insightsPeriodo?.saidasVencidas || 0)}
                  variant="error"
                />
              )}
            </>
          )}
        </div>

        {/* Observação sobre a natureza dos valores */}
        {!isLoadingInsights && (
          <div
            className="flex items-start gap-2 mb-6 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-3 py-2"
            data-testid="aviso-valores-previstos"
          >
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-gray-500 dark:text-zinc-400" />
            <p className="text-xs text-gray-600 dark:text-zinc-400">
              Os valores de entradas e saídas consideram o <strong>total previsto</strong> no período
              (recebido + a receber, pago + a pagar) — não apenas o efetivamente realizado.
            </p>
          </div>
        )}

        {/* Classificação de Clientes - Filtro do Gráfico */}
        <div className="grid grid-cols-3 gap-4 mb-6" data-testid="filtro-classificacao">
          {isLoadingClassificacao ? (
            <>
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </>
          ) : classificacaoData ? (
            <>
              <div
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  classificacaoFiltro.includes('em_dia')
                    ? 'bg-green-500/20 border-green-500 ring-2 ring-green-500/30'
                    : 'bg-green-500/10 border-green-500/20 hover:bg-green-500/15'
                }`}
                onClick={() => toggleClassificacao('em_dia')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-xs font-medium text-muted-foreground">Em dia</p>
                </div>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {classificacaoData.resumo.emDia} clientes
                </p>
              </div>

              <div
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  classificacaoFiltro.includes('receoso')
                    ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30'
                    : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15'
                }`}
                onClick={() => toggleClassificacao('receoso')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs font-medium text-muted-foreground">Receosos (1 parcela vencida)</p>
                </div>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {classificacaoData.resumo.receosos.count} clientes
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(classificacaoData.resumo.receosos.totalVencido)} vencido
                </p>
              </div>

              <div
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  classificacaoFiltro.includes('duvidoso')
                    ? 'bg-red-500/20 border-red-500 ring-2 ring-red-500/30'
                    : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15'
                }`}
                onClick={() => toggleClassificacao('duvidoso')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <UserX className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <p className="text-xs font-medium text-muted-foreground">Duvidosos (2+ parcelas vencidas)</p>
                </div>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  {classificacaoData.resumo.duvidosos.count} clientes
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(classificacaoData.resumo.duvidosos.totalVencido)} vencido
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Gráfico Principal */}
        <Card data-testid="card-fluxo-diario">
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">
                  {viewMode === 'diario' ? `Fluxo Diário - ${periodoLabel}` : `Fluxo Mensal - ${selectedYear}`}
                  {classificacaoFiltro.length > 0 && classificacaoFiltro.map(tipo => (
                    <Badge
                      key={tipo}
                      className={`ml-2 text-xs ${classificacaoConfig[tipo]?.color}`}
                      variant="outline"
                    >
                      {classificacaoConfig[tipo]?.label}
                      <X className="w-3 h-3 ml-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleClassificacao(tipo); }} />
                    </Badge>
                  ))}
                  {classificacaoFiltro.length > 1 && (
                    <span
                      className="ml-2 text-xs text-muted-foreground cursor-pointer hover:underline"
                      onClick={() => setClassificacaoFiltro([])}
                    >
                      Limpar filtros
                    </span>
                  )}
                </CardTitle>
                <CardDescription>Evolução do saldo no período selecionado</CardDescription>
                {viewMode === 'diario' && contasFinanceiras && contasFinanceiras.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <Select value={contaFinanceiraFiltro} onValueChange={setContaFinanceiraFiltro}>
                      <SelectTrigger className="w-[220px] h-8 text-xs">
                        <SelectValue placeholder="Todas as contas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as contas</SelectItem>
                        {contasFinanceiras.map(conta => (
                          <SelectItem key={conta} value={conta}>{conta}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {contaFinanceiraFiltro !== 'todas' && (
                      <Badge variant="outline" className="text-xs">
                        {contaFinanceiraFiltro}
                        <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setContaFinanceiraFiltro('todas')} />
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-center px-3 py-1.5">
                  <p className="text-xs text-muted-foreground">Entradas</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400" data-testid="text-total-entradas">
                    {formatCurrencyCompact(totais.entradas)}
                  </p>
                </div>
                <div className="text-center px-3 py-1.5">
                  <p className="text-xs text-muted-foreground">Saídas</p>
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400" data-testid="text-total-saidas">
                    {formatCurrencyCompact(totais.saidas)}
                  </p>
                </div>
                <div className="text-center px-3 py-1.5">
                  <p className="text-xs text-muted-foreground">Saldo Final</p>
                  <p className={cn("text-sm font-semibold", totais.saldoFinal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")} data-testid="text-total-saldo">
                    {formatCurrencyCompact(totais.saldoFinal)}
                  </p>
                </div>
                {viewMode !== 'semanal' && chartData && chartData.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1">
                        <Download className="w-3.5 h-3.5" />
                        <span className="text-xs">Exportar</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={exportFluxoCSV}>
                        Exportar CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportFluxoXLSX}>
                        Exportar Excel (.xlsx)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {isLoadingChart ? (
              <Skeleton className="h-[300px] rounded-lg" />
            ) : !chartData || chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados para o período selecionado.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 20, right: 80, left: 20, bottom: 50 }}
                    barGap={4}
                    barCategoryGap="20%"
                    onClick={(chartEvent) => {
                      if (chartEvent) {
                        let targetData: string | null = null;

                        if (chartEvent.activePayload && chartEvent.activePayload.length > 0) {
                          const payload = chartEvent.activePayload[0].payload as typeof chartData[0];
                          if (payload?.data) {
                            targetData = payload.data;
                          }
                        }

                        if (!targetData && typeof chartEvent.activeTooltipIndex === 'number' && chartData[chartEvent.activeTooltipIndex]) {
                          targetData = chartData[chartEvent.activeTooltipIndex].data;
                        }

                        if (targetData) {
                          if (viewMode === 'diario') {
                            setDiaSelecionado(targetData);
                          } else {
                            const [year, month] = targetData.split('-').map(Number);
                            setSelectedMonth({ month, year });
                            setViewMode('diario');
                          }
                        }
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={isDark ? "#27272a" : "#f0f0f0"}
                    />

                    <XAxis
                      dataKey="dataFormatada"
                      tick={{ fill: isDark ? '#a1a1aa' : '#6b7280', fontSize: viewMode === 'mensal' ? 12 : 10 }}
                      tickLine={false}
                      axisLine={false}
                      angle={viewMode === 'mensal' ? 0 : -45}
                      textAnchor={viewMode === 'mensal' ? 'middle' : 'end'}
                      height={viewMode === 'mensal' ? 35 : 55}
                      interval={viewMode === 'mensal' ? 0 : (chartData.length > 20 ? Math.floor(chartData.length / 10) : chartData.length > 10 ? 1 : 0)}
                      dy={viewMode === 'mensal' ? 5 : 12}
                    />

                    <YAxis
                      yAxisId="bars"
                      tick={{ fill: isDark ? '#a1a1aa' : '#6b7280', fontSize: 10 }}
                      tickFormatter={(value) => formatCurrencyCompact(value)}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                      domain={[0, chartDomains.barsMax]}
                    />

                    <YAxis
                      yAxisId="line"
                      orientation="right"
                      tick={{ fill: isDark ? '#a1a1aa' : '#6b7280', fontSize: 10 }}
                      tickFormatter={(value) => formatCurrencyCompact(value)}
                      tickLine={false}
                      axisLine={false}
                      width={75}
                      domain={[chartDomains.lineMin, chartDomains.lineMax]}
                    />

                    <Tooltip
                      cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0]?.payload as typeof chartData[0];
                        const saldo = (data?.entradas || 0) - (data?.saidas || 0);
                        return (
                          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 min-w-[200px]">
                            <p className="text-sm font-semibold text-foreground mb-2 pb-2 border-b border-gray-100 dark:border-zinc-800">{label}</p>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Entradas</span>
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(data?.entradas || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Saídas</span>
                                <span className="text-xs font-medium text-red-600 dark:text-red-400">{formatCurrency(data?.saidas || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center pt-1.5 border-t border-gray-100 dark:border-zinc-800">
                                <span className="text-xs font-medium text-foreground">{viewMode === 'diario' ? 'Saldo do Dia' : 'Saldo do Mês'}</span>
                                <span className={cn("text-xs font-semibold", saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                                  {formatCurrency(saldo)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">{hasSnapshot ? 'Saldo Real' : 'Saldo Acumulado'}</span>
                                <span className="text-xs font-medium text-foreground">{formatCurrency(data?.saldoAcumulado || 0)}</span>
                              </div>
                              {viewMode === 'diario' && hasSnapshot && (
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Saldo Esperado</span>
                                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{formatCurrency(data?.saldoEsperado || 0)}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 pt-1.5 border-t border-gray-100 dark:border-zinc-800 text-center">
                              {viewMode === 'diario' ? 'Clique para ver detalhes' : 'Clique para ver o mês'}
                            </p>
                          </div>
                        );
                      }}
                    />

                    <Bar
                      yAxisId="bars"
                      dataKey="entradas"
                      name="entradas"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={viewMode === 'mensal' ? 32 : 14}
                    />

                    <Bar
                      yAxisId="bars"
                      dataKey="saidas"
                      name="saidas"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={viewMode === 'mensal' ? 32 : 14}
                    />

                    <Line
                      yAxisId="line"
                      type="monotone"
                      dataKey="saldoAcumulado"
                      name={hasSnapshot ? "Saldo Real" : "Saldo Acumulado"}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5, fill: '#3b82f6', stroke: isDark ? '#18181b' : '#ffffff', strokeWidth: 2 }}
                    />

                    {viewMode === 'diario' && hasSnapshot && (
                      <Line
                        yAxisId="line"
                        type="monotone"
                        dataKey="saldoEsperado"
                        name="Saldo Esperado"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{ r: 4, fill: '#f59e0b', stroke: isDark ? '#18181b' : '#ffffff', strokeWidth: 2 }}
                      />
                    )}
                    {viewMode === 'diario' && hojeFormatado && (
                      <ReferenceLine
                        x={hojeFormatado}
                        yAxisId="bars"
                        stroke={isDark ? '#71717a' : '#94a3b8'}
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ value: 'Hoje', position: 'top', fill: isDark ? '#a1a1aa' : '#6b7280', fontSize: 11, fontWeight: 600 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contas Bancárias */}
        <Card className="mt-6" data-testid="card-contas-bancos">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-base">Contas Bancárias</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="toggle-inativas"
                  checked={showInactiveAccounts}
                  onCheckedChange={setShowInactiveAccounts}
                />
                <Label htmlFor="toggle-inativas" className="text-xs text-muted-foreground cursor-pointer">
                  Exibir inativas
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingContas ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : !contasBancos || contasBancos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta bancária encontrada</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {contasBancos
                  .filter((conta) => showInactiveAccounts || Math.abs(conta.saldo) >= 10)
                  .map((conta, index) => {
                    const isInactive = Math.abs(conta.saldo) < 10;
                    return (
                      <div
                        key={conta.id || index}
                        className={`p-3 rounded-lg transition-colors ${isInactive ? 'bg-muted/30 opacity-60' : 'bg-muted/50 hover:bg-muted/70'}`}
                        data-testid={`card-conta-${index}`}
                      >
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-medium text-muted-foreground truncate">{conta.nome}</p>
                          {isInactive && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">Inativa</Badge>
                          )}
                        </div>
                        <p className={cn("text-base font-bold", conta.saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {formatCurrency(conta.saldo)}
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
        </>}
      </div>

      {/* Dialog de Detalhamento do Dia */}
      <Dialog open={!!diaSelecionado} onOpenChange={(open) => !open && setDiaSelecionado(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" data-testid="dialog-dia-detalhe">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="text-lg">Movimentações do Dia</span>
                {diaSelecionado && (
                  <span className="block text-sm font-normal text-muted-foreground">
                    {formatDateFull(diaSelecionado)}
                  </span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingDiaDetalhe ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : diaDetalhe ? (
            <div className="flex flex-col gap-4 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              {/* Resumo do Dia */}
              <div className="grid grid-cols-3 gap-4 flex-shrink-0">
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <p className="text-xs text-muted-foreground">Total Entradas</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-dia-entradas">
                    {formatCurrency(diaDetalhe.totalEntradas)}
                  </p>
                  <p className="text-xs text-muted-foreground">{diaDetalhe.entradas.length} transações</p>
                </div>
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30">
                  <p className="text-xs text-muted-foreground">Total Saídas</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400" data-testid="text-dia-saidas">
                    {formatCurrency(diaDetalhe.totalSaidas)}
                  </p>
                  <p className="text-xs text-muted-foreground">{diaDetalhe.saidas.length} transações</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-zinc-800/30">
                  <p className="text-xs text-muted-foreground">Saldo do Dia</p>
                  <p className={cn("text-xl font-bold", diaDetalhe.saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")} data-testid="text-dia-saldo">
                    {formatCurrency(diaDetalhe.saldo)}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                  {/* Entradas */}
                  {diaDetalhe.entradas.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                        <ArrowUpCircle className="w-4 h-4" />
                        Entradas ({diaDetalhe.entradas.length})
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {diaDetalhe.entradas.map((entrada, idx) => (
                            <TableRow key={entrada.id || idx} data-testid={`row-entrada-${idx}`}>
                              <TableCell className="font-medium max-w-[200px]">
                                <TooltipProvider delayDuration={200}>
                                  <TooltipUI>
                                    <TooltipTrigger asChild>
                                      <span className="truncate block cursor-default">{entrada.fornecedor}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="max-w-[300px]">{entrada.descricao}</p>
                                    </TooltipContent>
                                  </TooltipUI>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {entrada.categoria}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={entrada.status === 'QUITADO' ? 'default' : 'outline'}
                                  className={entrada.status === 'QUITADO' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                >
                                  {entrada.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatCurrency(entrada.valor)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Saídas */}
                  {diaDetalhe.saidas.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                        <ArrowDownCircle className="w-4 h-4" />
                        Saídas ({diaDetalhe.saidas.length})
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {diaDetalhe.saidas.map((saida, idx) => (
                            <TableRow key={saida.id || idx} data-testid={`row-saida-${idx}`}>
                              <TableCell className="font-medium max-w-[200px]">
                                <TooltipProvider delayDuration={200}>
                                  <TooltipUI>
                                    <TooltipTrigger asChild>
                                      <span className="truncate block cursor-default">{saida.fornecedor}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="max-w-[300px]">{saida.descricao}</p>
                                    </TooltipContent>
                                  </TooltipUI>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {saida.categoria}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={saida.status === 'QUITADO' ? 'default' : 'outline'}
                                  className={saida.status === 'QUITADO' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                >
                                  {saida.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-red-600">
                                {formatCurrency(saida.valor)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {diaDetalhe.entradas.length === 0 && diaDetalhe.saidas.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma movimentação registrada para este dia
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Erro ao carregar detalhes do dia
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
