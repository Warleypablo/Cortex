import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  FileBarChart,
  Download,
  TrendingUp,
  Users,
  Scale,
  AlertTriangle,
  CheckCircle,
  FileText,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ResumoData {
  kpis: {
    totalInadimplentes: number;
    valorEmRisco: number;
    acordosFechados: number;
    taxaRecuperacao: number;
    processosAtivos: number;
    valorProcessos: number;
  };
  evolucaoMensal: Array<{
    mes: string;
    mesLabel: string;
    qtdInadimplentes: number;
    valorRisco: number;
  }>;
  porProcedimento: Array<{ procedimento: string; total: number }>;
  porStatus: Array<{ status_juridico: string; total: number }>;
}

interface InadimplenciaItem {
  clienteId: string;
  nomeCliente: string;
  cnpjCliente: string;
  valorTotal: number;
  diasAtrasoMax: number;
  procedimento: string;
  statusJuridico: string;
  valorAcordado: number | null;
  observacoes: string | null;
  advogadoResponsavel: string | null;
  dataAtualizacao: string;
}

interface ProcessosData {
  kpis: {
    totalProcessos: number;
    processosAtivos: number;
    valorTotalRisco: number;
    valorRiscoAtivo: number;
  };
  porNatureza: Array<{
    natureza: string;
    quantidade: number;
    valor: number;
  }>;
  porStatus: Array<{ status: string; quantidade: number }>;
  lista: Array<{
    id: number;
    numeroCnj: string;
    clientePrincipal: string;
    status: string;
    naturezaAcao: string;
    comarca: string;
    valorCausa: number;
    dataDistribuicao: string;
  }>;
}

interface ContratosData {
  kpis: {
    totalContratos: number;
    contratosAtivos: number;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

const periodoOptions = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return {
    value: format(d, "yyyy-MM"),
    label: format(d, "MMMM yyyy", { locale: ptBR }),
  };
});

const procedimentoBadgeColor: Record<string, string> = {
  notificacao:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  protesto:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  acao_judicial:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  acordo:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  baixa:
    "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300",
};

const statusBadgeColor: Record<string, string> = {
  em_andamento:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  aguardando_documentos:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  finalizado:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  suspenso:
    "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300",
};

const formatProcedimento = (p: string) =>
  p
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatStatus = (s: string) =>
  s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

// ── PDF Export ─────────────────────────────────────────────────────────────────

const exportToPdf = async (elementId: string, title: string) => {
  const { default: jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas");

  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Header
  pdf.setFontSize(16);
  pdf.text(title, 14, 15);
  pdf.setFontSize(10);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    14,
    22,
  );

  // Content
  const imgWidth = pageWidth - 28;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const maxImgHeight = pageHeight - 40;

  if (imgHeight <= maxImgHeight) {
    pdf.addImage(imgData, "PNG", 14, 28, imgWidth, imgHeight);
  } else {
    const scaledWidth = imgWidth * (maxImgHeight / imgHeight);
    pdf.addImage(imgData, "PNG", 14, 28, scaledWidth, maxImgHeight);
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(180, 180, 180);
  pdf.text(
    "Gerado por Cortex — Confidencial",
    pageWidth / 2,
    pageHeight - 5,
    { align: "center" },
  );

  pdf.save(
    `relatorio-juridico-${title.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`,
  );
};

// ── Loading Spinner ────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RelatoriosJuridico() {
  const [selectedPeriod, setSelectedPeriod] = useState(
    periodoOptions[0].value,
  );
  const [activeTab, setActiveTab] = useState("resumo");

  // ── Queries ────────────────────────────────────────────────────────────────

  const {
    data: resumoData,
    isLoading: resumoLoading,
  } = useQuery<ResumoData>({
    queryKey: [
      `/api/juridico/relatorios?tipo=resumo&periodo=${selectedPeriod}`,
    ],
  });

  const {
    data: inadimplenciaData,
    isLoading: inadimplenciaLoading,
  } = useQuery<{ lista: InadimplenciaItem[] }>({
    queryKey: [`/api/juridico/relatorios?tipo=inadimplencia`],
  });

  const {
    data: processosData,
    isLoading: processosLoading,
  } = useQuery<ProcessosData>({
    queryKey: [`/api/juridico/relatorios?tipo=processos`],
  });

  const {
    data: contratosData,
    isLoading: contratosLoading,
  } = useQuery<ContratosData>({
    queryKey: [`/api/juridico/relatorios?tipo=contratos`],
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileBarChart className="h-7 w-7 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Relatórios Jurídicos
          </h1>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-zinc-400">
            Período:
          </span>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodoOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 dark:bg-zinc-800">
          <TabsTrigger value="resumo">Resumo Executivo</TabsTrigger>
          <TabsTrigger value="inadimplencia">Inadimplência</TabsTrigger>
          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Resumo Executivo ──────────────────────────────────────── */}
        <TabsContent value="resumo">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToPdf("relatorio-resumo", "Resumo Executivo")
              }
              className="border-gray-200 dark:border-zinc-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>

          {resumoLoading ? (
            <LoadingSpinner />
          ) : (
            <div id="relatorio-resumo" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Total Inadimplentes */}
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                      Total Inadimplentes
                    </CardTitle>
                    <Users className="h-5 w-5 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {resumoData?.kpis.totalInadimplentes ?? 0}
                    </div>
                    <Badge className="mt-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      clientes
                    </Badge>
                  </CardContent>
                </Card>

                {/* Valor em Risco */}
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                      Valor em Risco
                    </CardTitle>
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(resumoData?.kpis.valorEmRisco ?? 0)}
                    </div>
                  </CardContent>
                </Card>

                {/* Acordos Fechados */}
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                      Acordos Fechados
                    </CardTitle>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {resumoData?.kpis.acordosFechados ?? 0}
                    </div>
                  </CardContent>
                </Card>

                {/* Taxa Recuperação */}
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                      Taxa Recuperação
                    </CardTitle>
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(resumoData?.kpis.taxaRecuperacao ?? 0).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>

                {/* Processos Ativos */}
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                      Processos Ativos
                    </CardTitle>
                    <Scale className="h-5 w-5 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {resumoData?.kpis.processosAtivos ?? 0}
                    </div>
                  </CardContent>
                </Card>

                {/* Valor em Processos */}
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                      Valor em Processos
                    </CardTitle>
                    <FileText className="h-5 w-5 text-indigo-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(resumoData?.kpis.valorProcessos ?? 0)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Evolução Mensal Chart */}
              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">
                    Evolução Mensal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {resumoData?.evolucaoMensal &&
                  resumoData.evolucaoMensal.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={resumoData.evolucaoMensal}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#374151"
                          opacity={0.2}
                        />
                        <XAxis
                          dataKey="mesLabel"
                          tick={{ fontSize: 12 }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 12 }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 12 }}
                          stroke="#9ca3af"
                          tickFormatter={(v: number) => formatCurrency(v)}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            if (name === "Valor Risco")
                              return formatCurrency(value);
                            return value;
                          }}
                          contentStyle={{
                            backgroundColor: "#18181b",
                            border: "1px solid #3f3f46",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="qtdInadimplentes"
                          name="Qtd Inadimplentes"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="valorRisco"
                          name="Valor Risco"
                          fill="#ef4444"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-500 dark:text-zinc-500 py-10">
                      Sem dados de evolução mensal.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Distribution Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Por Procedimento */}
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">
                      Por Procedimento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {resumoData?.porProcedimento &&
                    resumoData.porProcedimento.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={resumoData.porProcedimento}
                            dataKey="total"
                            nameKey="procedimento"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ procedimento, total }) =>
                              `${formatProcedimento(procedimento)}: ${total}`
                            }
                          >
                            {resumoData.porProcedimento.map((_, idx) => (
                              <Cell
                                key={`proc-${idx}`}
                                fill={COLORS[idx % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => value}
                            contentStyle={{
                              backgroundColor: "#18181b",
                              border: "1px solid #3f3f46",
                              borderRadius: "8px",
                              color: "#fff",
                            }}
                          />
                          <Legend
                            formatter={(value: string) =>
                              formatProcedimento(value)
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-gray-500 dark:text-zinc-500 py-10">
                        Sem dados de procedimento.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Por Status */}
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">
                      Por Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {resumoData?.porStatus &&
                    resumoData.porStatus.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={resumoData.porStatus}
                            dataKey="total"
                            nameKey="status_juridico"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ status_juridico, total }) =>
                              `${formatStatus(status_juridico)}: ${total}`
                            }
                          >
                            {resumoData.porStatus.map((_, idx) => (
                              <Cell
                                key={`status-${idx}`}
                                fill={COLORS[idx % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => value}
                            contentStyle={{
                              backgroundColor: "#18181b",
                              border: "1px solid #3f3f46",
                              borderRadius: "8px",
                              color: "#fff",
                            }}
                          />
                          <Legend
                            formatter={(value: string) => formatStatus(value)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-gray-500 dark:text-zinc-500 py-10">
                        Sem dados de status.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Inadimplência Detalhada ───────────────────────────────── */}
        <TabsContent value="inadimplencia">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToPdf(
                  "relatorio-inadimplencia",
                  "Inadimplência Detalhada",
                )
              }
              className="border-gray-200 dark:border-zinc-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>

          {inadimplenciaLoading ? (
            <LoadingSpinner />
          ) : (
            <div id="relatorio-inadimplencia" className="space-y-6">
              {/* Summary Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      Total Clientes
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {inadimplenciaData?.lista?.length ?? 0}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      Valor Total
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(
                        inadimplenciaData?.lista?.reduce(
                          (sum, i) => sum + Number(i.valorTotal),
                          0,
                        ) ?? 0,
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      Maior Atraso
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {inadimplenciaData?.lista && inadimplenciaData.lista.length > 0
                        ? Math.max(
                            ...inadimplenciaData.lista.map((i) => i.diasAtrasoMax),
                          )
                        : 0}{" "}
                      dias
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Table */}
              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardContent className="pt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-zinc-700">
                        <TableHead className="text-gray-600 dark:text-zinc-400">
                          Cliente
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">
                          CNPJ
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">
                          Valor Total
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">
                          Dias Atraso
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">
                          Procedimento
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">
                          Status
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">
                          Última Atualização
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inadimplenciaData?.lista && inadimplenciaData.lista.length > 0 ? (
                        inadimplenciaData.lista.map((item) => (
                          <TableRow
                            key={item.clienteId}
                            className="border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                          >
                            <TableCell className="font-medium text-gray-900 dark:text-white">
                              {item.nomeCliente}
                            </TableCell>
                            <TableCell className="text-gray-600 dark:text-zinc-400 font-mono text-sm">
                              {item.cnpjCliente}
                            </TableCell>
                            <TableCell className="text-right text-gray-900 dark:text-white font-semibold">
                              {formatCurrency(item.valorTotal)}
                            </TableCell>
                            <TableCell className="text-right text-gray-900 dark:text-white">
                              {item.diasAtrasoMax}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  procedimentoBadgeColor[item.procedimento] ??
                                  "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300"
                                }`}
                              >
                                {formatProcedimento(item.procedimento)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  statusBadgeColor[item.statusJuridico] ??
                                  "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300"
                                }`}
                              >
                                {formatStatus(item.statusJuridico)}
                              </span>
                            </TableCell>
                            <TableCell className="text-gray-600 dark:text-zinc-400 text-sm">
                              {item.dataAtualizacao
                                ? format(
                                    new Date(item.dataAtualizacao),
                                    "dd/MM/yyyy",
                                    { locale: ptBR },
                                  )
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-gray-500 dark:text-zinc-500 py-10"
                          >
                            Nenhum registro de inadimplência encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 3: Processos Judiciais ───────────────────────────────────── */}
        <TabsContent value="processos">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToPdf("relatorio-processos", "Processos Judiciais")
              }
              className="border-gray-200 dark:border-zinc-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>

          {processosLoading ? (
            <LoadingSpinner />
          ) : (
            <div id="relatorio-processos" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      Total Processos
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {processosData?.kpis.totalProcessos ?? 0}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      Ativos
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {processosData?.kpis.processosAtivos ?? 0}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      Valor Total Risco
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(
                        processosData?.kpis.valorTotalRisco ?? 0,
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      Valor Risco Ativo
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(
                        processosData?.kpis.valorRiscoAtivo ?? 0,
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Table */}
              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">
                    Lista de Processos
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-zinc-700">
                        <TableHead className="text-gray-600 dark:text-zinc-400">
                          CNJ
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">
                          Cliente
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">
                          Natureza
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">
                          Status
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400">
                          Comarca
                        </TableHead>
                        <TableHead className="text-gray-600 dark:text-zinc-400 text-right">
                          Valor Causa
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processosData?.lista &&
                      processosData.lista.length > 0 ? (
                        processosData.lista.map((proc) => (
                          <TableRow
                            key={proc.id}
                            className="border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                          >
                            <TableCell className="font-mono text-sm text-gray-900 dark:text-white">
                              {proc.numeroCnj || "—"}
                            </TableCell>
                            <TableCell className="font-medium text-gray-900 dark:text-white">
                              {proc.clientePrincipal}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{proc.naturezaAcao}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{proc.status}</Badge>
                            </TableCell>
                            <TableCell className="text-gray-600 dark:text-zinc-400">
                              {proc.comarca}
                            </TableCell>
                            <TableCell className="text-right text-gray-900 dark:text-white font-semibold">
                              {formatCurrency(proc.valorCausa)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-gray-500 dark:text-zinc-500 py-10"
                          >
                            Nenhum processo encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Distribution Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Por Natureza */}
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">
                      Por Natureza
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {processosData?.porNatureza &&
                    processosData.porNatureza.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={processosData.porNatureza}
                            dataKey="quantidade"
                            nameKey="natureza"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ natureza, quantidade }) =>
                              `${natureza}: ${quantidade}`
                            }
                          >
                            {processosData.porNatureza.map((_, idx) => (
                              <Cell
                                key={`nat-${idx}`}
                                fill={COLORS[idx % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#18181b",
                              border: "1px solid #3f3f46",
                              borderRadius: "8px",
                              color: "#fff",
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-gray-500 dark:text-zinc-500 py-10">
                        Sem dados de natureza.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Por Status */}
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">
                      Por Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {processosData?.porStatus &&
                    processosData.porStatus.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={processosData.porStatus}
                            dataKey="quantidade"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ status, quantidade }) =>
                              `${status}: ${quantidade}`
                            }
                          >
                            {processosData.porStatus.map((_, idx) => (
                              <Cell
                                key={`pst-${idx}`}
                                fill={COLORS[idx % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#18181b",
                              border: "1px solid #3f3f46",
                              borderRadius: "8px",
                              color: "#fff",
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-gray-500 dark:text-zinc-500 py-10">
                        Sem dados de status.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 4: Contratos ─────────────────────────────────────────────── */}
        <TabsContent value="contratos">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToPdf("relatorio-contratos", "Contratos")}
              className="border-gray-200 dark:border-zinc-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>

          {contratosLoading ? (
            <LoadingSpinner />
          ) : (
            <div id="relatorio-contratos" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                      Total Contratos
                    </CardTitle>
                    <FileText className="h-5 w-5 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {contratosData?.kpis.totalContratos ?? 0}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                      Contratos Ativos
                    </CardTitle>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {contratosData?.kpis.contratosAtivos ?? 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Info */}
              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardContent className="pt-6">
                  <p className="text-gray-600 dark:text-zinc-400">
                    Módulo de contratos detalhado disponível em{" "}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Contratos Colaboradores
                    </span>
                    .
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
