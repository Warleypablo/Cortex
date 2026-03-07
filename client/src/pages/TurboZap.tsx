import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Send, History, Settings, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, SkipForward, Search, Loader2,
  MessageSquare, TrendingUp, AlertTriangle, Phone, X, Scale,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

// ============================================
// Types
// ============================================

interface ClienteCobranca {
  id_cliente: string;
  cliente_nome: string;
  telefone: string;
  cnpj: string;
  data_vencimento: string;
  total: number;
  link_pagamento: string;
  status: string;
}

interface PreviewNivel {
  tipo: string;
  label: string;
  dias: number;
  data_vencimento: string;
  clientes: ClienteCobranca[];
  total_valor: number;
  instancia: "financeiro" | "juridico";
  condicional?: string;
}

interface EnvioRegistro {
  id: number;
  id_cliente: string;
  cliente_nome: string;
  cnpj: string;
  telefone: string;
  data_vencimento: string;
  valor: number;
  link_pagamento: string;
  tipo_cobranca: string;
  mensagem_enviada: string;
  status: string;
  erro_detalhe: string | null;
  executado_por: string;
  execucao_id: string;
  criado_em: string;
}

interface Stats {
  enviados_hoje: number;
  enviados_mes: number;
  erros_hoje: number;
  taxa_sucesso: number;
}

interface Configuracao {
  id: number;
  chave: string;
  valor: string;
  atualizado_por: string | null;
  atualizado_em: string;
}

interface PipelineJuridico {
  id: number;
  cnpj: string;
  cliente_nome: string;
  data_vencimento: string;
  valor: number;
  etapa: string;
  protesto_efetivado: boolean;
  negativacao_efetivada: boolean;
  observacoes: string | null;
  atualizado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

const ETAPAS_PIPELINE = [
  { value: "formalizado", label: "Formalizado", color: "text-violet-600 dark:text-violet-400" },
  { value: "protesto_comunicado", label: "Protesto Comunicado", color: "text-fuchsia-600 dark:text-fuchsia-400" },
  { value: "protesto_efetivado", label: "Protesto Efetivado", color: "text-pink-600 dark:text-pink-400" },
  { value: "negativacao_comunicada", label: "Negativação Comunicada", color: "text-rose-600 dark:text-rose-400" },
  { value: "negativacao_efetivada", label: "Negativação Efetivada", color: "text-red-600 dark:text-red-400" },
];

// ============================================
// Constants
// ============================================

const TIPO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "D-3": { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  "D+0": { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
  "D+3": { bg: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800" },
  "D+7": { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  "D+10": { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  "D+15": { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
  "D+20": { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  "D+30": { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
  "D+40": { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30", text: "text-fuchsia-700 dark:text-fuchsia-300", border: "border-fuchsia-200 dark:border-fuchsia-800" },
  "D+45": { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
  "D+50": { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
  "D+55": { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-800 dark:text-red-300", border: "border-red-300 dark:border-red-800" },
};

const STATUS_BADGE: Record<string, { variant: "default" | "destructive" | "outline" | "secondary"; label: string }> = {
  enviado: { variant: "default", label: "Enviado" },
  erro: { variant: "destructive", label: "Erro" },
  pulado: { variant: "secondary", label: "Pulado" },
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("pt-BR");
  } catch {
    return dateStr;
  }
}

// ============================================
// Main Component
// ============================================

export default function TurboZap() {
  usePageTitle("TurboZap");
  useSetPageInfo("TurboZap", "Central de cobranças via WhatsApp");
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("preview");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">TurboZap</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Central de cobranças via WhatsApp</p>
        </div>
      </div>

      {/* KPIs */}
      <StatsCards />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="preview" className="gap-2">
            <Send className="w-4 h-4" /> Preview
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="w-4 h-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-2">
            <Settings className="w-4 h-4" /> Configurações
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-2">
            <Scale className="w-4 h-4" /> Pipeline Jurídico
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "preview" && <PreviewTab />}
      {activeTab === "historico" && <HistoricoTab />}
      {activeTab === "configuracoes" && <ConfiguracoesTab />}
      {activeTab === "pipeline" && <PipelineJuridicoTab />}
    </div>
  );
}

// ============================================
// Stats Cards
// ============================================

function StatsCards() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/turbozap/stats"],
  });

  const cards = [
    { icon: <Send className="w-5 h-5 text-blue-500" />, label: "Enviados Hoje", value: stats?.enviados_hoje ?? "—" },
    { icon: <MessageSquare className="w-5 h-5 text-green-500" />, label: "Enviados no Mês", value: stats?.enviados_mes ?? "—" },
    { icon: <AlertTriangle className="w-5 h-5 text-red-500" />, label: "Erros Hoje", value: stats?.erros_hoje ?? "—" },
    { icon: <TrendingUp className="w-5 h-5 text-emerald-500" />, label: "Taxa de Sucesso", value: stats ? `${stats.taxa_sucesso}%` : "—" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-zinc-800">{card.icon}</div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{card.label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// Preview Tab
// ============================================

function PreviewTab() {
  const { toast } = useToast();
  const [expandedNiveis, setExpandedNiveis] = useState<Set<string>>(new Set(["D-3", "D+0", "D+3"]));
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: preview = [], isLoading, isFetching } = useQuery<PreviewNivel[]>({
    queryKey: ["/api/turbozap/preview"],
  });

  const executarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/turbozap/executar");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/preview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/historico"] });
      toast({
        title: "Cobranças executadas!",
        description: `${data.enviados} enviados, ${data.erros} erros, ${data.pulados} pulados`,
      });
      setShowConfirm(false);
    },
    onError: () => {
      toast({ title: "Erro ao executar cobranças", variant: "destructive" });
    },
  });

  const totalClientes = useMemo(
    () => preview.reduce((sum, n) => sum + n.clientes.length, 0),
    [preview],
  );
  const totalValor = useMemo(
    () => preview.reduce((sum, n) => sum + n.total_valor, 0),
    [preview],
  );

  function toggleNivel(tipo: string) {
    setExpandedNiveis((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500 dark:text-zinc-400">Carregando preview...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 transition-opacity duration-200 ${isFetching ? "opacity-60" : ""}`}>
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          {totalClientes} cliente{totalClientes !== 1 ? "s" : ""} · {formatCurrency(totalValor)} total
        </p>
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={totalClientes === 0 || executarMutation.isPending}
          className="gap-2"
        >
          {executarMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {executarMutation.isPending ? "Enviando..." : "Executar Cobranças"}
        </Button>
      </div>

      {/* Níveis */}
      {preview.map((nivel) => {
        const isExpanded = expandedNiveis.has(nivel.tipo);
        const colors = TIPO_COLORS[nivel.tipo] || TIPO_COLORS["D-3"];

        return (
          <Card
            key={nivel.tipo}
            className={`${colors.border} border bg-white dark:bg-zinc-900 overflow-hidden`}
          >
            <button
              onClick={() => toggleNivel(nivel.tipo)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <Badge className={`${colors.bg} ${colors.text} border-0`}>
                  {nivel.tipo}
                </Badge>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {nivel.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  (venc: {formatDate(nivel.data_vencimento)})
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600 dark:text-zinc-400">
                  {nivel.clientes.length} cliente{nivel.clientes.length !== 1 ? "s" : ""}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(nivel.total_valor)}
                </span>
              </div>
            </button>

            {isExpanded && nivel.clientes.length > 0 && (
              <div className="border-t border-gray-100 dark:border-zinc-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-zinc-800">
                        <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Cliente</th>
                        <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Telefone</th>
                        <th className="text-right p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Valor</th>
                        <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Vencimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nivel.clientes.map((c, idx) => (
                        <tr
                          key={`${c.id_cliente}-${idx}`}
                          className="border-b border-gray-50 dark:border-zinc-800/50"
                        >
                          <td className="p-3">
                            <p className="font-medium text-gray-900 dark:text-white">{c.cliente_nome}</p>
                            {c.cnpj && (
                              <p className="text-xs text-gray-400 dark:text-zinc-500">{c.cnpj}</p>
                            )}
                          </td>
                          <td className="p-3 text-gray-600 dark:text-zinc-400">
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {c.telefone}
                            </div>
                          </td>
                          <td className="p-3 text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(c.total)}
                          </td>
                          <td className="p-3 text-gray-600 dark:text-zinc-400">
                            {formatDate(c.data_vencimento)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {isExpanded && nivel.clientes.length === 0 && (
              <div className="border-t border-gray-100 dark:border-zinc-800 p-6 text-center">
                <p className="text-sm text-gray-400 dark:text-zinc-500">Nenhum cliente neste nível</p>
              </div>
            )}
          </Card>
        );
      })}

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">
              Confirmar envio de cobranças
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-zinc-400">
              Você está prestes a enviar mensagens de cobrança via WhatsApp para:
              <br /><br />
              <strong className="text-gray-900 dark:text-white">{totalClientes} clientes</strong> totalizando{" "}
              <strong className="text-gray-900 dark:text-white">{formatCurrency(totalValor)}</strong>
              <br /><br />
              {preview.filter((n) => n.clientes.length > 0).map((n) => (
                <span key={n.tipo} className="block text-xs">
                  {n.tipo}: {n.clientes.length} cliente{n.clientes.length !== 1 ? "s" : ""} ({formatCurrency(n.total_valor)})
                </span>
              ))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-zinc-800 dark:text-white dark:border-zinc-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executarMutation.mutate()}
              disabled={executarMutation.isPending}
              className="bg-primary"
            >
              {executarMutation.isPending ? "Enviando..." : "Confirmar Envio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// Histórico Tab
// ============================================

function HistoricoTab() {
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const { data: historico = [], isLoading } = useQuery<EnvioRegistro[]>({
    queryKey: ["/api/turbozap/historico", { busca, tipo_cobranca: tipoFiltro, status: statusFiltro, data_inicio: dataInicio, data_fim: dataFim }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      if (tipoFiltro !== "todos") params.set("tipo_cobranca", tipoFiltro);
      if (statusFiltro !== "todos") params.set("status", statusFiltro);
      if (dataInicio) params.set("data_inicio", dataInicio);
      if (dataFim) params.set("data_fim", dataFim);
      const res = await fetch(`/api/turbozap/historico?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar histórico");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar cliente, CNPJ ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 bg-white dark:bg-zinc-900"
          />
        </div>
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-[130px] bg-white dark:bg-zinc-900">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            <SelectItem value="D-3">D-3</SelectItem>
            <SelectItem value="D+0">D+0</SelectItem>
            <SelectItem value="D+3">D+3</SelectItem>
            <SelectItem value="D+7">D+7</SelectItem>
            <SelectItem value="D+10">D+10</SelectItem>
            <SelectItem value="D+15">D+15</SelectItem>
            <SelectItem value="D+20">D+20</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-[130px] bg-white dark:bg-zinc-900">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
            <SelectItem value="pulado">Pulado</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="w-[150px] bg-white dark:bg-zinc-900"
          placeholder="Data início"
        />
        <Input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="w-[150px] bg-white dark:bg-zinc-900"
          placeholder="Data fim"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500 dark:text-zinc-400">Carregando histórico...</span>
        </div>
      ) : historico.length === 0 ? (
        <Card className="bg-white dark:bg-zinc-900">
          <CardContent className="p-12 text-center">
            <History className="w-8 h-8 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-gray-400 dark:text-zinc-500">Nenhum envio encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white dark:bg-zinc-900 overflow-hidden border-gray-200 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800">
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Data</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Cliente</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Telefone</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Tipo</th>
                  <th className="text-right p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Valor</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Status</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Executado por</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((envio) => {
                  const statusCfg = STATUS_BADGE[envio.status] || STATUS_BADGE.enviado;
                  const colors = TIPO_COLORS[envio.tipo_cobranca] || TIPO_COLORS["D-3"];
                  return (
                    <tr
                      key={envio.id}
                      className="border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="p-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                        {formatDateTime(envio.criado_em)}
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-gray-900 dark:text-white">{envio.cliente_nome}</p>
                        {envio.cnpj && (
                          <p className="text-xs text-gray-400 dark:text-zinc-500">{envio.cnpj}</p>
                        )}
                      </td>
                      <td className="p-3 text-gray-600 dark:text-zinc-400">{envio.telefone}</td>
                      <td className="p-3">
                        <Badge className={`${colors.bg} ${colors.text} border-0`}>
                          {envio.tipo_cobranca}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(envio.valor)}
                      </td>
                      <td className="p-3">
                        <Badge variant={statusCfg.variant}>
                          {envio.status === "enviado" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {envio.status === "erro" && <XCircle className="w-3 h-3 mr-1" />}
                          {envio.status === "pulado" && <SkipForward className="w-3 h-3 mr-1" />}
                          {statusCfg.label}
                        </Badge>
                        {envio.erro_detalhe && (
                          <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={envio.erro_detalhe}>
                            {envio.erro_detalhe}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-gray-600 dark:text-zinc-400 text-xs">{envio.executado_por}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================
// Configurações Tab
// ============================================

function ConfiguracoesTab() {
  const { toast } = useToast();
  const [localConfigs, setLocalConfigs] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [newSkipNum, setNewSkipNum] = useState("");

  const { data: configs = [], isLoading } = useQuery<Configuracao[]>({
    queryKey: ["/api/turbozap/configuracoes"],
    queryFn: async () => {
      const res = await fetch("/api/turbozap/configuracoes", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar configurações");
      return res.json();
    },
  });

  // Sync fetched configs to local state on load
  const configMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.chave] = c.valor;
    }
    // Initialize local state if empty
    if (Object.keys(localConfigs).length === 0 && configs.length > 0) {
      setLocalConfigs(map);
    }
    return map;
  }, [configs]);

  function getVal(chave: string): string {
    return localConfigs[chave] ?? configMap[chave] ?? "";
  }

  function setVal(chave: string, valor: string) {
    setLocalConfigs((prev) => ({ ...prev, [chave]: valor }));
    setDirty((prev) => new Set(prev).add(chave));
  }

  const saveMutation = useMutation({
    mutationFn: async (chave: string) => {
      const valor = localConfigs[chave] ?? "";
      const res = await apiRequest("PUT", "/api/turbozap/configuracoes", { chave, valor });
      return res.json();
    },
    onSuccess: (_data, chave) => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/configuracoes"] });
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(chave);
        return next;
      });
      toast({ title: "Configuração salva!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const dirtyKeys = Array.from(dirty);
      for (const chave of dirtyKeys) {
        const valor = localConfigs[chave] ?? "";
        await apiRequest("PUT", "/api/turbozap/configuracoes", { chave, valor });
      }
      return dirtyKeys;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/configuracoes"] });
      setDirty(new Set());
      toast({ title: "Todas as configurações salvas!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const templateKeysFinanceiro = ["D-3", "D+0", "D+3", "D+7", "D+10", "D+15", "D+20"];
  const templateKeysJuridico = ["D+30", "D+40", "D+45", "D+50", "D+55"];
  const skipNumerosRaw = getVal("skip_numeros");
  let skipNumeros: string[] = [];
  try {
    skipNumeros = JSON.parse(skipNumerosRaw);
  } catch {
    skipNumeros = [];
  }
  function addSkipNumero() {
    if (!newSkipNum.trim()) return;
    const cleaned = newSkipNum.replace(/\D/g, "");
    if (!cleaned) return;
    const updated = [...skipNumeros, cleaned];
    setVal("skip_numeros", JSON.stringify(updated));
    setNewSkipNum("");
  }

  function removeSkipNumero(num: string) {
    const updated = skipNumeros.filter((n) => n !== num);
    setVal("skip_numeros", JSON.stringify(updated));
  }

  return (
    <div className="space-y-6">
      {/* Save all button */}
      {dirty.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            {dirty.size} alteraç{dirty.size === 1 ? "ão" : "ões"} não salva{dirty.size === 1 ? "" : "s"}
          </p>
          <Button
            size="sm"
            onClick={() => saveAllMutation.mutate()}
            disabled={saveAllMutation.isPending}
          >
            {saveAllMutation.isPending ? "Salvando..." : "Salvar Tudo"}
          </Button>
        </div>
      )}

      {/* Templates Financeiro */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white text-lg">
            Templates — Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {templateKeysFinanceiro.map((tipo) => {
            const chave = `template_${tipo}`;
            const colors = TIPO_COLORS[tipo] || TIPO_COLORS["D-3"];
            const isDirty = dirty.has(chave);
            return (
              <div key={tipo} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`${colors.bg} ${colors.text} border-0`}>{tipo}</Badge>
                    {isDirty && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-400">modificado</span>
                    )}
                  </div>
                  {isDirty && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveMutation.mutate(chave)}
                      disabled={saveMutation.isPending}
                    >
                      Salvar
                    </Button>
                  )}
                </div>
                <Textarea
                  value={getVal(chave)}
                  onChange={(e) => setVal(chave, e.target.value)}
                  className="min-h-[120px] bg-gray-50 dark:bg-zinc-800 text-sm font-mono"
                  placeholder={`Template para ${tipo}...`}
                />
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  Variáveis: {"{nome}"}, {"{valor}"}, {"{vencimento}"}, {"{link_pagamento}"}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Templates Jurídico */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white text-lg flex items-center gap-2">
            Templates — Jurídico
            <Badge variant="outline" className="text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700">
              Instância Jurídico
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {templateKeysJuridico.map((tipo) => {
            const chave = `template_${tipo}`;
            const colors = TIPO_COLORS[tipo] || TIPO_COLORS["D+30"];
            const isDirty = dirty.has(chave);
            return (
              <div key={tipo} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`${colors.bg} ${colors.text} border-0`}>{tipo}</Badge>
                    {isDirty && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-400">modificado</span>
                    )}
                  </div>
                  {isDirty && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveMutation.mutate(chave)}
                      disabled={saveMutation.isPending}
                    >
                      Salvar
                    </Button>
                  )}
                </div>
                <Textarea
                  value={getVal(chave)}
                  onChange={(e) => setVal(chave, e.target.value)}
                  className="min-h-[120px] bg-gray-50 dark:bg-zinc-800 text-sm font-mono"
                  placeholder={`Template para ${tipo}...`}
                />
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  Variáveis: {"{nome}"}, {"{valor}"}, {"{vencimento}"}, {"{link_pagamento}"}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Skip Numbers */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white text-lg">
            Números para Pular
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Números nesta lista não receberão cobranças automáticas.
          </p>
          <div className="flex flex-wrap gap-2">
            {skipNumeros.map((num) => (
              <span
                key={num}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
              >
                {num}
                <button
                  onClick={() => removeSkipNumero(num)}
                  className="ml-1 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newSkipNum}
              onChange={(e) => setNewSkipNum(e.target.value)}
              placeholder="Adicionar número (ex: 5527999999999)"
              className="bg-gray-50 dark:bg-zinc-800"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkipNumero();
                }
              }}
            />
            <Button variant="outline" onClick={addSkipNumero}>
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delay & Dry Run */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white text-lg">
            Configurações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                Delay mínimo (segundos)
              </label>
              <Input
                type="number"
                value={getVal("delay_min")}
                onChange={(e) => setVal("delay_min", e.target.value)}
                className="bg-gray-50 dark:bg-zinc-800"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                Delay máximo (segundos)
              </label>
              <Input
                type="number"
                value={getVal("delay_max")}
                onChange={(e) => setVal("delay_max", e.target.value)}
                className="bg-gray-50 dark:bg-zinc-800"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                Modo simulação (dry run)
              </label>
              <Select
                value={getVal("dry_run")}
                onValueChange={(v) => setVal("dry_run", v)}
              >
                <SelectTrigger className="bg-gray-50 dark:bg-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Desativado (envia de verdade)</SelectItem>
                  <SelectItem value="true">Ativado (não envia)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                Dry run Jurídico
              </label>
              <Select
                value={getVal("dry_run_juridico")}
                onValueChange={(v) => setVal("dry_run_juridico", v)}
              >
                <SelectTrigger className="bg-gray-50 dark:bg-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativado (não envia)</SelectItem>
                  <SelectItem value="false">Desativado (envia de verdade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Pipeline Jurídico Tab
// ============================================

function PipelineJuridicoTab() {
  const { toast } = useToast();

  const { data: pipeline = [], isLoading } = useQuery<PipelineJuridico[]>({
    queryKey: ["/api/turbozap/pipeline-juridico"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Record<string, any> }) => {
      const res = await apiRequest("PUT", `/api/turbozap/pipeline-juridico/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/pipeline-juridico"] });
      toast({ title: "Pipeline atualizado!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (pipeline.length === 0) {
    return (
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <CardContent className="py-16 text-center">
          <Scale className="w-12 h-12 text-gray-300 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-zinc-400">Nenhum caso no pipeline jurídico.</p>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">
            Registros são criados automaticamente quando mensagens D+30 são enviadas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-white text-lg flex items-center gap-2">
          <Scale className="w-5 h-5" />
          Pipeline Jurídico ({pipeline.length} casos)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700">
                <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Cliente</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">CNPJ</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Vencimento</th>
                <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Valor</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Etapa</th>
                <th className="text-center py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Protesto</th>
                <th className="text-center py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Negativação</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  <td className="py-3 px-2 text-gray-900 dark:text-white font-medium">{item.cliente_nome}</td>
                  <td className="py-3 px-2 text-gray-600 dark:text-zinc-400 font-mono text-xs">{item.cnpj}</td>
                  <td className="py-3 px-2 text-gray-600 dark:text-zinc-400">{formatDate(item.data_vencimento)}</td>
                  <td className="py-3 px-2 text-right text-gray-900 dark:text-white">{formatCurrency(item.valor)}</td>
                  <td className="py-3 px-2">
                    <Select
                      value={item.etapa}
                      onValueChange={(v) => updateMutation.mutate({ id: item.id, updates: { etapa: v } })}
                    >
                      <SelectTrigger className="w-[200px] h-8 text-xs bg-gray-50 dark:bg-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ETAPAS_PIPELINE.map((e) => (
                          <SelectItem key={e.value} value={e.value}>
                            <span className={e.color}>{e.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Switch
                      checked={item.protesto_efetivado}
                      onCheckedChange={(v) => updateMutation.mutate({ id: item.id, updates: { protesto_efetivado: v } })}
                    />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Switch
                      checked={item.negativacao_efetivada}
                      onCheckedChange={(v) => updateMutation.mutate({ id: item.id, updates: { negativacao_efetivada: v } })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
