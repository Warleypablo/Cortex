import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
} from "recharts";
import {
  Scale,
  Search,
  Plus,
  Pencil,
  Trash2,
  Upload,
  DollarSign,
  TrendingUp,
  Users,
  Gavel,
  FileText,
  AlertCircle,
  Loader2,
  Eye,
  BarChart3,
  ArrowUpDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Processo {
  id: number;
  numeroCnj: string | null;
  clientePrincipal: string | null;
  posicaoCliente: string | null;
  acao: string | null;
  status: string | null;
  contrarioPrincipal: string | null;
  cpfCnpj: string | null;
  objetosAcao: string | null;
  dataDistribuicao: string | null;
  instancia: string | null;
  comarca: string | null;
  orgao: string | null;
  varaTurma: string | null;
  naturezaAcao: string | null;
  valorCausa: string | null;
  sentencaAcordao: string | null;
  ultimoAndamento: string | null;
  observacoes: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  criadoPor: string | null;
}

interface ProcessoResumo {
  totalProcessos: number;
  processosAtivos: number;
  valorTotalRisco: number;
  valorRiscoAtivo: number;
  porNatureza: { natureza: string; quantidade: number; valor: number }[];
  porStatus: { status: string; quantidade: number }[];
  porPosicao: { posicao: string; quantidade: number }[];
  porComarca: { comarca: string; quantidade: number }[];
  evolucaoMensal: { mes: string; mesLabel: string; quantidade: number }[];
}

type ProcessoForm = Omit<Processo, "id" | "criadoEm" | "atualizadoEm">;

const emptyForm: ProcessoForm = {
  numeroCnj: "",
  clientePrincipal: "",
  posicaoCliente: "",
  acao: "",
  status: "Ativo",
  contrarioPrincipal: "",
  cpfCnpj: "",
  objetosAcao: "",
  dataDistribuicao: "",
  instancia: "",
  comarca: "",
  orgao: "",
  varaTurma: "",
  naturezaAcao: "",
  valorCausa: "",
  sentencaAcordao: "",
  ultimoAndamento: "",
  observacoes: "",
  criadoPor: "",
};

const STATUS_COLORS: Record<string, string> = {
  Ativo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Encerrado: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400",
  Arquivado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Suspenso: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  "visao-geral": { title: "Processos - Visão Geral", subtitle: "Dashboard de processos judiciais" },
  "processos": { title: "Processos - Listagem", subtitle: "Lista completa de processos judiciais" },
};

export default function ProcessosJuridico() {
  usePageTitle("Processos Jurídicos");
  const { setPageInfo } = usePageInfo();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [naturezaFiltro, setNaturezaFiltro] = useState("todos");
  const [posicaoFiltro, setPosicaoFiltro] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialog, setDetailDialog] = useState<Processo | null>(null);
  const [editingProcesso, setEditingProcesso] = useState<Processo | null>(null);
  const [formData, setFormData] = useState<ProcessoForm>(emptyForm);
  const [ordenarPor, setOrdenarPor] = useState<string>("criadoEm");
  const [ordenarDir, setOrdenarDir] = useState<"asc" | "desc">("desc");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    const { title, subtitle } = TAB_TITLES[activeTab] || TAB_TITLES["visao-geral"];
    setPageInfo(title, subtitle);
  }, [activeTab, setPageInfo]);

  // Queries
  const { data: resumoData, isLoading: resumoLoading } = useQuery<ProcessoResumo>({
    queryKey: ["/api/juridico/processos/resumo"],
  });

  const { data: processosData, isLoading: processosLoading } = useQuery<{ processos: Processo[] }>({
    queryKey: ["/api/juridico/processos", { busca, status: statusFiltro, natureza: naturezaFiltro, posicao: posicaoFiltro }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      if (statusFiltro !== "todos") params.set("status", statusFiltro);
      if (naturezaFiltro !== "todos") params.set("natureza", naturezaFiltro);
      if (posicaoFiltro !== "todos") params.set("posicao", posicaoFiltro);
      const response = await fetch(`/api/juridico/processos?${params.toString()}`);
      if (!response.ok) throw new Error("Erro ao buscar processos");
      return response.json();
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: ProcessoForm) => {
      const res = await apiRequest("POST", "/api/juridico/processos", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/processos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/processos/resumo"] });
      toast({ title: "Processo criado com sucesso" });
      setDialogOpen(false);
      setFormData(emptyForm);
    },
    onError: () => toast({ title: "Erro ao criar processo", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProcessoForm }) => {
      const res = await apiRequest("PUT", `/api/juridico/processos/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/processos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/processos/resumo"] });
      toast({ title: "Processo atualizado com sucesso" });
      setDialogOpen(false);
      setEditingProcesso(null);
      setFormData(emptyForm);
    },
    onError: () => toast({ title: "Erro ao atualizar processo", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/juridico/processos/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/processos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/processos/resumo"] });
      toast({ title: "Processo excluído com sucesso" });
      setDeleteConfirm(null);
    },
    onError: () => toast({ title: "Erro ao excluir processo", variant: "destructive" }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/juridico/processos/seed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/processos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/processos/resumo"] });
      toast({ title: data.message || "Dados importados com sucesso" });
    },
    onError: (err: any) => toast({ title: "Erro ao importar dados", description: err?.message || String(err), variant: "destructive" }),
  });

  const processos = processosData?.processos || [];

  const sortedProcessos = useMemo(() => {
    return [...processos].sort((a, b) => {
      let valA: any, valB: any;
      switch (ordenarPor) {
        case "valorCausa":
          valA = parseFloat(a.valorCausa || "0");
          valB = parseFloat(b.valorCausa || "0");
          break;
        case "dataDistribuicao":
          valA = a.dataDistribuicao || "";
          valB = b.dataDistribuicao || "";
          break;
        case "clientePrincipal":
          valA = (a.clientePrincipal || "").toLowerCase();
          valB = (b.clientePrincipal || "").toLowerCase();
          break;
        default:
          valA = a.criadoEm || "";
          valB = b.criadoEm || "";
      }
      if (valA < valB) return ordenarDir === "asc" ? -1 : 1;
      if (valA > valB) return ordenarDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [processos, ordenarPor, ordenarDir]);

  const handleSort = (column: string) => {
    if (ordenarPor === column) {
      setOrdenarDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setOrdenarPor(column);
      setOrdenarDir("desc");
    }
  };

  const handleOpenCreate = () => {
    setEditingProcesso(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (processo: Processo) => {
    setEditingProcesso(processo);
    setFormData({
      numeroCnj: processo.numeroCnj || "",
      clientePrincipal: processo.clientePrincipal || "",
      posicaoCliente: processo.posicaoCliente || "",
      acao: processo.acao || "",
      status: processo.status || "Ativo",
      contrarioPrincipal: processo.contrarioPrincipal || "",
      cpfCnpj: processo.cpfCnpj || "",
      objetosAcao: processo.objetosAcao || "",
      dataDistribuicao: processo.dataDistribuicao || "",
      instancia: processo.instancia || "",
      comarca: processo.comarca || "",
      orgao: processo.orgao || "",
      varaTurma: processo.varaTurma || "",
      naturezaAcao: processo.naturezaAcao || "",
      valorCausa: processo.valorCausa || "",
      sentencaAcordao: processo.sentencaAcordao || "",
      ultimoAndamento: processo.ultimoAndamento || "",
      observacoes: processo.observacoes || "",
      criadoPor: processo.criadoPor || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingProcesso) {
      updateMutation.mutate({ id: editingProcesso.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // ==================== VISÃO GERAL ====================
  const renderVisaoGeral = () => {
    if (resumoLoading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        </div>
      );
    }

    if (!resumoData) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mb-3" />
          <p>Nenhum dado disponível</p>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="mt-4 gap-2"
            variant="outline"
          >
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar Dados Iniciais
          </Button>
        </div>
      );
    }

    const { totalProcessos, processosAtivos, valorTotalRisco, valorRiscoAtivo, porNatureza, porStatus, porPosicao, porComarca, evolucaoMensal } = resumoData;

    if (totalProcessos === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
          <Scale className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-xl font-medium text-gray-900 dark:text-white">Nenhum processo cadastrado</p>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Importe os dados da planilha para começar</p>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="mt-6 gap-2"
            size="lg"
          >
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar Dados Iniciais
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Total de Processos</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{totalProcessos}</p>
                  <Badge className="mt-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {processosAtivos} ativos
                  </Badge>
                </div>
                <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                  <Scale className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Valor Total em Risco</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrencyCompact(Number(valorTotalRisco))}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
                    Ativos: {formatCurrencyCompact(Number(valorRiscoAtivo))}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                  <DollarSign className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Por Natureza</p>
                  {porNatureza.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.quantidade}</span>
                      <span className="text-xs text-gray-500 dark:text-zinc-400">{item.natureza}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <Gavel className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Por Posição</p>
                  {porPosicao.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.quantidade}</span>
                      <span className="text-xs text-gray-500 dark:text-zinc-400">{item.posicao}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                  <Users className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Processos por Status */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-gray-900 dark:text-white">Processos por Status</CardTitle>
            </CardHeader>
            <CardContent>
              {porStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={porStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-zinc-700" />
                    <XAxis dataKey="status" tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-500 dark:text-zinc-400" />
                    <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-500 dark:text-zinc-400" />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "var(--color-background, #fff)", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    />
                    <Bar dataKey="quantidade" radius={[6, 6, 0, 0]}>
                      {porStatus.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 dark:text-zinc-400 py-12">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* Processos por Comarca */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-gray-900 dark:text-white">Top Comarcas</CardTitle>
            </CardHeader>
            <CardContent>
              {porComarca.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={porComarca} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-zinc-700" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-500 dark:text-zinc-400" />
                    <YAxis dataKey="comarca" type="category" width={100} tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-500 dark:text-zinc-400" />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "var(--color-background, #fff)", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    />
                    <Bar dataKey="quantidade" fill="#6366f1" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 dark:text-zinc-400 py-12">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* Valor por Natureza */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-gray-900 dark:text-white">Valor em Risco por Natureza</CardTitle>
            </CardHeader>
            <CardContent>
              {porNatureza.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={porNatureza}
                      dataKey="valor"
                      nameKey="natureza"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ natureza, percent }) => `${natureza} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {porNatureza.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: "var(--color-background, #fff)", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 dark:text-zinc-400 py-12">Sem dados</p>
              )}
            </CardContent>
          </Card>

          {/* Evolução Mensal */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-gray-900 dark:text-white">Evolução Mensal de Distribuições</CardTitle>
            </CardHeader>
            <CardContent>
              {evolucaoMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={evolucaoMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-zinc-700" />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-500 dark:text-zinc-400" />
                    <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-500 dark:text-zinc-400" />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "var(--color-background, #fff)", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    />
                    <Line type="monotone" dataKey="quantidade" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 dark:text-zinc-400 py-12">Sem dados</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // ==================== LISTAGEM DE PROCESSOS ====================
  const renderProcessos = () => {
    return (
      <div className="space-y-4">
        {/* Filtros */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
                <Input
                  placeholder="Buscar por CNJ, cliente, contrário ou ação..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                />
              </div>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="w-[150px] bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Encerrado">Encerrado</SelectItem>
                  <SelectItem value="Arquivado">Arquivado</SelectItem>
                  <SelectItem value="Suspenso">Suspenso</SelectItem>
                </SelectContent>
              </Select>
              <Select value={naturezaFiltro} onValueChange={setNaturezaFiltro}>
                <SelectTrigger className="w-[150px] bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                  <SelectValue placeholder="Natureza" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Naturezas</SelectItem>
                  <SelectItem value="Cível">Cível</SelectItem>
                  <SelectItem value="Trabalhista">Trabalhista</SelectItem>
                </SelectContent>
              </Select>
              <Select value={posicaoFiltro} onValueChange={setPosicaoFiltro}>
                <SelectTrigger className="w-[160px] bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                  <SelectValue placeholder="Posição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Posições</SelectItem>
                  <SelectItem value="Requerido">Requerido</SelectItem>
                  <SelectItem value="Exequente">Exequente</SelectItem>
                  <SelectItem value="Reclamado">Reclamado</SelectItem>
                  <SelectItem value="Reclamante">Reclamante</SelectItem>
                  <SelectItem value="Requerente">Requerente</SelectItem>
                  <SelectItem value="Autor">Autor</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleOpenCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Processo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm">
          <CardContent className="p-0">
            {processosLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : sortedProcessos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-zinc-400">
                <Scale className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-lg font-medium">Nenhum processo encontrado</p>
                <p className="text-sm">Cadastre um novo processo ou ajuste os filtros</p>
                <Button
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  className="mt-4 gap-2"
                  variant="outline"
                >
                  {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Importar Dados Iniciais
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold whitespace-nowrap cursor-pointer" onClick={() => handleSort("numeroCnj")}>
                        <div className="flex items-center gap-1">N. CNJ <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold whitespace-nowrap cursor-pointer" onClick={() => handleSort("clientePrincipal")}>
                        <div className="flex items-center gap-1">Cliente <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold whitespace-nowrap">Posição</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold">Ação</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold whitespace-nowrap">Contrário</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold whitespace-nowrap">Natureza</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold whitespace-nowrap">Comarca</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold whitespace-nowrap cursor-pointer" onClick={() => handleSort("dataDistribuicao")}>
                        <div className="flex items-center gap-1">Distribuição <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold whitespace-nowrap cursor-pointer text-right" onClick={() => handleSort("valorCausa")}>
                        <div className="flex items-center justify-end gap-1">Valor <ArrowUpDown className="h-3 w-3" /></div>
                      </TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 font-semibold text-center whitespace-nowrap">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProcessos.map((processo) => (
                      <TableRow key={processo.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 border-b border-gray-100 dark:border-zinc-800">
                        <TableCell className="font-mono text-xs text-gray-700 dark:text-zinc-300 whitespace-nowrap">
                          {processo.numeroCnj || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-900 dark:text-white font-medium max-w-[180px] truncate">
                          {processo.clientePrincipal || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                          {processo.posicaoCliente || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-zinc-400 max-w-[200px] truncate">
                          {processo.acao || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[processo.status || ""] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}>
                            {processo.status || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-zinc-400 min-w-[280px]">
                          {processo.contrarioPrincipal || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                          {processo.naturezaAcao || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                          {processo.comarca || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                          {formatDate(processo.dataDistribuicao)}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-gray-900 dark:text-white text-right whitespace-nowrap">
                          {processo.valorCausa ? formatCurrency(parseFloat(processo.valorCausa)) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailDialog(processo)}>
                              <Eye className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(processo)}>
                              <Pencil className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirm(processo.id)}>
                              <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {!processosLoading && sortedProcessos.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800 text-sm text-gray-500 dark:text-zinc-400">
                {sortedProcessos.length} processo{sortedProcessos.length !== 1 ? "s" : ""} encontrado{sortedProcessos.length !== 1 ? "s" : ""}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ==================== FORM DIALOG ====================
  const renderFormDialog = () => (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            {editingProcesso ? "Editar Processo" : "Novo Processo"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Número CNJ</Label>
            <Input
              value={formData.numeroCnj || ""}
              onChange={(e) => setFormData({ ...formData, numeroCnj: e.target.value })}
              placeholder="0000000-00.0000.0.00.0000"
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Cliente Principal</Label>
            <Input
              value={formData.clientePrincipal || ""}
              onChange={(e) => setFormData({ ...formData, clientePrincipal: e.target.value })}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Posição do Cliente</Label>
            <Select value={formData.posicaoCliente || ""} onValueChange={(v) => setFormData({ ...formData, posicaoCliente: v })}>
              <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Requerido">Requerido</SelectItem>
                <SelectItem value="Requerente">Requerente</SelectItem>
                <SelectItem value="Exequente">Exequente</SelectItem>
                <SelectItem value="Reclamado">Reclamado</SelectItem>
                <SelectItem value="Reclamante">Reclamante</SelectItem>
                <SelectItem value="Autor">Autor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Status</Label>
            <Select value={formData.status || "Ativo"} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Encerrado">Encerrado</SelectItem>
                <SelectItem value="Arquivado">Arquivado</SelectItem>
                <SelectItem value="Suspenso">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Contrário Principal</Label>
            <Input
              value={formData.contrarioPrincipal || ""}
              onChange={(e) => setFormData({ ...formData, contrarioPrincipal: e.target.value })}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">CPF/CNPJ</Label>
            <Input
              value={formData.cpfCnpj || ""}
              onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value })}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Data de Distribuição</Label>
            <Input
              type="date"
              value={formData.dataDistribuicao || ""}
              onChange={(e) => setFormData({ ...formData, dataDistribuicao: e.target.value })}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Instância</Label>
            <Select value={formData.instancia || ""} onValueChange={(v) => setFormData({ ...formData, instancia: v })}>
              <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1ª Instância">1ª Instância</SelectItem>
                <SelectItem value="2ª Instância">2ª Instância</SelectItem>
                <SelectItem value="Instância Superior">Instância Superior</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Comarca</Label>
            <Input
              value={formData.comarca || ""}
              onChange={(e) => setFormData({ ...formData, comarca: e.target.value })}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Órgão</Label>
            <Input
              value={formData.orgao || ""}
              onChange={(e) => setFormData({ ...formData, orgao: e.target.value })}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Vara/Turma</Label>
            <Input
              value={formData.varaTurma || ""}
              onChange={(e) => setFormData({ ...formData, varaTurma: e.target.value })}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Natureza da Ação</Label>
            <Select value={formData.naturezaAcao || ""} onValueChange={(v) => setFormData({ ...formData, naturezaAcao: v })}>
              <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cível">Cível</SelectItem>
                <SelectItem value="Trabalhista">Trabalhista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Valor da Causa (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.valorCausa || ""}
              onChange={(e) => setFormData({ ...formData, valorCausa: e.target.value })}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-gray-700 dark:text-zinc-300">Ação (Tipo)</Label>
            <Input
              value={formData.acao || ""}
              onChange={(e) => setFormData({ ...formData, acao: e.target.value })}
              placeholder="Ex: Ação de execução de título extrajudicial"
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-gray-700 dark:text-zinc-300">Objetos da Ação</Label>
            <Textarea
              value={formData.objetosAcao || ""}
              onChange={(e) => setFormData({ ...formData, objetosAcao: e.target.value })}
              rows={2}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-gray-700 dark:text-zinc-300">Sentença/Acordão</Label>
            <Textarea
              value={formData.sentencaAcordao || ""}
              onChange={(e) => setFormData({ ...formData, sentencaAcordao: e.target.value })}
              rows={2}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-gray-700 dark:text-zinc-300">Último Andamento</Label>
            <Textarea
              value={formData.ultimoAndamento || ""}
              onChange={(e) => setFormData({ ...formData, ultimoAndamento: e.target.value })}
              rows={2}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-gray-700 dark:text-zinc-300">Observações</Label>
            <Textarea
              value={formData.observacoes || ""}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
              className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-200 dark:border-zinc-700">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editingProcesso ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ==================== DETAIL DIALOG ====================
  const renderDetailDialog = () => {
    if (!detailDialog) return null;
    const p = detailDialog;

    const fields = [
      { label: "Número CNJ", value: p.numeroCnj },
      { label: "Cliente Principal", value: p.clientePrincipal },
      { label: "Posição do Cliente", value: p.posicaoCliente },
      { label: "Ação", value: p.acao },
      { label: "Status", value: p.status },
      { label: "Contrário Principal", value: p.contrarioPrincipal },
      { label: "CPF/CNPJ", value: p.cpfCnpj },
      { label: "Data de Distribuição", value: formatDate(p.dataDistribuicao) },
      { label: "Instância", value: p.instancia },
      { label: "Comarca", value: p.comarca },
      { label: "Órgão", value: p.orgao },
      { label: "Vara/Turma", value: p.varaTurma },
      { label: "Natureza da Ação", value: p.naturezaAcao },
      { label: "Valor da Causa", value: p.valorCausa ? formatCurrency(parseFloat(p.valorCausa)) : null },
    ];

    return (
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Detalhes do Processo
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {fields.map((field, i) => (
              <div key={i} className={field.label === "Ação" ? "col-span-2" : ""}>
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">{field.label}</p>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{field.value || "-"}</p>
              </div>
            ))}
          </div>

          {(p.objetosAcao || p.sentencaAcordao || p.ultimoAndamento || p.observacoes) && (
            <div className="space-y-4 border-t border-gray-200 dark:border-zinc-700 pt-4">
              {p.objetosAcao && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Objetos da Ação</p>
                  <p className="text-sm text-gray-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap">{p.objetosAcao}</p>
                </div>
              )}
              {p.sentencaAcordao && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Sentença/Acordão</p>
                  <p className="text-sm text-gray-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap">{p.sentencaAcordao}</p>
                </div>
              )}
              {p.ultimoAndamento && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Último Andamento</p>
                  <p className="text-sm text-gray-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap">{p.ultimoAndamento}</p>
                </div>
              )}
              {p.observacoes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Observações</p>
                  <p className="text-sm text-gray-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap">{p.observacoes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  // ==================== DELETE CONFIRM ====================
  const renderDeleteConfirm = () => (
    <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
      <DialogContent className="max-w-sm bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">Confirmar Exclusão</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Tem certeza que deseja excluir este processo? Esta ação não pode ser desfeita.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-gray-200 dark:border-zinc-700">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20 min-h-screen" data-testid="page-processos-juridico">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-700/50" data-testid="tabs-processos">
          <TabsTrigger
            value="visao-geral"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md rounded-lg px-4 py-2.5 transition-all duration-200"
            data-testid="tab-visao-geral"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="processos"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md rounded-lg px-4 py-2.5 transition-all duration-200"
            data-testid="tab-processos"
          >
            <FileText className="h-4 w-4 mr-2" />
            Processos ({processos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          {renderVisaoGeral()}
        </TabsContent>

        <TabsContent value="processos">
          {renderProcessos()}
        </TabsContent>
      </Tabs>

      {renderFormDialog()}
      {renderDetailDialog()}
      {renderDeleteConfirm()}
    </div>
  );
}
