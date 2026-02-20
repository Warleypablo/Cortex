import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  TrendingDown,
  DollarSign,
  Users,
  Percent,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  PieChart as PieChartIcon,
  Pause,
  FileText,
  Printer,
  CalendarDays,
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
  parseISO,
  getISOWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// -- Types --

interface ChurnContract {
  id: string;
  cliente_nome: string;
  cnpj: string;
  produto: string;
  squad: string;
  responsavel: string;
  cs_responsavel: string;
  vendedor: string;
  valorr: number;
  data_inicio: string;
  data_encerramento: string | null;
  data_pausa: string | null;
  status: string;
  servico: string;
  motivo_cancelamento?: string;
  tipo: "churn" | "pausado";
  lifetime_meses: number;
  ltv: number;
}

interface ChurnPorSquad {
  squad: string;
  mrr_ativo: number;
  mrr_perdido: number;
  percentual: number;
}

interface ChurnPorMotivo {
  motivo: string;
  mrr_perdido: number;
  quantidade: number;
  percentual: number;
}

interface ChurnDetalhamentoData {
  contratos: ChurnContract[];
  metricas: {
    total_churned: number;
    total_pausados: number;
    mrr_perdido: number;
    mrr_pausado: number;
    ltv_total: number;
    lt_medio: number;
    mrr_ativo_ref?: number;
    churn_percentual?: number;
    churn_por_squad?: ChurnPorSquad[];
    churn_por_motivo?: ChurnPorMotivo[];
    periodo_referencia?: string;
  };
  filtros: {
    squads: string[];
    produtos: string[];
    responsaveis: string[];
    servicos: string[];
  };
}

// -- Constants --

const MOTIVO_LABELS: Record<string, string> = {
  resultado_fraco: "Resultado Fraco",
  falta_verba: "Falta de Verba",
  in_house: "In-House",
  concorrente: "Concorrente",
  qualidade_entrega: "Qualidade da Entrega",
  comunicacao: "Comunicação",
  timing: "Timing",
  inadimplencia: "Inadimplência",
  outros: "Outros",
  "Não especificado": "Não especificado",
};

const COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];

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
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
};

// -- Subcomponents --

const VariationBadge = ({
  value,
  fmt = "number",
}: {
  value: number;
  fmt?: "number" | "currency" | "percent";
}) => {
  const isPositive = value > 0;
  const isZero = value === 0;
  const Icon = isZero ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;
  // For churn: positive = worse (red), negative = better (green)
  const color = isZero
    ? "text-muted-foreground"
    : isPositive
    ? "text-red-500"
    : "text-emerald-500";

  let display = "";
  if (fmt === "currency")
    display = `${isPositive ? "+" : ""}${formatCurrencyNoDecimals(value)}`;
  else if (fmt === "percent")
    display = `${isPositive ? "+" : ""}${value.toFixed(2)}pp`;
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
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  gradient: string;
  delta?: number;
  deltaFmt?: "number" | "currency" | "percent";
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
          <VariationBadge value={delta} fmt={deltaFmt || "number"} />
        )}
      </div>
    </CardContent>
  </Card>
);

const CustomTooltip = ({ active, payload, label, valueFormatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[160px]">
      <p className="text-xs font-medium text-gray-600 dark:text-zinc-300 mb-2 uppercase tracking-wider">
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-500 dark:text-zinc-400">
            {entry.name === "mrr" ? "MRR Perdido" : entry.name === "count" ? "Quantidade" : entry.name}
          </span>
          <span className="font-bold text-gray-900 dark:text-white">
            {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// -- Main Component --

export default function RelatorioSemanalChurn() {
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

  // Fetch current week data
  const { data: currentData, isLoading: isLoadingCurrent } =
    useQuery<ChurnDetalhamentoData>({
      queryKey: ["/api/analytics/churn-detalhamento", { startDate: weekStart, endDate: weekEnd }],
    });

  // Fetch previous week data for comparison
  const { data: prevData } = useQuery<ChurnDetalhamentoData>({
    queryKey: ["/api/analytics/churn-detalhamento", { startDate: prevWeekStart, endDate: prevWeekEnd }],
  });

  // Fetch full month data for consolidated monthly percentage
  const { monthStart, monthEnd, monthLabel } = useMemo(() => {
    const mStart = startOfMonth(weekStartDate);
    const mEnd = endOfMonth(weekStartDate);
    return {
      monthStart: format(mStart, "yyyy-MM-dd"),
      monthEnd: format(mEnd, "yyyy-MM-dd"),
      monthLabel: format(weekStartDate, "MMMM/yyyy", { locale: ptBR }),
    };
  }, [weekStartDate]);

  const { data: monthData } = useQuery<ChurnDetalhamentoData>({
    queryKey: ["/api/analytics/churn-detalhamento", { startDate: monthStart, endDate: monthEnd }],
  });

  // Compute metrics for current week
  const weekMetrics = useMemo(() => {
    if (!currentData?.contratos) return null;

    const churnContratos = currentData.contratos.filter((c) => c.tipo === "churn");
    const pausados = currentData.contratos.filter((c) => c.tipo === "pausado");
    const totalChurns = churnContratos.length;
    const mrrPerdido = churnContratos.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const mrrBase = currentData.metricas?.mrr_ativo_ref || 0;
    const churnRate = mrrBase > 0 ? (mrrPerdido / mrrBase) * 100 : 0;

    // Churn por Squad
    const porSquad: Record<string, { count: number; mrr: number }> = {};
    churnContratos.forEach((c) => {
      const s = c.squad || "Não especificado";
      if (!porSquad[s]) porSquad[s] = { count: 0, mrr: 0 };
      porSquad[s].count++;
      porSquad[s].mrr += c.valorr || 0;
    });
    const squadData = Object.entries(porSquad)
      .map(([squad, info]) => ({
        squad,
        ...info,
        percentual: mrrPerdido > 0 ? (info.mrr / mrrPerdido) * 100 : 0,
      }))
      .sort((a, b) => b.mrr - a.mrr);

    // Churn por Motivo
    const porMotivo: Record<string, { count: number; mrr: number }> = {};
    churnContratos.forEach((c) => {
      const m = c.motivo_cancelamento || "Não especificado";
      if (!porMotivo[m]) porMotivo[m] = { count: 0, mrr: 0 };
      porMotivo[m].count++;
      porMotivo[m].mrr += c.valorr || 0;
    });
    const motivoData = Object.entries(porMotivo)
      .map(([motivo, info]) => ({
        motivo,
        label: MOTIVO_LABELS[motivo] || motivo,
        ...info,
        percentual: mrrPerdido > 0 ? (info.mrr / mrrPerdido) * 100 : 0,
      }))
      .sort((a, b) => b.mrr - a.mrr);

    // Churn por Responsável
    const porResp: Record<string, { count: number; mrr: number }> = {};
    churnContratos.forEach((c) => {
      const r = c.cs_responsavel || c.responsavel || "Não especificado";
      if (!porResp[r]) porResp[r] = { count: 0, mrr: 0 };
      porResp[r].count++;
      porResp[r].mrr += c.valorr || 0;
    });
    const respData = Object.entries(porResp)
      .map(([responsavel, info]) => ({ responsavel, ...info }))
      .sort((a, b) => b.mrr - a.mrr);

    return {
      totalChurns,
      totalPausados: pausados.length,
      mrrPerdido,
      churnRate,
      squadData,
      motivoData,
      respData,
      contratos: churnContratos,
    };
  }, [currentData]);

  // Compute comparison with previous week
  const comparison = useMemo(() => {
    if (!weekMetrics || !prevData?.contratos) return null;

    const prevChurn = prevData.contratos.filter((c) => c.tipo === "churn");
    const prevCount = prevChurn.length;
    const prevMrr = prevChurn.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const prevMrrBase = prevData.metricas?.mrr_ativo_ref || 0;
    const prevRate = prevMrrBase > 0 ? (prevMrr / prevMrrBase) * 100 : 0;

    return {
      countDelta: weekMetrics.totalChurns - prevCount,
      mrrDelta: weekMetrics.mrrPerdido - prevMrr,
      rateDelta: weekMetrics.churnRate - prevRate,
    };
  }, [weekMetrics, prevData]);

  // Consolidated monthly metrics
  const monthMetrics = useMemo(() => {
    if (!monthData?.contratos) return null;
    const churnContratos = monthData.contratos.filter((c) => c.tipo === "churn");
    const totalChurns = churnContratos.length;
    const mrrPerdido = churnContratos.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const mrrBase = monthData.metricas?.mrr_ativo_ref || 0;
    const churnRate = mrrBase > 0 ? (mrrPerdido / mrrBase) * 100 : 0;
    return { totalChurns, mrrPerdido, churnRate, mrrBase };
  }, [monthData]);

  // Ref for PDF export
  const reportRef = useRef<HTMLDivElement>(null);

  // Export: PDF via html2canvas + jsPDF (download direto)
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [showPdfContent, setShowPdfContent] = useState(false);

  const exportToPdf = useCallback(async () => {
    setIsExportingPdf(true);
    setShowPdfContent(true);
  }, []);

  // Effect that runs after PDF content is rendered in the DOM
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

        // Multi-page support
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

        const fileName = `relatorio-churn-semana-${weekNumber}-${weekStart}.pdf`;
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

    // Small delay to ensure DOM is fully painted
    const timer = setTimeout(generatePdf, 100);
    return () => clearTimeout(timer);
  }, [showPdfContent, weekNumber, weekStart, weekLabel, monthLabel, weekMetrics, comparison, monthMetrics, toast]);

  // Export: Copy formatted text to clipboard
  const copyReportToClipboard = useCallback(() => {
    if (!weekMetrics) return;

    let report = `RELATÓRIO SEMANAL DE CHURN\n`;
    report += `Período: ${weekLabel} (Semana ${weekNumber})\n`;
    report += `${"=".repeat(50)}\n\n`;

    report += `RESUMO EXECUTIVO\n`;
    report += `- Total de Churns: ${weekMetrics.totalChurns}\n`;
    report += `- MRR Perdido: ${formatCurrencyNoDecimals(weekMetrics.mrrPerdido)}\n`;
    report += `- Taxa de Churn Semanal: ${weekMetrics.churnRate.toFixed(2)}%\n`;
    report += `- Pausados: ${weekMetrics.totalPausados}\n`;
    if (monthMetrics) {
      report += `\nCONSOLIDADO DO MÊS (${monthLabel})\n`;
      report += `- Churn Rate Mensal: ${monthMetrics.churnRate.toFixed(2)}%\n`;
      report += `- Total Churns no Mês: ${monthMetrics.totalChurns}\n`;
      report += `- MRR Perdido no Mês: ${formatCurrencyNoDecimals(monthMetrics.mrrPerdido)}\n`;
    }
    report += `\n`;

    if (comparison) {
      report += `COMPARATIVO COM SEMANA ANTERIOR\n`;
      report += `- Variação Churns: ${comparison.countDelta > 0 ? "+" : ""}${comparison.countDelta}\n`;
      report += `- Variação MRR: ${comparison.mrrDelta > 0 ? "+" : ""}${formatCurrencyNoDecimals(comparison.mrrDelta)}\n\n`;
    }

    report += `CHURN POR SQUAD\n`;
    weekMetrics.squadData.forEach((s) => {
      report += `- ${s.squad}: ${s.count} contratos, ${formatCurrencyNoDecimals(s.mrr)} (${s.percentual.toFixed(1)}%)\n`;
    });
    report += `\n`;

    report += `CHURN POR MOTIVO\n`;
    weekMetrics.motivoData.forEach((m) => {
      report += `- ${m.label}: ${m.count} contratos, ${formatCurrencyNoDecimals(m.mrr)} (${m.percentual.toFixed(1)}%)\n`;
    });
    report += `\n`;

    report += `CHURN POR RESPONSÁVEL\n`;
    weekMetrics.respData.forEach((r) => {
      report += `- ${r.responsavel}: ${r.count} contratos, ${formatCurrencyNoDecimals(r.mrr)}\n`;
    });
    report += `\n`;

    report += `DETALHAMENTO DOS CONTRATOS\n`;
    weekMetrics.contratos.forEach((c) => {
      report += `- ${c.cliente_nome} | ${c.cnpj} | ${c.produto} | ${c.squad} | ${formatCurrencyNoDecimals(c.valorr)} | ${MOTIVO_LABELS[c.motivo_cancelamento || ""] || c.motivo_cancelamento || "N/A"}\n`;
    });

    navigator.clipboard.writeText(report);
    toast({
      title: "Relatório copiado!",
      description: "O relatório semanal foi copiado para a área de transferência.",
    });
  }, [weekMetrics, comparison, monthMetrics, monthLabel, weekLabel, weekNumber, toast]);

  // Export: CSV download
  const exportToCsv = useCallback(() => {
    if (!weekMetrics?.contratos.length) return;

    const headers = [
      "Cliente", "CNPJ", "Produto", "Squad", "Responsável", "CS Responsável",
      "MRR", "Motivo", "Data Encerramento", "Lifetime (meses)", "LTV",
    ];
    const rows = weekMetrics.contratos.map((c) => [
      c.cliente_nome,
      c.cnpj,
      c.produto,
      c.squad,
      c.responsavel,
      c.cs_responsavel,
      c.valorr,
      MOTIVO_LABELS[c.motivo_cancelamento || ""] || c.motivo_cancelamento || "",
      c.data_encerramento || "",
      c.lifetime_meses.toFixed(1),
      c.ltv.toFixed(2),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-churn-semana-${weekNumber}-${weekStart}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV exportado!",
      description: "O arquivo CSV foi baixado com sucesso.",
    });
  }, [weekMetrics, weekStart, weekNumber, toast]);

  // Loading state
  if (isLoadingCurrent) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Empty state
  if (!weekMetrics || weekMetrics.totalChurns === 0) {
    return (
      <div className="space-y-6">
        {/* Week Selector */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setWeekOffset((o) => o - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center min-w-[250px]">
                  <p className="text-sm font-semibold">{weekLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    Semana {weekNumber}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setWeekOffset((o) => o + 1)}
                  disabled={weekOffset >= 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {weekOffset !== 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWeekOffset(0)}
                  >
                    Semana Atual
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center py-16">
          <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Nenhum churn registrado nesta semana
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione outra semana para visualizar o relatório
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={reportRef}>
      {/* ── Week Selector + Export Buttons ── */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekOffset((o) => o - 1)}
                data-testid="btn-prev-week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[250px]">
                <p className="text-sm font-semibold">{weekLabel}</p>
                <p className="text-xs text-muted-foreground">
                  Semana {weekNumber}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekOffset((o) => o + 1)}
                disabled={weekOffset >= 0}
                data-testid="btn-next-week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekOffset(0)}
                >
                  Semana Atual
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyReportToClipboard}
                className="gap-2"
                data-testid="btn-copy-report"
              >
                <Copy className="h-4 w-4" />
                Copiar Relatório
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCsv}
                className="gap-2"
                data-testid="btn-export-csv"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToPdf}
                className="gap-2"
                data-testid="btn-export-pdf"
                disabled={isExportingPdf}
              >
                <Printer className="h-4 w-4" />
                {isExportingPdf ? "Gerando..." : "Exportar PDF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Executive Summary KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total de Churns"
          value={String(weekMetrics.totalChurns)}
          subtitle="contratos encerrados"
          icon={TrendingDown}
          gradient="bg-gradient-to-br from-red-500 to-rose-600"
          delta={comparison?.countDelta}
          deltaFmt="number"
        />
        <KpiCard
          title="MRR Perdido"
          value={formatCurrencyNoDecimals(weekMetrics.mrrPerdido)}
          subtitle="receita recorrente perdida"
          icon={DollarSign}
          gradient="bg-gradient-to-br from-orange-500 to-amber-600"
          delta={comparison?.mrrDelta}
          deltaFmt="currency"
        />
        <KpiCard
          title="Churn Rate Semanal"
          value={`${weekMetrics.churnRate.toFixed(2)}%`}
          subtitle="sobre MRR ativo"
          icon={Percent}
          gradient="bg-gradient-to-br from-purple-500 to-violet-600"
          delta={comparison?.rateDelta}
          deltaFmt="percent"
        />
        <KpiCard
          title={`Churn Mês (${monthLabel})`}
          value={monthMetrics ? `${monthMetrics.churnRate.toFixed(2)}%` : "—"}
          subtitle={monthMetrics ? `${monthMetrics.totalChurns} churns · ${formatCurrencyNoDecimals(monthMetrics.mrrPerdido)}` : "carregando..."}
          icon={CalendarDays}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
        />
        <KpiCard
          title="Pausados"
          value={String(weekMetrics.totalPausados)}
          subtitle="contratos pausados"
          icon={Pause}
          gradient="bg-gradient-to-br from-yellow-500 to-amber-500"
        />
      </div>

      {/* ── Squad + Motivo side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Churn por Squad */}
        <Card className="border-border/50 bg-gradient-to-b from-white to-slate-50/80 dark:from-zinc-900/70 dark:to-zinc-950/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Churn por Squad</CardTitle>
                <CardDescription className="text-xs">Distribuição de MRR perdido por squad</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {weekMetrics.squadData.length > 0 ? (
              <>
                <div className="rounded-lg border border-border/40 bg-white/80 dark:bg-zinc-900/50 p-3">
                  <ResponsiveContainer width="100%" height={Math.max(weekMetrics.squadData.length * 40, 120)}>
                    <BarChart data={weekMetrics.squadData} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" tickFormatter={(v) => formatCurrencyNoDecimals(v)} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="squad" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip valueFormatter={formatCurrencyNoDecimals} />} />
                      <Bar dataKey="mrr" name="MRR Perdido" radius={[0, 4, 4, 0]}>
                        {weekMetrics.squadData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Squad</TableHead>
                        <TableHead className="text-xs text-center">Qtd</TableHead>
                        <TableHead className="text-xs text-right">MRR</TableHead>
                        <TableHead className="text-xs text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weekMetrics.squadData.map((s, i) => (
                        <TableRow key={s.squad}>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              {s.squad}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-center">{s.count}</TableCell>
                          <TableCell className="text-sm text-right font-medium text-red-600 dark:text-red-400">
                            {formatCurrencyNoDecimals(s.mrr)}
                          </TableCell>
                          <TableCell className="text-sm text-right text-muted-foreground">
                            {s.percentual.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de squad</p>
            )}
          </CardContent>
        </Card>

        {/* Churn por Motivo */}
        <Card className="border-border/50 bg-gradient-to-b from-white to-slate-50/80 dark:from-zinc-900/70 dark:to-zinc-950/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-gradient-to-br from-purple-500 to-violet-600 shadow-sm">
                <PieChartIcon className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Churn por Motivo</CardTitle>
                <CardDescription className="text-xs">Principais razões de cancelamento</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {weekMetrics.motivoData.length > 0 ? (
              <>
                <div className="rounded-lg border border-border/40 bg-white/80 dark:bg-zinc-900/50 p-3">
                  <ResponsiveContainer width="100%" height={220}>
                    <RechartsPie>
                      <Pie
                        data={weekMetrics.motivoData}
                        dataKey="mrr"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        paddingAngle={2}
                      >
                        {weekMetrics.motivoData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrencyNoDecimals(value)}
                      />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Motivo</TableHead>
                        <TableHead className="text-xs text-center">Qtd</TableHead>
                        <TableHead className="text-xs text-right">MRR</TableHead>
                        <TableHead className="text-xs text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weekMetrics.motivoData.map((m, i) => (
                        <TableRow key={m.motivo}>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              {m.label}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-center">{m.count}</TableCell>
                          <TableCell className="text-sm text-right font-medium text-red-600 dark:text-red-400">
                            {formatCurrencyNoDecimals(m.mrr)}
                          </TableCell>
                          <TableCell className="text-sm text-right text-muted-foreground">
                            {m.percentual.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de motivo</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Churn por Responsável ── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-gradient-to-br from-emerald-500 to-green-600 shadow-sm">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Churn por Responsável</CardTitle>
              <CardDescription className="text-xs">CS Responsáveis pelos contratos encerrados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {weekMetrics.respData.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Responsável</TableHead>
                    <TableHead className="text-xs text-center">Contratos</TableHead>
                    <TableHead className="text-xs text-right">MRR Perdido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekMetrics.respData.map((r) => (
                    <TableRow key={r.responsavel}>
                      <TableCell className="text-sm font-medium">{r.responsavel}</TableCell>
                      <TableCell className="text-sm text-center">
                        <Badge variant="secondary">{r.count}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-right font-medium text-red-600 dark:text-red-400">
                        {formatCurrencyNoDecimals(r.mrr)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados de responsável</p>
          )}
        </CardContent>
      </Card>

      {/* ── Detalhamento dos Contratos ── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-gradient-to-br from-slate-500 to-zinc-600 shadow-sm">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Detalhamento dos Contratos</CardTitle>
                <CardDescription className="text-xs">
                  {weekMetrics.contratos.length} contratos encerrados na semana
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">CNPJ</TableHead>
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs">Squad</TableHead>
                  <TableHead className="text-xs">Responsável</TableHead>
                  <TableHead className="text-xs text-right">MRR</TableHead>
                  <TableHead className="text-xs">Motivo</TableHead>
                  <TableHead className="text-xs">Data Solicit.</TableHead>
                  <TableHead className="text-xs text-right">Lifetime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekMetrics.contratos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium max-w-[180px] truncate">
                      {c.cliente_nome}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {c.cnpj}
                    </TableCell>
                    <TableCell className="text-sm">{c.produto}</TableCell>
                    <TableCell className="text-sm">{c.squad}</TableCell>
                    <TableCell className="text-sm">{c.cs_responsavel || c.responsavel}</TableCell>
                    <TableCell className="text-sm text-right font-semibold text-red-600 dark:text-red-400">
                      {formatCurrencyNoDecimals(c.valorr)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="text-xs">
                        {MOTIVO_LABELS[c.motivo_cancelamento || ""] ||
                          c.motivo_cancelamento ||
                          "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.data_encerramento)}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      <Badge
                        variant={
                          c.lifetime_meses < 6
                            ? "destructive"
                            : c.lifetime_meses < 12
                            ? "secondary"
                            : "default"
                        }
                      >
                        {c.lifetime_meses.toFixed(1)}m
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
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
          <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "3px solid #ef4444", paddingBottom: "12px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>Relatório Semanal de Churn</h1>
            <div style={{ color: "#666", fontSize: "14px" }}>{weekLabel} (Semana {weekNumber}) — {monthLabel}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: "4px" }}>Total Churns</div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>{weekMetrics.totalChurns}</div>
              {comparison && <div style={{ fontSize: "10px", color: comparison.countDelta > 0 ? "#ef4444" : "#10b981", marginTop: "2px" }}>{comparison.countDelta > 0 ? "+" : ""}{comparison.countDelta} vs semana anterior</div>}
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: "4px" }}>MRR Perdido</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#ef4444" }}>{formatCurrencyNoDecimals(weekMetrics.mrrPerdido)}</div>
              {comparison && <div style={{ fontSize: "10px", color: comparison.mrrDelta > 0 ? "#ef4444" : "#10b981", marginTop: "2px" }}>{comparison.mrrDelta > 0 ? "+" : ""}{formatCurrencyNoDecimals(comparison.mrrDelta)} vs anterior</div>}
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: "4px" }}>Churn Rate Semanal</div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>{weekMetrics.churnRate.toFixed(2)}%</div>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: "4px" }}>Churn Mês ({monthLabel})</div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>{monthMetrics ? `${monthMetrics.churnRate.toFixed(2)}%` : "—"}</div>
              {monthMetrics && <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>{monthMetrics.totalChurns} churns · {formatCurrencyNoDecimals(monthMetrics.mrrPerdido)}</div>}
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: "4px" }}>Pausados</div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>{weekMetrics.totalPausados}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px" }}>Churn por Squad</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr>
                    <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Squad</th>
                    <th style={{ background: "#f3f4f6", textAlign: "center", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Qtd</th>
                    <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>MRR</th>
                    <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {weekMetrics.squadData.map((s, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? "#f9fafb" : "transparent" }}>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{s.squad}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>{s.count}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#ef4444", fontWeight: 600 }}>{formatCurrencyNoDecimals(s.mrr)}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{s.percentual.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px" }}>Churn por Motivo</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr>
                    <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Motivo</th>
                    <th style={{ background: "#f3f4f6", textAlign: "center", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Qtd</th>
                    <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>MRR</th>
                    <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {weekMetrics.motivoData.map((m, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? "#f9fafb" : "transparent" }}>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{m.label}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>{m.count}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#ef4444", fontWeight: 600 }}>{formatCurrencyNoDecimals(m.mrr)}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{m.percentual.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px" }}>Churn por Responsável</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "20px" }}>
            <thead>
              <tr>
                <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Responsável</th>
                <th style={{ background: "#f3f4f6", textAlign: "center", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Contratos</th>
                <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>MRR Perdido</th>
              </tr>
            </thead>
            <tbody>
              {weekMetrics.respData.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? "#f9fafb" : "transparent" }}>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{r.responsavel}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>{r.count}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#ef4444", fontWeight: 600 }}>{formatCurrencyNoDecimals(r.mrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", borderBottom: "2px solid #e5e7eb", paddingBottom: "4px" }}>Detalhamento dos Contratos</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr>
                <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Cliente</th>
                <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>CNPJ</th>
                <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Produto</th>
                <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Squad</th>
                <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Responsável</th>
                <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>MRR</th>
                <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Motivo</th>
                <th style={{ background: "#f3f4f6", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Data</th>
                <th style={{ background: "#f3f4f6", textAlign: "right", padding: "6px 8px", fontWeight: 600, borderBottom: "2px solid #d1d5db" }}>Lifetime</th>
              </tr>
            </thead>
            <tbody>
              {weekMetrics.contratos.map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? "#f9fafb" : "transparent" }}>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{c.cliente_nome}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", fontSize: "10px" }}>{c.cnpj}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{c.produto}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{c.squad}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{c.cs_responsavel || c.responsavel}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", color: "#ef4444", fontWeight: 600 }}>{formatCurrencyNoDecimals(c.valorr)}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 500, background: "#f3f4f6" }}>
                      {MOTIVO_LABELS[c.motivo_cancelamento || ""] || c.motivo_cancelamento || "N/A"}
                    </span>
                  </td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{formatDate(c.data_encerramento)}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{c.lifetime_meses.toFixed(1)}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
