import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Users,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  PieChart as PieChartIcon,
  Printer,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart as RechartsPie,
  Pie,
  Legend,
} from "recharts";
import {
  format,
  startOfWeek,
  endOfWeek,
  subWeeks,
  addWeeks,
  getISOWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { FluxoCaixaDiarioCompleto } from "@shared/schema";

// -- Types --

interface InadimplenciaResumoData {
  totalInadimplente: number;
  quantidadeClientes: number;
  quantidadeParcelas: number;
  ticketMedio: number;
  valorUltimos45Dias: number;
  quantidadeUltimos45Dias: number;
  faixas: {
    ate30dias: { valor: number; quantidade: number; percentual: number };
    de31a60dias: { valor: number; quantidade: number; percentual: number };
    de61a90dias: { valor: number; quantidade: number; percentual: number };
    acima90dias: { valor: number; quantidade: number; percentual: number };
  };
  evolucaoMensal: { mes: string; mesLabel: string; valor: number; quantidade: number }[];
}

interface InadimplenciaCliente {
  idCliente: string;
  nomeCliente: string;
  valorTotal: number;
  quantidadeParcelas: number;
  parcelaMaisAntiga: string;
  diasAtrasoMax: number;
  empresa: string;
  cnpj: string | null;
  statusClickup: string | null;
  responsavel: string | null;
}

// -- Constants --

const FAIXA_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444"];
const FAIXA_LABELS = ["Até 30 dias", "31-60 dias", "61-90 dias", "Acima 90 dias"];

const DAY_LABELS: Record<number, string> = {
  1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 0: "Dom",
};

const formatCurrencyNoDecimals = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return format(d, "dd/MM", { locale: ptBR });
  } catch {
    return "-";
  }
};

// -- Subcomponents --

const VariationBadge = ({
  value,
  fmt = "number",
  invertColors = false,
}: {
  value: number;
  fmt?: "number" | "currency" | "percent";
  invertColors?: boolean;
}) => {
  const isPositive = value > 0;
  const isZero = value === 0;
  const Icon = isZero ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;
  // Default (churn-style): positive = bad (red), negative = good (green)
  // Inverted (financial): positive = good (green), negative = bad (red)
  const color = isZero
    ? "text-muted-foreground"
    : invertColors
    ? isPositive ? "text-emerald-500" : "text-red-500"
    : isPositive ? "text-red-500" : "text-emerald-500";

  let display = "";
  if (fmt === "currency")
    display = `${isPositive ? "+" : ""}${formatCurrencyNoDecimals(value)}`;
  else if (fmt === "percent")
    display = `${isPositive ? "+" : ""}${value.toFixed(2)}%`;
  else display = `${isPositive ? "+" : ""}${value}`;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {display}
    </span>
  );
};

const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  delta,
  deltaFmt,
  invertColors,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  gradient: string;
  delta?: number;
  deltaFmt?: "number" | "currency" | "percent";
  invertColors?: boolean;
}) => (
  <Card className="relative overflow-hidden border-border/50 hover:border-border transition-all hover:shadow-lg">
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
          {title}
        </span>
        <div className={`rounded-md ${gradient} p-1.5`}>
          <Icon className="text-white h-3 w-3" />
        </div>
      </div>
      <div className="font-bold text-foreground tracking-tight text-xl">
        {value}
      </div>
      <div className="flex items-center justify-between mt-1">
        {subtitle && (
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        )}
        {delta !== undefined && (
          <VariationBadge value={delta} fmt={deltaFmt || "number"} invertColors={invertColors} />
        )}
      </div>
    </CardContent>
  </Card>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[160px]">
      <p className="text-xs font-medium text-gray-600 dark:text-zinc-300 mb-2 uppercase tracking-wider">
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-500 dark:text-zinc-400">{entry.name}</span>
          <span className="font-bold text-gray-900 dark:text-white">
            {formatCurrencyNoDecimals(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// -- Main Component --

export default function RelatorioSemanalFinanceiro() {
  const [weekOffset, setWeekOffset] = useState(0);
  const { toast } = useToast();

  // Calculate week boundaries
  const { weekStart, weekEnd, weekStartDate, weekEndDate, prevWeekStart, prevWeekEnd } =
    useMemo(() => {
      const now = new Date();
      const target = weekOffset === 0 ? now : addWeeks(now, weekOffset);
      const start = startOfWeek(target, { weekStartsOn: 1 });
      const end = endOfWeek(target, { weekStartsOn: 1 });
      const prevStart = subWeeks(start, 1);
      const prevEnd = subWeeks(end, 1);
      return {
        weekStart: format(start, "yyyy-MM-dd"),
        weekEnd: format(end, "yyyy-MM-dd"),
        weekStartDate: start,
        weekEndDate: end,
        prevWeekStart: format(prevStart, "yyyy-MM-dd"),
        prevWeekEnd: format(prevEnd, "yyyy-MM-dd"),
      };
    }, [weekOffset]);

  const weekLabel = `${format(weekStartDate, "dd/MM", { locale: ptBR })} - ${format(weekEndDate, "dd/MM/yyyy", { locale: ptBR })}`;
  const weekNumber = getISOWeek(weekStartDate);

  // Fetch current week cash flow
  const { data: currentFluxoResponse, isLoading: isLoadingFluxo } = useQuery<{
    hasSnapshot: boolean;
    snapshotDate: string | null;
    dados: FluxoCaixaDiarioCompleto[];
  }>({
    queryKey: ["fluxo-semanal-current", weekStart, weekEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ dataInicio: weekStart, dataFim: weekEnd });
      const res = await fetch(`/api/fluxo-caixa/diario-completo?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch fluxo diario");
      return res.json();
    },
  });

  // Fetch previous week cash flow for comparison
  const { data: prevFluxoResponse } = useQuery<{
    hasSnapshot: boolean;
    snapshotDate: string | null;
    dados: FluxoCaixaDiarioCompleto[];
  }>({
    queryKey: ["fluxo-semanal-prev", prevWeekStart, prevWeekEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ dataInicio: prevWeekStart, dataFim: prevWeekEnd });
      const res = await fetch(`/api/fluxo-caixa/diario-completo?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch fluxo diario prev");
      return res.json();
    },
  });

  // Fetch inadimplência resumo current week
  const { data: inadimResumo } = useQuery<InadimplenciaResumoData>({
    queryKey: ["/api/inadimplencia/resumo", { dataInicio: weekStart, dataFim: weekEnd }],
  });

  // Fetch inadimplência resumo previous week
  const { data: prevInadimResumo } = useQuery<InadimplenciaResumoData>({
    queryKey: ["/api/inadimplencia/resumo", { dataInicio: prevWeekStart, dataFim: prevWeekEnd }],
  });

  // Fetch top inadimplentes
  const { data: inadimClientesData } = useQuery<{ clientes: InadimplenciaCliente[] }>({
    queryKey: ["/api/inadimplencia/clientes", { dataInicio: weekStart, dataFim: weekEnd, ordenarPor: "valor", limite: "10" }],
  });

  const fluxoDados = currentFluxoResponse?.dados ?? [];
  const prevFluxoDados = prevFluxoResponse?.dados ?? [];
  const inadimClientes = inadimClientesData?.clientes ?? [];

  // Compute weekly financial metrics
  const weekMetrics = useMemo(() => {
    if (fluxoDados.length === 0) return null;

    const totalEntradas = fluxoDados.reduce((sum, d) => sum + (d.entradasPagas || 0), 0);
    const totalSaidas = fluxoDados.reduce((sum, d) => sum + (d.saidasPagas || 0), 0);
    const resultado = totalEntradas - totalSaidas;

    // Daily breakdown for chart
    const dailyData = fluxoDados.map((d) => {
      const date = new Date(d.data + "T00:00:00");
      const dayOfWeek = date.getDay();
      const entPagas = d.entradasPagas || 0;
      const saiPagas = d.saidasPagas || 0;
      return {
        data: d.data,
        dayLabel: `${DAY_LABELS[dayOfWeek]} ${format(date, "dd/MM")}`,
        entradas: entPagas,
        saidas: saiPagas,
        saldoDia: entPagas - saiPagas,
        saldoAcumulado: d.saldoAcumulado || 0,
        entradasPrevistas: d.entradasPrevistas || 0,
        saidasPrevistas: d.saidasPrevistas || 0,
      };
    });

    return { totalEntradas, totalSaidas, resultado, dailyData };
  }, [fluxoDados]);

  // Compute comparison with previous week
  const comparison = useMemo(() => {
    if (!weekMetrics || prevFluxoDados.length === 0) return null;

    const prevEntradas = prevFluxoDados.reduce((sum, d) => sum + (d.entradasPagas || 0), 0);
    const prevSaidas = prevFluxoDados.reduce((sum, d) => sum + (d.saidasPagas || 0), 0);
    const prevResultado = prevEntradas - prevSaidas;

    return {
      entradasDelta: weekMetrics.totalEntradas - prevEntradas,
      saidasDelta: weekMetrics.totalSaidas - prevSaidas,
      resultadoDelta: weekMetrics.resultado - prevResultado,
    };
  }, [weekMetrics, prevFluxoDados]);

  // Inadimplência comparison
  const inadimComparison = useMemo(() => {
    if (!inadimResumo || !prevInadimResumo) return null;
    return {
      totalDelta: inadimResumo.totalInadimplente - prevInadimResumo.totalInadimplente,
      clientesDelta: inadimResumo.quantidadeClientes - prevInadimResumo.quantidadeClientes,
    };
  }, [inadimResumo, prevInadimResumo]);

  // Inadimplência faixas for PieChart
  const faixasData = useMemo(() => {
    if (!inadimResumo?.faixas) return [];
    const f = inadimResumo.faixas;
    return [
      { name: FAIXA_LABELS[0], value: f.ate30dias.valor, quantidade: f.ate30dias.quantidade, percentual: f.ate30dias.percentual },
      { name: FAIXA_LABELS[1], value: f.de31a60dias.valor, quantidade: f.de31a60dias.quantidade, percentual: f.de31a60dias.percentual },
      { name: FAIXA_LABELS[2], value: f.de61a90dias.valor, quantidade: f.de61a90dias.quantidade, percentual: f.de61a90dias.percentual },
      { name: FAIXA_LABELS[3], value: f.acima90dias.valor, quantidade: f.acima90dias.quantidade, percentual: f.acima90dias.percentual },
    ].filter((f) => f.value > 0);
  }, [inadimResumo]);

  // Ref for PDF export
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [showPdfContent, setShowPdfContent] = useState(false);

  const exportToPdf = useCallback(async () => {
    setIsExportingPdf(true);
    setShowPdfContent(true);
  }, []);

  useEffect(() => {
    if (!showPdfContent || !pdfContainerRef.current) return;

    const generatePdf = async () => {
      try {
        const element = pdfContainerRef.current;
        if (!element) return;

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 8;
        const usableWidth = pageWidth - margin * 2;
        const imgRatio = canvas.height / canvas.width;
        const imgHeight = usableWidth * imgRatio;

        if (imgHeight <= pageHeight - margin * 2) {
          pdf.addImage(imgData, "PNG", margin, margin, usableWidth, imgHeight);
        } else {
          const totalPages = Math.ceil(imgHeight / (pageHeight - margin * 2));
          for (let i = 0; i < totalPages; i++) {
            if (i > 0) pdf.addPage();
            const yOffset = margin - i * (pageHeight - margin * 2);
            pdf.addImage(imgData, "PNG", margin, yOffset, usableWidth, imgHeight);
          }
        }

        const fileName = `relatorio-financeiro-semana-${weekNumber}-${weekStart}.pdf`;
        pdf.save(fileName);
        toast({ title: "PDF exportado!", description: `Arquivo: ${fileName}` });
      } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        toast({ title: "Erro", description: "Não foi possível gerar o PDF.", variant: "destructive" });
      } finally {
        setShowPdfContent(false);
        setIsExportingPdf(false);
      }
    };

    const timer = setTimeout(generatePdf, 100);
    return () => clearTimeout(timer);
  }, [showPdfContent, weekNumber, weekStart, toast]);

  // Export: Copy formatted text to clipboard
  const copyReportToClipboard = useCallback(() => {
    if (!weekMetrics) return;

    let report = `RELATÓRIO SEMANAL FINANCEIRO\n`;
    report += `Período: ${weekLabel} (Semana ${weekNumber})\n`;
    report += `${"=".repeat(50)}\n\n`;

    report += `RESUMO EXECUTIVO\n`;
    report += `Total Entradas: ${formatCurrencyNoDecimals(weekMetrics.totalEntradas)}`;
    if (comparison) report += ` (${comparison.entradasDelta > 0 ? "+" : ""}${formatCurrencyNoDecimals(comparison.entradasDelta)} vs anterior)`;
    report += `\n`;
    report += `Total Saídas: ${formatCurrencyNoDecimals(weekMetrics.totalSaidas)}`;
    if (comparison) report += ` (${comparison.saidasDelta > 0 ? "+" : ""}${formatCurrencyNoDecimals(comparison.saidasDelta)} vs anterior)`;
    report += `\n`;
    report += `Resultado: ${formatCurrencyNoDecimals(weekMetrics.resultado)}`;
    if (comparison) report += ` (${comparison.resultadoDelta > 0 ? "+" : ""}${formatCurrencyNoDecimals(comparison.resultadoDelta)} vs anterior)`;
    report += `\n`;

    if (inadimResumo) {
      report += `Inadimplência Total: ${formatCurrencyNoDecimals(inadimResumo.totalInadimplente)} (${inadimResumo.quantidadeClientes} clientes)\n`;
    }

    report += `\n${"─".repeat(50)}\n`;
    report += `FLUXO DIÁRIO\n\n`;
    report += `${"Data".padEnd(16)}${"Entradas".padStart(15)}${"Saídas".padStart(15)}${"Saldo".padStart(15)}\n`;
    weekMetrics.dailyData.forEach((d) => {
      report += `${d.dayLabel.padEnd(16)}${formatCurrencyNoDecimals(d.entradas).padStart(15)}${formatCurrencyNoDecimals(d.saidas).padStart(15)}${formatCurrencyNoDecimals(d.saldoDia).padStart(15)}\n`;
    });

    if (inadimClientes.length > 0) {
      report += `\n${"─".repeat(50)}\n`;
      report += `TOP INADIMPLENTES\n\n`;
      inadimClientes.forEach((c, i) => {
        report += `${i + 1}. ${c.nomeCliente} - ${formatCurrencyNoDecimals(c.valorTotal)} (${c.diasAtrasoMax} dias)\n`;
      });
    }

    navigator.clipboard.writeText(report);
    toast({ title: "Copiado!", description: "Relatório copiado para a área de transferência." });
  }, [weekMetrics, comparison, inadimResumo, inadimClientes, weekLabel, weekNumber, toast]);

  // Export: CSV
  const exportToCsv = useCallback(() => {
    if (!weekMetrics) return;

    const headers = ["Data", "Dia", "Entradas Pagas", "Saídas Pagas", "Saldo Dia", "Saldo Acumulado"];
    const rows = weekMetrics.dailyData.map((d) =>
      [d.data, d.dayLabel, d.entradas.toFixed(2), d.saidas.toFixed(2), d.saldoDia.toFixed(2), d.saldoAcumulado.toFixed(2)]
    );

    if (inadimClientes.length > 0) {
      rows.push([]);
      rows.push(["", "", "", "", "", ""]);
      rows.push(["INADIMPLENTES", "CNPJ", "Valor Total", "Parcelas", "Dias Atraso", "Responsável"]);
      inadimClientes.forEach((c) => {
        rows.push([c.nomeCliente, c.cnpj || "", c.valorTotal.toFixed(2), String(c.quantidadeParcelas), String(c.diasAtrasoMax), c.responsavel || ""]);
      });
    }

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-financeiro-semana-${weekNumber}-${weekStart}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: "CSV exportado!", description: "Arquivo baixado com sucesso." });
  }, [weekMetrics, inadimClientes, weekStart, weekNumber, toast]);

  // -- Loading state --
  if (isLoadingFluxo) {
    return (
      <div className="space-y-6">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // -- Empty state --
  if (!weekMetrics) {
    return (
      <div className="space-y-6">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <div className="font-bold text-lg text-foreground">{weekLabel}</div>
                  <div className="text-xs text-muted-foreground">Semana {weekNumber}</div>
                </div>
                <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o + 1)} disabled={weekOffset >= 0}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {weekOffset !== 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">
                    Semana Atual
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Sem dados financeiros nesta semana</h3>
            <p className="text-sm text-muted-foreground">Tente navegar para outra semana ou verifique o período selecionado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -- Main Render --
  return (
    <div className="space-y-6" ref={reportRef}>
      {/* ── Week Selector + Export Buttons ── */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <div className="font-bold text-lg text-foreground">{weekLabel}</div>
                <div className="text-xs text-muted-foreground">Semana {weekNumber}</div>
              </div>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o + 1)} disabled={weekOffset >= 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">
                  Semana Atual
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyReportToClipboard} className="gap-2">
                <Copy className="h-4 w-4" />
                Copiar Relatório
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCsv} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPdf} className="gap-2" disabled={isExportingPdf}>
                <Printer className="h-4 w-4" />
                {isExportingPdf ? "Gerando..." : "Exportar PDF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Entradas"
          value={formatCurrencyNoDecimals(weekMetrics.totalEntradas)}
          subtitle="receitas recebidas"
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-emerald-500 to-green-600"
          delta={comparison?.entradasDelta}
          deltaFmt="currency"
          invertColors={true}
        />
        <KpiCard
          title="Total Saídas"
          value={formatCurrencyNoDecimals(weekMetrics.totalSaidas)}
          subtitle="despesas pagas"
          icon={TrendingDown}
          gradient="bg-gradient-to-br from-red-500 to-rose-600"
          delta={comparison?.saidasDelta}
          deltaFmt="currency"
          invertColors={false}
        />
        <KpiCard
          title="Resultado da Semana"
          value={formatCurrencyNoDecimals(weekMetrics.resultado)}
          subtitle="entradas - saídas"
          icon={DollarSign}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          delta={comparison?.resultadoDelta}
          deltaFmt="currency"
          invertColors={true}
        />
        <KpiCard
          title="Inadimplência Total"
          value={inadimResumo ? formatCurrencyNoDecimals(inadimResumo.totalInadimplente) : "—"}
          subtitle={inadimResumo ? `${inadimResumo.quantidadeParcelas} parcelas vencidas` : "carregando..."}
          icon={AlertTriangle}
          gradient="bg-gradient-to-br from-orange-500 to-amber-600"
          delta={inadimComparison?.totalDelta}
          deltaFmt="currency"
          invertColors={false}
        />
        <KpiCard
          title="Clientes Inadimplentes"
          value={inadimResumo ? String(inadimResumo.quantidadeClientes) : "—"}
          subtitle={inadimResumo ? `ticket médio: ${formatCurrencyNoDecimals(inadimResumo.ticketMedio)}` : "carregando..."}
          icon={Users}
          gradient="bg-gradient-to-br from-purple-500 to-violet-600"
          delta={inadimComparison?.clientesDelta}
          deltaFmt="number"
          invertColors={false}
        />
      </div>

      {/* ── Charts: Fluxo Diário + Inadimplência por Faixa ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fluxo Diário BarChart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Fluxo Diário da Semana</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekMetrics.dailyData} barGap={4}>
                  <XAxis
                    dataKey="dayLabel"
                    tick={{ fill: "currentColor", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "currentColor", fontSize: 10 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Inadimplência por Faixa PieChart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Inadimplência por Faixa de Atraso</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {faixasData.length > 0 ? (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={faixasData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {faixasData.map((_, index) => (
                          <Cell key={index} fill={FAIXA_COLORS[index % FAIXA_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrencyNoDecimals(value)}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "11px" }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Faixa</TableHead>
                      <TableHead className="text-xs text-center">Qtd</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faixasData.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: FAIXA_COLORS[i] }} />
                            {f.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-center py-1">{f.quantidade}</TableCell>
                        <TableCell className="text-xs text-right py-1 font-semibold text-red-500">{formatCurrencyNoDecimals(f.value)}</TableCell>
                        <TableCell className="text-xs text-right py-1">{f.percentual.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados de inadimplência para esta semana
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Maiores Inadimplentes ── */}
      {inadimClientes.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Maiores Inadimplentes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-8">#</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">CNPJ</TableHead>
                    <TableHead className="text-xs text-right">Valor Total</TableHead>
                    <TableHead className="text-xs text-center">Parcelas</TableHead>
                    <TableHead className="text-xs text-center">Dias Atraso</TableHead>
                    <TableHead className="text-xs">Responsável</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inadimClientes.map((c, i) => (
                    <TableRow key={c.idCliente}>
                      <TableCell className="text-xs py-2 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs py-2 font-medium">{c.nomeCliente}</TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground">{c.cnpj || "—"}</TableCell>
                      <TableCell className="text-xs py-2 text-right font-semibold text-red-500">
                        {formatCurrencyNoDecimals(c.valorTotal)}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-center">{c.quantidadeParcelas}</TableCell>
                      <TableCell className="text-xs py-2 text-center">
                        <Badge
                          variant={c.diasAtrasoMax > 90 ? "destructive" : c.diasAtrasoMax > 30 ? "secondary" : "outline"}
                          className="text-[10px]"
                        >
                          {c.diasAtrasoMax}d
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground">{c.responsavel || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Detalhamento Diário ── */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Detalhamento Diário</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Dia</TableHead>
                  <TableHead className="text-xs text-right">Entradas Pagas</TableHead>
                  <TableHead className="text-xs text-right">Saídas Pagas</TableHead>
                  <TableHead className="text-xs text-right">Saldo Dia</TableHead>
                  <TableHead className="text-xs text-right">Saldo Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekMetrics.dailyData.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs py-2 font-medium">{d.dayLabel}</TableCell>
                    <TableCell className="text-xs py-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatCurrencyNoDecimals(d.entradas)}
                    </TableCell>
                    <TableCell className="text-xs py-2 text-right text-red-500 font-semibold">
                      {formatCurrencyNoDecimals(d.saidas)}
                    </TableCell>
                    <TableCell className={`text-xs py-2 text-right font-semibold ${d.saldoDia >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {formatCurrencyNoDecimals(d.saldoDia)}
                    </TableCell>
                    <TableCell className={`text-xs py-2 text-right font-semibold ${d.saldoAcumulado >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {formatCurrencyNoDecimals(d.saldoAcumulado)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="border-t-2 border-border font-bold">
                  <TableCell className="text-xs py-2">TOTAL</TableCell>
                  <TableCell className="text-xs py-2 text-right text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyNoDecimals(weekMetrics.totalEntradas)}
                  </TableCell>
                  <TableCell className="text-xs py-2 text-right text-red-500">
                    {formatCurrencyNoDecimals(weekMetrics.totalSaidas)}
                  </TableCell>
                  <TableCell className={`text-xs py-2 text-right ${weekMetrics.resultado >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    {formatCurrencyNoDecimals(weekMetrics.resultado)}
                  </TableCell>
                  <TableCell className="text-xs py-2 text-right">—</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Hidden PDF render container ── */}
      {showPdfContent && weekMetrics && (
        <div
          ref={pdfContainerRef}
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            width: "1400px",
            background: "#fff",
            color: "#111",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: "12px",
            padding: "32px",
            zIndex: -1,
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "3px solid #3b82f6", paddingBottom: "12px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>Relatório Semanal Financeiro</h1>
            <div style={{ color: "#666", fontSize: "14px" }}>{weekLabel} (Semana {weekNumber})</div>
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: "4px" }}>Total Entradas</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#10b981" }}>{formatCurrencyNoDecimals(weekMetrics.totalEntradas)}</div>
              {comparison && <div style={{ fontSize: "10px", color: comparison.entradasDelta >= 0 ? "#10b981" : "#ef4444", marginTop: "2px" }}>{comparison.entradasDelta > 0 ? "+" : ""}{formatCurrencyNoDecimals(comparison.entradasDelta)} vs anterior</div>}
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: "4px" }}>Total Saídas</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#ef4444" }}>{formatCurrencyNoDecimals(weekMetrics.totalSaidas)}</div>
              {comparison && <div style={{ fontSize: "10px", color: comparison.saidasDelta > 0 ? "#ef4444" : "#10b981", marginTop: "2px" }}>{comparison.saidasDelta > 0 ? "+" : ""}{formatCurrencyNoDecimals(comparison.saidasDelta)} vs anterior</div>}
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: "4px" }}>Resultado</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: weekMetrics.resultado >= 0 ? "#10b981" : "#ef4444" }}>{formatCurrencyNoDecimals(weekMetrics.resultado)}</div>
              {comparison && <div style={{ fontSize: "10px", color: comparison.resultadoDelta >= 0 ? "#10b981" : "#ef4444", marginTop: "2px" }}>{comparison.resultadoDelta > 0 ? "+" : ""}{formatCurrencyNoDecimals(comparison.resultadoDelta)} vs anterior</div>}
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: "4px" }}>Inadimplência</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#f97316" }}>{inadimResumo ? formatCurrencyNoDecimals(inadimResumo.totalInadimplente) : "—"}</div>
              {inadimResumo && <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>{inadimResumo.quantidadeParcelas} parcelas · {inadimResumo.quantidadeClientes} clientes</div>}
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: "4px" }}>Clientes Inadimplentes</div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>{inadimResumo?.quantidadeClientes ?? "—"}</div>
            </div>
          </div>

          {/* Fluxo Diário Table */}
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px" }}>Fluxo Diário</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "20px" }}>
            <thead>
              <tr>
                <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Dia</th>
                <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Entradas</th>
                <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Saídas</th>
                <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Saldo Dia</th>
                <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {weekMetrics.dailyData.map((d, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? "#f9fafb" : "transparent" }}>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{d.dayLabel}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#10b981", fontWeight: 600 }}>{formatCurrencyNoDecimals(d.entradas)}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#ef4444", fontWeight: 600 }}>{formatCurrencyNoDecimals(d.saidas)}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: d.saldoDia >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>{formatCurrencyNoDecimals(d.saldoDia)}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontWeight: 600 }}>{formatCurrencyNoDecimals(d.saldoAcumulado)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #d1d5db", fontWeight: 700 }}>
                <td style={{ padding: "6px 8px" }}>TOTAL</td>
                <td style={{ padding: "6px 8px", textAlign: "right", color: "#10b981" }}>{formatCurrencyNoDecimals(weekMetrics.totalEntradas)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", color: "#ef4444" }}>{formatCurrencyNoDecimals(weekMetrics.totalSaidas)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", color: weekMetrics.resultado >= 0 ? "#10b981" : "#ef4444" }}>{formatCurrencyNoDecimals(weekMetrics.resultado)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>—</td>
              </tr>
            </tbody>
          </table>

          {/* Inadimplência por Faixa */}
          {faixasData.length > 0 && (
            <>
              <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px" }}>Inadimplência por Faixa</h2>
              <table style={{ width: "50%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "20px" }}>
                <thead>
                  <tr>
                    <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Faixa</th>
                    <th style={{ background: "#f3f4f6", textAlign: "center", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Qtd</th>
                    <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Valor</th>
                    <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {faixasData.map((f, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? "#f9fafb" : "transparent" }}>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{f.name}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>{f.quantidade}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#ef4444", fontWeight: 600 }}>{formatCurrencyNoDecimals(f.value)}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{f.percentual.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Maiores Inadimplentes */}
          {inadimClientes.length > 0 && (
            <>
              <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px" }}>Maiores Inadimplentes</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr>
                    <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>#</th>
                    <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Cliente</th>
                    <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>CNPJ</th>
                    <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Valor Total</th>
                    <th style={{ background: "#f3f4f6", textAlign: "center", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Parcelas</th>
                    <th style={{ background: "#f3f4f6", textAlign: "center", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Dias Atraso</th>
                    <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {inadimClientes.map((c, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? "#f9fafb" : "transparent" }}>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{i + 1}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{c.nomeCliente}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", fontSize: "10px" }}>{c.cnpj || "—"}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#ef4444", fontWeight: 600 }}>{formatCurrencyNoDecimals(c.valorTotal)}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>{c.quantidadeParcelas}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>{c.diasAtrasoMax}d</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{c.responsavel || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
