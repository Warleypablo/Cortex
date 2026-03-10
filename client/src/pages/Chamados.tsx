import { useState, useMemo } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, LayoutGrid, List, Clock, AlertCircle, CheckCircle2, Timer,
  MessageSquare, Send, Trash2, User, ArrowRight, RotateCcw, ChevronsUpDown, Check, Building2, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ============================================
// Types
// ============================================
interface Chamado {
  id: number;
  titulo: string;
  descricao: string;
  area: string;
  categoria: string | null;
  prioridade: string;
  status: string;
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email: string;
  solicitante_squad: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
  criado_em: string;
  atualizado_em: string;
  resolvido_em: string | null;
  fechado_em: string | null;
  cliente_cnpj: string | null;
  cliente_nome: string | null;
  total_comentarios?: number;
}

interface Comentario {
  id: number;
  chamado_id: number;
  autor_id: string;
  autor_nome: string;
  autor_email: string;
  comentario: string;
  interno: boolean;
  criado_em: string;
}

interface Stats {
  abertos: number;
  em_andamento: number;
  resolvidos_mes: number;
  tempo_medio_horas: number;
}

// ============================================
// Constants
// ============================================
const AREAS = [
  { value: "financeiro", label: "Financeiro" },
  { value: "ti", label: "TI" },
  { value: "rh", label: "RH" },
  { value: "operacao", label: "Operação" },
  { value: "comercial", label: "Comercial" },
  { value: "growth", label: "Growth" },
  { value: "cortex", label: "Cortex" },
];

const GROWTH_CATEGORIES = [
  "Design", "Criativo", "Copy", "Broadcast", "Sugestão de Conteúdo", "Gravação",
];

const PRIORIDADES = [
  { value: "baixa", label: "Baixa", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { value: "media", label: "Média", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { value: "alta", label: "Alta", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  { value: "urgente", label: "Urgente", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  aberto: { label: "Aberto", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", dotColor: "bg-blue-500" },
  triagem: { label: "Triagem", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", dotColor: "bg-purple-500" },
  em_andamento: { label: "Em Andamento", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", dotColor: "bg-amber-500" },
  review: { label: "Review", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", dotColor: "bg-indigo-500" },
  resolvido: { label: "Resolvido", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", dotColor: "bg-green-500" },
  fechado: { label: "Fechado", color: "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400", dotColor: "bg-gray-400" },
};

const KANBAN_COLUMNS = ["aberto", "triagem", "em_andamento", "review", "resolvido"];

function getPrioridadeConfig(p: string) {
  return PRIORIDADES.find((pr) => pr.value === p) || PRIORIDADES[1];
}

function getAreaLabel(a: string) {
  return AREAS.find((ar) => ar.value === a)?.label || a;
}

function timeAgo(date: string) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

// ============================================
// Main Page Component
// ============================================
export default function Chamados() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  // State
  const [view, setView] = useState<"meus" | "recebidos" | "squad" | "todos">("meus");
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPrioridade, setFilterPrioridade] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedChamado, setSelectedChamado] = useState<Chamado | null>(null);

  // Queries
  const { data: chamados = [], isLoading, isError, isFetching } = useQuery<Chamado[]>({
    queryKey: ["/api/chamados", { view, area: filterArea !== "all" ? filterArea : undefined, status: filterStatus !== "all" ? filterStatus : undefined, prioridade: filterPrioridade !== "all" ? filterPrioridade : undefined }],
    queryFn: async () => {
      const params = new URLSearchParams({ view });
      if (filterArea !== "all") params.set("area", filterArea);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterPrioridade !== "all") params.set("prioridade", filterPrioridade);
      const res = await fetch(`/api/chamados?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar chamados");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/chamados/stats"],
  });

  // Grouped for Kanban
  const kanbanData = useMemo(() => {
    const grouped: Record<string, Chamado[]> = {};
    for (const col of KANBAN_COLUMNS) grouped[col] = [];
    for (const ch of chamados) {
      if (grouped[ch.status]) grouped[ch.status].push(ch);
    }
    return grouped;
  }, [chamados]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Chamados</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Central de solicitações internas</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Chamado
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<AlertCircle className="w-5 h-5 text-blue-500" />} label="Abertos" value={stats?.abertos ?? 0} />
        <KpiCard icon={<Clock className="w-5 h-5 text-amber-500" />} label="Em Andamento" value={stats?.em_andamento ?? 0} />
        <KpiCard icon={<CheckCircle2 className="w-5 h-5 text-green-500" />} label="Resolvidos (mês)" value={stats?.resolvidos_mes ?? 0} />
        <KpiCard icon={<Timer className="w-5 h-5 text-purple-500" />} label="Tempo Médio" value={`${stats?.tempo_medio_horas ?? 0}h`} />
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="meus">Meus</TabsTrigger>
            <TabsTrigger value="recebidos">Recebidos</TabsTrigger>
            <TabsTrigger value="squad">Squad</TabsTrigger>
            {isAdmin && <TabsTrigger value="todos">Todos</TabsTrigger>}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Áreas</SelectItem>
              {AREAS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PRIORIDADES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg dark:border-zinc-700 overflow-hidden">
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-2 ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("lista")}
              className={`p-2 ${viewMode === "lista" ? "bg-primary text-primary-foreground" : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading && chamados.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <CardContent className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-gray-500 dark:text-zinc-400">Erro ao carregar chamados</p>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/chamados"] })}>
              <RotateCcw className="w-4 h-4 mr-2" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={`transition-opacity duration-200 ${isFetching ? "opacity-60" : ""}`}>
          {viewMode === "kanban" ? (
            <KanbanView data={kanbanData} onSelect={setSelectedChamado} />
          ) : (
            <ListView chamados={chamados} onSelect={setSelectedChamado} />
          )}
        </div>
      )}

      {/* Create Dialog */}
      <CreateChamadoDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Detail Sheet */}
      <DetailSheet
        chamado={selectedChamado}
        open={!!selectedChamado}
        onClose={() => setSelectedChamado(null)}
        onUpdate={(updated) => setSelectedChamado(updated)}
      />
    </div>
  );
}

// ============================================
// KPI Card
// ============================================
function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gray-50 dark:bg-zinc-800">{icon}</div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Kanban View
// ============================================
function KanbanView({ data, onSelect }: { data: Record<string, Chamado[]>; onSelect: (c: Chamado) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const cfg = STATUS_CONFIG[col];
        const items = data[col] || [];
        return (
          <div key={col} className="flex flex-col">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor}`} />
              <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300">{cfg.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[200px] p-2 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
              {items.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-8">Nenhum chamado</p>
              )}
              {items.map((ch) => (
                <KanbanCard key={ch.id} chamado={ch} onClick={() => onSelect(ch)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ chamado, onClick }: { chamado: Chamado; onClick: () => void }) {
  const prio = getPrioridadeConfig(chamado.prioridade);
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-primary/50 dark:hover:border-primary/50 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${prio.color}`}>{prio.label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 font-medium">{getAreaLabel(chamado.area)}</span>
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">{chamado.titulo}</p>
      <div className="flex items-center gap-1 mt-2 text-[11px] text-gray-400 dark:text-zinc-500">
        <span>{(chamado.solicitante_nome || "").split(" ")[0]}</span>
        <span>·</span>
        <span>{timeAgo(chamado.criado_em)}</span>
        {Number(chamado.total_comentarios) > 0 && (
          <>
            <span>·</span>
            <MessageSquare className="w-3 h-3" />
            <span>{chamado.total_comentarios}</span>
          </>
        )}
      </div>
    </button>
  );
}

// ============================================
// List View
// ============================================
function ListView({ chamados, onSelect }: { chamados: Chamado[]; onSelect: (c: Chamado) => void }) {
  if (chamados.length === 0) {
    return (
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <CardContent className="p-12 text-center">
          <p className="text-gray-400 dark:text-zinc-500">Nenhum chamado encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-zinc-800">
              <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Título</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Área</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Prioridade</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Status</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Solicitante</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-zinc-400">Data</th>
            </tr>
          </thead>
          <tbody>
            {chamados.map((ch) => {
              const st = STATUS_CONFIG[ch.status] || STATUS_CONFIG.aberto;
              const prio = getPrioridadeConfig(ch.prioridade);
              return (
                <tr
                  key={ch.id}
                  onClick={() => onSelect(ch)}
                  className="border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <p className="font-medium text-gray-900 dark:text-white line-clamp-1">{ch.titulo}</p>
                    {ch.categoria && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{ch.categoria}</p>}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">{getAreaLabel(ch.area)}</span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${prio.color}`}>{prio.label}</span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${st.color}`}>{st.label}</span>
                  </td>
                  <td className="p-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap">{ch.solicitante_nome}</td>
                  <td className="p-3 text-gray-400 dark:text-zinc-500 whitespace-nowrap text-xs">{timeAgo(ch.criado_em)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================
// Cortex Category Fields Config
// ============================================
interface CortexField {
  key: string;
  label: string;
  type: "input" | "textarea" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

const CORTEX_CATEGORY_FIELDS: Record<string, CortexField[]> = {
  Bug: [
    { key: "pagina_url", label: "Pagina/URL afetada", type: "input", required: true, placeholder: "Ex: /financeiro/inadimplencia" },
    { key: "passos_reproduzir", label: "Passos para reproduzir", type: "textarea", required: true, placeholder: "1. Acessar a pagina...\n2. Clicar em...\n3. Observar que..." },
    { key: "comportamento_esperado", label: "Comportamento esperado", type: "textarea", required: true, placeholder: "O que deveria acontecer?" },
    { key: "comportamento_atual", label: "Comportamento atual", type: "textarea", required: true, placeholder: "O que esta acontecendo de errado?" },
  ],
  "Nova Feature": [
    { key: "user_story", label: "Objetivo / User Story", type: "textarea", required: true, placeholder: "Como [perfil], quero [acao], para [beneficio]" },
    { key: "criterios_aceite", label: "Criterios de aceite", type: "textarea", required: true, placeholder: "- [ ] Criterio 1\n- [ ] Criterio 2" },
    { key: "paginas_componentes", label: "Paginas/componentes afetados", type: "input", required: false, placeholder: "Ex: Dashboard, Sidebar" },
  ],
  Melhoria: [
    { key: "comportamento_atual", label: "Comportamento atual", type: "textarea", required: true, placeholder: "Como funciona hoje?" },
    { key: "melhoria_desejada", label: "Melhoria desejada", type: "textarea", required: true, placeholder: "Como deveria funcionar?" },
    { key: "paginas_componentes", label: "Paginas/componentes afetados", type: "input", required: false, placeholder: "Ex: Tabela de clientes" },
  ],
  "Relatorio / Dashboard": [
    { key: "fonte_dados", label: "Fonte de dados", type: "input", required: true, placeholder: "Tabela ou API (ex: caz_parcelas)" },
    { key: "metricas_campos", label: "Metricas/campos necessarios", type: "textarea", required: true, placeholder: "Quais dados precisam aparecer?" },
    { key: "tipo_visualizacao", label: "Tipo de visualizacao", type: "select", required: true, options: ["Tabela", "Grafico de barras", "Grafico de linha", "Card KPI", "Outro"] },
  ],
  "Integracao": [
    { key: "sistema_externo", label: "Sistema externo", type: "input", required: true, placeholder: "Ex: Conta Azul, ClickUp" },
    { key: "tipo_integracao", label: "Tipo", type: "select", required: true, options: ["API REST", "Webhook", "Banco de dados", "Arquivo/CSV"] },
    { key: "direcao", label: "Direcao", type: "select", required: true, options: ["Entrada", "Saida", "Bidirecional"] },
    { key: "detalhes_integracao", label: "Detalhes da integracao", type: "textarea", required: true, placeholder: "Descreva o fluxo de dados desejado" },
  ],
  Outros: [
    { key: "detalhes_adicionais", label: "Detalhes adicionais", type: "textarea", required: true, placeholder: "Descreva com o maximo de detalhes possivel" },
  ],
};

// ============================================
// Create Dialog
// ============================================
function CreateChamadoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [area, setArea] = useState("");
  const [categoria, setCategoria] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [clienteCnpj, setClienteCnpj] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clientePopoverOpen, setClientePopoverOpen] = useState(false);
  const [detalhes, setDetalhes] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState("");

  const isCortex = area === "cortex";
  const isGrowth = area === "growth";
  const cortexFields = isCortex ? (CORTEX_CATEGORY_FIELDS[categoria] || []) : [];

  const { data: categoriasData } = useQuery<{ fieldType: string; options: { id: number; value: string; label: string }[] }>({
    queryKey: [`/api/system-fields/chamado_cat_${area}`],
    enabled: !!area && !isGrowth,
  });
  const categorias = isGrowth
    ? GROWTH_CATEGORIES.map((c, i) => ({ id: i, value: c, label: c }))
    : (categoriasData?.options ?? []);

  const { data: clientes = [] } = useQuery<{ nome: string; cnpj: string }[]>({
    queryKey: ["/api/chamados/clientes"],
    enabled: area === "financeiro",
  });

  function updateDetalhe(key: string, value: string) {
    setDetalhes((prev) => ({ ...prev, [key]: value }));
  }

  const cortexFieldsMissing = isCortex && categoria
    ? cortexFields.filter((f) => f.required && !detalhes[f.key]?.trim()).length > 0
    : false;

  const createMutation = useMutation({
    mutationFn: async () => {
      const growthDetalhes = isGrowth ? { ...detalhes, deadline: deadline || undefined } : undefined;
      const res = await apiRequest("POST", "/api/chamados", {
        titulo, descricao, area, categoria: categoria || null, prioridade,
        cliente_cnpj: area === "financeiro" ? (clienteCnpj || null) : null,
        cliente_nome: area === "financeiro" ? (clienteNome || null) : null,
        detalhes: isCortex && Object.keys(detalhes).length > 0
          ? detalhes
          : isGrowth ? growthDetalhes : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chamados"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chamados/stats"] });
      toast({ title: "Chamado criado com sucesso!" });
      resetForm();
      onClose();
    },
    onError: () => {
      toast({ title: "Erro ao criar chamado", variant: "destructive" });
    },
  });

  function resetForm() {
    setTitulo("");
    setDescricao("");
    setArea("");
    setCategoria("");
    setPrioridade("media");
    setClienteCnpj("");
    setClienteNome("");
    setDetalhes({});
    setDeadline("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">Novo Chamado</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-3">
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1 block">Titulo</label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Resumo da solicitacao"
              className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1 block">Descricao</label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva em detalhes a sua solicitacao..."
              rows={3}
              className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1 block">Area</label>
              <Select value={area} onValueChange={(v) => { setArea(v); setCategoria(""); setClienteCnpj(""); setClienteNome(""); setDetalhes({}); }}>
                <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1 block">Categoria</label>
              <Select value={categoria} onValueChange={(v) => { setCategoria(v); setDetalhes({}); }} disabled={!area || categorias.length === 0}>
                <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                  <SelectValue placeholder={area ? "Selecione" : "Selecione area"} />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.value} value={c.label}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cortex: Dynamic category fields */}
          {isCortex && categoria && cortexFields.length > 0 && (
            <div className="space-y-3 p-3 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                Detalhes - {categoria}
              </p>
              {cortexFields.map((field) => (
                <div key={field.key}>
                  <label className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1 block">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === "input" && (
                    <Input
                      value={detalhes[field.key] || ""}
                      onChange={(e) => updateDetalhe(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                    />
                  )}
                  {field.type === "textarea" && (
                    <Textarea
                      value={detalhes[field.key] || ""}
                      onChange={(e) => updateDetalhe(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                    />
                  )}
                  {field.type === "select" && field.options && (
                    <Select value={detalhes[field.key] || ""} onValueChange={(v) => updateDetalhe(field.key, v)}>
                      <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          )}

          {area === "financeiro" && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1 block">
                <Building2 className="w-3 h-3 inline mr-1" />
                Cliente
              </label>
              <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientePopoverOpen}
                    className="w-full justify-between bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 font-normal h-9 text-sm"
                  >
                    {clienteNome
                      ? <span className="truncate">{clienteNome}</span>
                      : <span className="text-muted-foreground">Buscar cliente...</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por nome ou CNPJ..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {clientes.map((c) => (
                          <CommandItem
                            key={c.cnpj}
                            value={`${c.nome} ${c.cnpj}`}
                            onSelect={() => {
                              setClienteCnpj(c.cnpj);
                              setClienteNome(c.nome);
                              setClientePopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", clienteCnpj === c.cnpj ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate text-sm">{c.nome}</span>
                              <span className="text-xs text-muted-foreground">{c.cnpj}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
          {/* Growth: Deadline field */}
          {isGrowth && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1 block">
                <CalendarDays className="w-3 h-3 inline mr-1" />
                Deadline de entrega <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1 block">Prioridade</label>
            <Select value={prioridade} onValueChange={setPrioridade}>
              <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!titulo || !descricao || !area || cortexFieldsMissing || (isGrowth && (!categoria || !deadline)) || createMutation.isPending}
          >
            {createMutation.isPending ? "Criando..." : "Criar Chamado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Detail Sheet
// ============================================
function DetailSheet({ chamado, open, onClose, onUpdate }: { chamado: Chamado | null; open: boolean; onClose: () => void; onUpdate: (c: Chamado) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comentarioText, setComentarioText] = useState("");

  const isAdmin = user?.role === "admin";
  const isSolicitante = chamado ? user?.email === chamado.solicitante_email : false;
  const isResponsavel = chamado ? user?.email === chamado.responsavel_email : false;

  // Fresh detail
  const { data: detail } = useQuery<Chamado>({
    queryKey: ["/api/chamados", chamado?.id],
    queryFn: async () => {
      const res = await fetch(`/api/chamados/${chamado!.id}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!chamado,
    initialData: chamado || undefined,
  });

  const ch = detail || chamado;

  // Comments
  const { data: comentarios = [] } = useQuery<Comentario[]>({
    queryKey: [`/api/chamados/${chamado?.id}/comentarios`],
    enabled: !!chamado,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, any>) => {
      if (!chamado) throw new Error("No chamado");
      const res = await apiRequest("PATCH", `/api/chamados/${chamado.id}`, body);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chamados"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chamados/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chamados", chamado?.id] });
      onUpdate(data);
      toast({ title: "Chamado atualizado!" });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  // Comment mutation
  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!chamado) throw new Error("No chamado");
      const res = await apiRequest("POST", `/api/chamados/${chamado.id}/comentarios`, { comentario: comentarioText });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chamados/${chamado?.id}/comentarios`] });
      setComentarioText("");
    },
    onError: () => toast({ title: "Erro ao comentar", variant: "destructive" }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/chamados/comentarios/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chamados/${chamado?.id}/comentarios`] });
    },
  });

  function assumir() {
    updateMutation.mutate({
      status: "em_andamento",
      responsavel_id: user?.googleId || user?.id,
      responsavel_nome: user?.name,
      responsavel_email: user?.email,
    });
  }

  if (!ch) {
    return (
      <Sheet open={open} onOpenChange={() => onClose()}>
        <SheetContent className="w-full sm:max-w-[520px] p-0 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <SheetHeader className="p-5"><SheetTitle>Carregando...</SheetTitle></SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const st = STATUS_CONFIG[ch.status] || STATUS_CONFIG.aberto;
  const prio = getPrioridadeConfig(ch.prioridade);

  // Status transitions
  const transitions: { label: string; status: string; icon: React.ReactNode; show: boolean }[] = [
    { label: "Mover para Triagem", status: "triagem", icon: <ArrowRight className="w-3.5 h-3.5" />, show: ch.status === "aberto" && (isAdmin || !isSolicitante) },
    { label: "Assumir Chamado", status: "em_andamento", icon: <User className="w-3.5 h-3.5" />, show: ch.status === "triagem" && (isAdmin || !isSolicitante) },
    { label: "Marcar Resolvido", status: "resolvido", icon: <CheckCircle2 className="w-3.5 h-3.5" />, show: ch.status === "em_andamento" && (isResponsavel || isAdmin) },
    { label: "Fechar Chamado", status: "fechado", icon: <CheckCircle2 className="w-3.5 h-3.5" />, show: ch.status === "resolvido" && (isSolicitante || isAdmin) },
    { label: "Reabrir", status: "em_andamento", icon: <RotateCcw className="w-3.5 h-3.5" />, show: ch.status === "resolvido" && (isSolicitante || isAdmin) },
  ];

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-[520px] p-0 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 flex flex-col">
        <SheetHeader className="p-5 pb-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${st.color}`}>{st.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${prio.color}`}>{prio.label}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">{getAreaLabel(ch.area)}</span>
            {ch.categoria && <span className="text-xs text-gray-400 dark:text-zinc-500">· {ch.categoria}</span>}
          </div>
          <SheetTitle className="text-lg text-gray-900 dark:text-white text-left">{ch.titulo}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-5">
          <div className="space-y-5 pb-4">
            {/* Description */}
            <div className="mt-4">
              <p className="text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap">{ch.descricao}</p>
            </div>

            <Separator className="dark:bg-zinc-800" />

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 dark:text-zinc-500">Solicitante</p>
                <p className="text-gray-900 dark:text-white font-medium">{ch.solicitante_nome}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500">{ch.solicitante_email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-zinc-500">Responsável</p>
                {ch.responsavel_nome ? (
                  <>
                    <p className="text-gray-900 dark:text-white font-medium">{ch.responsavel_nome}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{ch.responsavel_email}</p>
                  </>
                ) : (
                  <p className="text-gray-400 dark:text-zinc-500 italic">Não atribuído</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-zinc-500">Criado em</p>
                <p className="text-gray-700 dark:text-zinc-300">{timeAgo(ch.criado_em)}</p>
              </div>
              {ch.resolvido_em && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">Resolvido em</p>
                  <p className="text-gray-700 dark:text-zinc-300">{timeAgo(ch.resolvido_em)}</p>
                </div>
              )}
            </div>

            {ch.cliente_nome && (
              <div className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-zinc-700 p-3 bg-gray-50 dark:bg-zinc-800/50">
                <Building2 className="w-4 h-4 text-gray-400 dark:text-zinc-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ch.cliente_nome}</p>
                  {ch.cliente_cnpj && <p className="text-xs text-gray-400 dark:text-zinc-500">CNPJ: {ch.cliente_cnpj}</p>}
                </div>
              </div>
            )}

            {/* Actions */}
            {transitions.some((t) => t.show) && (
              <>
                <Separator className="dark:bg-zinc-800" />
                <div className="flex flex-wrap gap-2">
                  {ch.status === "triagem" && !ch.responsavel_id && (isAdmin || !isSolicitante) && (
                    <Button size="sm" variant="default" onClick={assumir} className="gap-1.5 text-xs">
                      <User className="w-3.5 h-3.5" /> Assumir Chamado
                    </Button>
                  )}
                  {transitions.filter((t) => t.show && !(t.status === "em_andamento" && ch.status === "triagem")).map((t) => (
                    <Button
                      key={t.status + t.label}
                      size="sm"
                      variant={t.status === "resolvido" || t.status === "fechado" ? "default" : "outline"}
                      onClick={() => updateMutation.mutate({ status: t.status })}
                      className="gap-1.5 text-xs"
                      disabled={updateMutation.isPending}
                    >
                      {t.icon} {t.label}
                    </Button>
                  ))}
                </div>
              </>
            )}

            <Separator className="dark:bg-zinc-800" />

            {/* Comments Thread */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Comentários ({comentarios.length})
              </h3>
              <div className="space-y-3">
                {comentarios.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-700/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{c.autor_nome}</span>
                        <span className="text-[10px] text-gray-400 dark:text-zinc-500">{timeAgo(c.criado_em)}</span>
                      </div>
                      {(c.autor_email === user?.email || isAdmin) && (
                        <button
                          onClick={() => deleteCommentMutation.mutate(c.id)}
                          className="text-gray-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-zinc-400 whitespace-pre-wrap">{c.comentario}</p>
                  </div>
                ))}
                {comentarios.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-4">Nenhum comentário ainda</p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Comment Input */}
        {ch.status !== "fechado" && (
          <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex gap-2">
              <Input
                value={comentarioText}
                onChange={(e) => setComentarioText(e.target.value)}
                placeholder="Escreva um comentário..."
                className="flex-1 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && comentarioText.trim()) { e.preventDefault(); commentMutation.mutate(); } }}
              />
              <Button
                size="icon"
                onClick={() => commentMutation.mutate()}
                disabled={!comentarioText.trim() || commentMutation.isPending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
