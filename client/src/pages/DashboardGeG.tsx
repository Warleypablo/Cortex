import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDecimal } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, TrendingUp, TrendingDown, UserPlus, UserMinus, Clock, Cake, Award, Gift, Calendar, AlertTriangle, PieChart as PieChartIcon, BarChart2, Building, DollarSign, Wallet, Filter, Info, X, MapPin, Heart, Activity, ShieldCheck, Eye, CheckCircle, XCircle, ExternalLink, Loader2, CalendarDays, User } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ComposedChart } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UnavailabilityRequestGG {
  id: number;
  colaborador_id: number;
  colaborador_nome: string;
  colaborador_email: string | null;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
  status: 'pendente' | 'aprovado' | 'reprovado';
  aprovador_nome: string | null;
  data_aprovacao: string | null;
  observacao_aprovador: string | null;
  data_admissao: string | null;
  meses_empresa: number | null;
  created_at: string;
}

type AlertType = 'veterano' | 'experiencia' | 'salario';
interface SelectedAlert {
  type: AlertType;
  id: number;
  nome: string;
  cargo: string | null;
  squad: string | null;
  detail: string;
  extra?: string;
  salario?: number;
  setor?: string | null;
  nivel?: string | null;
  admissao?: string | null;
  mediaCargo?: number;
  mesesDeTurbo?: number;
}

interface SalarioPorCargo {
  cargo: string;
  salarioMedio: number;
  total: number;
}

interface SalarioPorSquad {
  squad: string;
  salarioMedio: number;
  total: number;
}

type HealthCategory = 'saudavel' | 'atencao' | 'critico';
interface ColaboradorSaude {
  id: number;
  nome: string;
  cargo: string | null;
  squad: string | null;
  reasons: string[];
}
interface ColaboradoresPorSaude {
  saudavel: ColaboradorSaude[];
  atencao: ColaboradorSaude[];
  critico: ColaboradorSaude[];
}

interface ChartFilter {
  tipo: 'modalidade' | 'cidade' | 'estado' | 'squad' | 'cargo' | 'nivel';
  valor: string;
  label: string;
}

interface ColaboradorFiltrado {
  id: number;
  nome: string;
  cargo: string | null;
  squad: string | null;
}

type DetailType = 'demissao' | 'maContratacao' | 'salarioTempo';
interface SelectedColaboradorDetail {
  type: DetailType;
  id: number;
  nome: string;
  cargo: string | null;
  squad: string | null;
  setor?: string | null;
  admissao?: string | null;
  demissao?: string | null;
  tempoDeEmpresa?: number;
  diasAteDesligamento?: number;
  salario?: number;
  nivel?: string | null;
  tipoDesligamento?: string | null;
}

type PeriodoPreset = "mesAtual" | "trimestre" | "semestre" | "ano";

interface PeriodoState {
  preset: PeriodoPreset;
}

const PERIODO_PRESETS: { value: PeriodoPreset; label: string }[] = [
  { value: "mesAtual", label: "Mês Atual" },
  { value: "trimestre", label: "Trimestre" },
  { value: "semestre", label: "Semestre" },
  { value: "ano", label: "Ano" },
];

// Lista de Squads com emojis - consistente com a seção "Distribuição por Squad"
const SQUAD_OPTIONS: { value: string; label: string }[] = [
  { value: "Vendas", label: "💰 Vendas" },
  { value: "Selva", label: "🪖 Selva" },
  { value: "Squadra", label: "⚓️ Squadra" },
  { value: "Pulse", label: "💠 Pulse" },
  { value: "Squad X", label: "👾 Squad X" },
  { value: "Tech", label: "🖥️ Tech" },
  { value: "CX&CS", label: "📊 CX&CS" },
  { value: "Turbo Interno", label: "🚀 Turbo Interno" },
  { value: "Ventures", label: "⭐️ Ventures" },
  { value: "Makers", label: "🛠️ Makers" },
  { value: "Chama", label: "🔥 Chama (OFF)" },
  { value: "Hunters", label: "🏹 Hunters (OFF)" },
  { value: "Fragmentados", label: "🧩 Fragmentados (OFF)" },
];

function getPeriodoParaQuery(periodoState: PeriodoState): string {
  switch (periodoState.preset) {
    case "mesAtual":
      return "mes";
    case "trimestre":
      return "trimestre";
    case "semestre":
      return "semestre";
    case "ano":
      return "ano";
    default:
      return "trimestre";
  }
}

interface GegMetricas {
  headcount: number;
  turnover: number;
  admissoes: number;
  demissoes: number;
  tempoMedioAtivo: number;
}

interface EvolucaoHeadcount {
  mes: string;
  headcount: number;
  admissoes: number;
  demissoes: number;
}

interface AdmissoesDemissoes {
  mes: string;
  admissoes: number;
  demissoes: number;
}

interface Distribuicao {
  nome: string;
  total: number;
}

interface Aniversariante {
  id: number;
  nome: string;
  aniversario: string;
  cargo: string | null;
  squad: string | null;
  diaAniversario: number;
}

interface AniversarioEmpresa {
  id: number;
  nome: string;
  admissao: string;
  cargo: string | null;
  squad: string | null;
  anosDeEmpresa: number;
  diasAteAniversario: number;
}

interface NivelOption {
  original: string;
  display: string;
}

interface Filtros {
  squads: string[];
  setores: string[];
  niveis: NivelOption[];
  cargos: string[];
}

interface ValorMedioSalario {
  valorMedio: number;
  totalColaboradores: number;
}

interface CustoFolha {
  custoTotal: number;
  totalColaboradores: number;
}

interface GegValorBeneficio {
  valorTotal: number;
  totalColaboradores: number;
}

interface GegValorPremiacao {
  valorTotal: number;
}

interface UltimaPromocao {
  id: number;
  nome: string;
  cargo: string | null;
  nivel: string | null;
  squad: string | null;
  setor: string | null;
  ultimoAumento: string;
  mesesUltAumento: number;
}

interface TempoPermanencia {
  tempoMedioAtivos: number;
  tempoMedioDesligados: number;
}

interface MasContratacaoColaborador {
  id: number;
  nome: string;
  setor: string | null;
  squad: string | null;
  admissao: string;
  demissao: string;
  diasAteDesligamento: number;
}

interface MasContratacoes {
  total: number;
  colaboradores: MasContratacaoColaborador[];
}

interface PessoasPorSetor {
  setor: string;
  total: number;
}

interface DemissoesPorTipo {
  tipo: string;
  total: number;
  percentual: number;
}

interface UltimaDemissao {
  id: number;
  nome: string;
  cargo: string | null;
  squad: string | null;
  dataDesligamento: string;
  tempoDeEmpresa: number;
}

interface CustoPorSetor {
  setor: string;
  custoTotal: number;
  totalColaboradores: number;
}

interface HeadcountPorTenure {
  faixa: string;
  total: number;
  ordem: number;
}

interface SalarioByTempo {
  [key: string]: { total: number; count: number; avg: number };
}

interface DistribuicaoGeografica {
  byEstado: { estado: string; total: number }[];
  byCidade: { cidade: string; total: number }[];
  grandeVitoria: { cidade: string; total: number }[];
  modalidade: { presencial: number; remoto: number; total: number };
}

interface GegAlertas {
  veteranosSemAumento: { id: number; nome: string; cargo: string | null; squad: string | null; mesesDeTurbo: number; mesesUltAumento: number | null; salario: number; setor: string | null; nivel: string | null; admissao: string | null }[];
  fimExperiencia: { id: number; nome: string; cargo: string | null; squad: string | null; admissao: string; diasRestantes: number; salario: number; setor: string | null; nivel: string | null }[];
  salarioAbaixoMedia: { id: number; nome: string; cargo: string | null; squad: string | null; salario: number; mediaCargo: number; diferenca: string; setor: string | null; nivel: string | null; admissao: string | null; mesesDeTurbo: number }[];
  totalAlertas: number;
}

interface RetencaoSaude {
  taxaRetencao: number;
  ativosInicio: number;
  ativosAtual: number;
  demitidosPeriodo: number;
  healthDistribution: { saudavel: number; atencao: number; critico: number };
  periodo: string;
}

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', 
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#22c55e'
];

const CHART_GRADIENTS = {
  primary: { start: '#3b82f6', end: '#1d4ed8' },
  success: { start: '#10b981', end: '#059669' },
  error: { start: '#ef4444', end: '#dc2626' },
  warning: { start: '#f59e0b', end: '#d97706' },
  purple: { start: '#8b5cf6', end: '#7c3aed' },
  cyan: { start: '#0ea5e9', end: '#0284c7' },
};

function UnavailabilityApprovalSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<UnavailabilityRequestGG | null>(null);
  const [actionType, setActionType] = useState<'aprovar' | 'reprovar' | null>(null);
  const [observacao, setObservacao] = useState('');
  const [activeTab, setActiveTab] = useState('calendario');

  const { data: pendingRequests = [], isLoading: isLoadingPending, refetch: refetchPending } = useQuery<UnavailabilityRequestGG[]>({
    queryKey: ["/api/unavailability-requests", { status: "pendente" }],
  });

  const { data: approvedRequests = [], isLoading: isLoadingApproved } = useQuery<UnavailabilityRequestGG[]>({
    queryKey: ["/api/unavailability-requests", { status: "aprovado" }],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; status: string; aprovadorEmail?: string; aprovadorNome?: string; observacaoAprovador?: string }) => {
      return await apiRequest("PATCH", `/api/unavailability-requests/${data.id}`, data);
    },
    onSuccess: () => {
      toast({ 
        title: actionType === 'aprovar' ? "Solicitação alinhada" : "Solicitação não alinhada",
        description: `A solicitação foi ${actionType === 'aprovar' ? 'alinhada' : 'marcada como não alinhada'} com sucesso.`,
      });
      setSelectedRequest(null);
      setActionType(null);
      setObservacao('');
      queryClient.invalidateQueries({ queryKey: ["/api/unavailability-requests"] });
      refetchPending();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleAction = (req: UnavailabilityRequestGG, action: 'aprovar' | 'reprovar') => {
    setSelectedRequest(req);
    setActionType(action);
    setObservacao('');
  };

  const handleConfirm = () => {
    if (!selectedRequest || !actionType) return;
    
    updateMutation.mutate({
      id: selectedRequest.id,
      status: actionType === 'aprovar' ? 'aprovado' : 'reprovado',
      aprovadorEmail: user?.email || undefined,
      aprovadorNome: user?.name || undefined,
      observacaoAprovador: observacao || undefined,
    });
  };

  const formatTempoEmpresa = (meses: number | null) => {
    if (meses === null) return 'N/A';
    if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    const anos = Math.floor(meses / 12);
    const mesesRestantes = meses % 12;
    if (mesesRestantes === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
    return `${anos}a ${mesesRestantes}m`;
  };

  const groupedByMonth = approvedRequests.reduce((acc, req) => {
    const monthKey = format(new Date(req.data_inicio), "MMMM yyyy", { locale: ptBR });
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(req);
    return acc;
  }, {} as Record<string, UnavailabilityRequestGG[]>);

  return (
    <>
      <Card className="mb-6 border-orange-200 dark:border-orange-800" data-testid="card-unavailability-approvals">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Calendário de Indisponibilidade</CardTitle>
                <CardDescription>Visualizar e alinhar períodos de indisponibilidade dos prestadores</CardDescription>
              </div>
            </div>
            {pendingRequests.length > 0 && (
              <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300">
                {pendingRequests.length} pendente{pendingRequests.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="calendario" className="gap-2" data-testid="tab-calendario">
                <CalendarDays className="w-4 h-4" />
                Calendário
              </TabsTrigger>
              <TabsTrigger value="pendentes" className="gap-2" data-testid="tab-pendentes">
                <Clock className="w-4 h-4" />
                Pendentes
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendario">
              {isLoadingApproved ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : approvedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma indisponibilidade alinhada registrada.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedByMonth).map(([month, requests]) => (
                    <div key={month}>
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        {month}
                      </h3>
                      <div className="grid gap-3">
                        {requests.map((req) => (
                          <div 
                            key={req.id} 
                            className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                            data-testid={`calendar-item-${req.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
                                <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <p className="font-medium">{req.colaborador_nome}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(req.data_inicio), "dd/MM", { locale: ptBR })} - {format(new Date(req.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300">
                                Alinhado
                              </Badge>
                              {req.motivo && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate">{req.motivo}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pendentes">
              {isLoadingPending ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma solicitação pendente de alinhamento.</p>
                </div>
              ) : (
                <Table data-testid="table-unavailability-approvals">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Tempo de Empresa</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Solicitado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((req) => (
                      <TableRow key={req.id} data-testid={`row-approval-${req.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <span className="font-medium">{req.colaborador_nome}</span>
                              {req.colaborador_email && (
                                <p className="text-xs text-muted-foreground">{req.colaborador_email}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-muted-foreground" />
                            <span>
                              {format(new Date(req.data_inicio), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(req.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300">
                            {formatTempoEmpresa(req.meses_empresa)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{req.motivo || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(req.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-green-600"
                              onClick={() => handleAction(req, 'aprovar')}
                              data-testid={`button-alinhar-${req.id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                              Alinhar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-red-600"
                              onClick={() => handleAction(req, 'reprovar')}
                              data-testid={`button-nao-alinhar-${req.id}`}
                            >
                              <XCircle className="w-4 h-4" />
                              Não Alinhar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => { setSelectedRequest(null); setActionType(null); }}>
        <DialogContent data-testid="dialog-confirm-action">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'aprovar' ? 'Alinhar' : 'Não Alinhar'} Solicitação
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  <strong>{selectedRequest.colaborador_nome}</strong> solicitou indisponibilidade de{' '}
                  <strong>{format(new Date(selectedRequest.data_inicio), "dd/MM/yyyy", { locale: ptBR })}</strong>{' '}
                  a <strong>{format(new Date(selectedRequest.data_fim), "dd/MM/yyyy", { locale: ptBR })}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium mb-2 block">Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder={actionType === 'aprovar' ? 'Alinhado conforme solicitado...' : 'Motivo do não alinhamento...'}
              rows={3}
              data-testid="input-observacao-aprovador"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedRequest(null); setActionType(null); }} data-testid="button-cancelar-dialog">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={updateMutation.isPending}
              className={actionType === 'aprovar' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              data-testid="button-confirmar-acao"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmar {actionType === 'aprovar' ? 'Alinhamento' : 'Não Alinhamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DashboardGeG() {
  usePageTitle("G&G");
  useSetPageInfo("Dashboard GEG", "Gestão Estratégica de Pessoas");
  
  const [periodoState, setPeriodoState] = useState<PeriodoState>({ preset: "trimestre" });
  const [squad, setSquad] = useState("todos");
  const [setor, setSetor] = useState("todos");
  const [nivel, setNivel] = useState("todos");
  const [cargo, setCargo] = useState("todos");
  const [diasExperiencia, setDiasExperiencia] = useState(30);
  const [selectedAlert, setSelectedAlert] = useState<SelectedAlert | null>(null);
  const [selectedColaboradorDetail, setSelectedColaboradorDetail] = useState<SelectedColaboradorDetail | null>(null);
  const [ignoredAlerts, setIgnoredAlerts] = useState<string[]>([]);
  const [selectedHealthCategory, setSelectedHealthCategory] = useState<HealthCategory | null>(null);
  const [selectedChartFilter, setSelectedChartFilter] = useState<ChartFilter | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('geg-ignored-alerts');
    if (stored) {
      try {
        setIgnoredAlerts(JSON.parse(stored));
      } catch { }
    }
  }, []);

  const ignoreAlert = (type: AlertType, id: number) => {
    const key = `${type}-${id}`;
    const updated = [...ignoredAlerts, key];
    setIgnoredAlerts(updated);
    localStorage.setItem('geg-ignored-alerts', JSON.stringify(updated));
    setSelectedAlert(null);
  };

  const isIgnored = (type: AlertType, id: number) => ignoredAlerts.includes(`${type}-${id}`);

  const clearIgnored = () => {
    setIgnoredAlerts([]);
    localStorage.removeItem('geg-ignored-alerts');
  };

  const periodo = getPeriodoParaQuery(periodoState);

  const { data: metricas, isLoading: isLoadingMetricas } = useQuery<GegMetricas>({
    queryKey: ['/api/geg/metricas', { periodo, squad, setor, nivel, cargo }],
  });

  const { data: evolucaoHeadcount, isLoading: isLoadingEvolucao } = useQuery<EvolucaoHeadcount[]>({
    queryKey: ['/api/geg/evolucao-headcount', { periodo, squad, setor, nivel, cargo }],
  });

  const { data: admissoesDemissoes, isLoading: isLoadingAdmissoesDemissoes } = useQuery<AdmissoesDemissoes[]>({
    queryKey: ['/api/geg/admissoes-demissoes', { periodo, squad, setor, nivel, cargo }],
  });

  const { data: aniversariantesMes, isLoading: isLoadingAniversariantes } = useQuery<Aniversariante[]>({
    queryKey: ['/api/geg/aniversariantes-mes', { squad, setor, nivel, cargo }],
  });

  const { data: aniversariosEmpresa, isLoading: isLoadingAniversariosEmpresa } = useQuery<AniversarioEmpresa[]>({
    queryKey: ['/api/geg/aniversarios-empresa', { squad, setor, nivel, cargo }],
  });

  const { data: filtros } = useQuery<Filtros>({
    queryKey: ['/api/geg/filtros'],
  });

  const { data: valorMedioSalario, isLoading: isLoadingValorMedio } = useQuery<ValorMedioSalario>({
    queryKey: ['/api/geg/valor-medio-salario', { squad, setor, nivel, cargo }],
  });

  const { data: custoFolha, isLoading: isLoadingCustoFolha } = useQuery<CustoFolha>({
    queryKey: ['/api/geg/custo-folha', { squad, setor, nivel, cargo }],
  });

  const { data: valorBeneficio, isLoading: isLoadingValorBeneficio } = useQuery<GegValorBeneficio>({
    queryKey: ['/api/geg/valor-beneficio', { squad, setor, nivel, cargo }],
  });

  const { data: valorPremiacao, isLoading: isLoadingValorPremiacao } = useQuery<GegValorPremiacao>({
    queryKey: ['/api/geg/valor-premiacao', { squad, setor, nivel, cargo }],
  });

  const { data: ultimasPromocoes, isLoading: isLoadingPromocoes } = useQuery<UltimaPromocao[]>({
    queryKey: ['/api/geg/ultimas-promocoes', { squad, setor, nivel, cargo, limit: 10 }],
  });

  const { data: tempoPermanencia, isLoading: isLoadingTempoPermanencia } = useQuery<TempoPermanencia>({
    queryKey: ['/api/geg/tempo-permanencia', { squad, setor, nivel, cargo }],
  });

  const { data: masContratacoes, isLoading: isLoadingMasContratacoes } = useQuery<MasContratacoes>({
    queryKey: ['/api/geg/mas-contratacoes', { squad, setor, nivel, cargo }],
  });

  const { data: pessoasPorSetor, isLoading: isLoadingPessoasPorSetor } = useQuery<PessoasPorSetor[]>({
    queryKey: ['/api/geg/pessoas-por-setor', { squad, setor, nivel, cargo }],
  });

  const { data: demissoesPorTipo, isLoading: isLoadingDemissoesPorTipo } = useQuery<DemissoesPorTipo[]>({
    queryKey: ['/api/geg/demissoes-por-tipo', { squad, setor, nivel, cargo }],
  });

  const { data: ultimasDemissoes, isLoading: isLoadingUltimasDemissoes } = useQuery<UltimaDemissao[]>({
    queryKey: ['/api/geg/ultimas-demissoes', { squad, setor, nivel, cargo, limit: 10 }],
  });

  const { data: custoPorSetor, isLoading: isLoadingCustoPorSetor } = useQuery<CustoPorSetor[]>({
    queryKey: ['/api/geg/custo-por-setor', { squad, setor, nivel, cargo }],
  });

  const { data: headcountPorTenure, isLoading: isLoadingHeadcountPorTenure } = useQuery<HeadcountPorTenure[]>({
    queryKey: ['/api/geg/headcount-por-tenure', { squad, setor, nivel, cargo }],
  });

  const { data: salarioByTempo, isLoading: isLoadingSalarioByTempo } = useQuery<{ salarioByTempo: SalarioByTempo }>({
    queryKey: ['/api/colaboradores/analise-geral'],
    select: (data: any) => ({ salarioByTempo: data.salarioByTempo }),
  });

  const { data: colaboradoresPorSquad, isLoading: isLoadingColaboradoresPorSquad } = useQuery<Distribuicao[]>({
    queryKey: ['/api/geg/colaboradores-por-squad', { squad, setor, nivel, cargo }],
  });

  const { data: colaboradoresPorCargo, isLoading: isLoadingColaboradoresPorCargo } = useQuery<Distribuicao[]>({
    queryKey: ['/api/geg/colaboradores-por-cargo', { squad, setor, nivel, cargo }],
  });

  const { data: colaboradoresPorNivel, isLoading: isLoadingColaboradoresPorNivel } = useQuery<Distribuicao[]>({
    queryKey: ['/api/geg/colaboradores-por-nivel', { squad, setor, nivel, cargo }],
  });

  const { data: salarioPorCargo, isLoading: isLoadingSalarioPorCargo } = useQuery<SalarioPorCargo[]>({
    queryKey: ['/api/geg/salario-por-cargo', { squad, setor, nivel, cargo }],
  });

  const { data: salarioPorSquad, isLoading: isLoadingSalarioPorSquad } = useQuery<SalarioPorSquad[]>({
    queryKey: ['/api/geg/salario-por-squad', { squad, setor, nivel, cargo }],
  });

  const { data: distribuicaoGeografica, isLoading: isLoadingDistribuicaoGeografica } = useQuery<DistribuicaoGeografica>({
    queryKey: ['/api/geg/distribuicao-geografica', { squad, setor, nivel, cargo }],
  });

  const { data: alertas, isLoading: isLoadingAlertas } = useQuery<GegAlertas>({
    queryKey: ['/api/geg/alertas', { squad, setor, nivel, cargo, diasExperiencia: String(diasExperiencia) }],
  });

  const { data: retencaoSaude, isLoading: isLoadingRetencaoSaude } = useQuery<RetencaoSaude>({
    queryKey: ['/api/geg/retencao-saude', { periodo, squad, setor, nivel, cargo }],
  });

  const { data: colaboradoresPorSaude, isLoading: isLoadingColaboradoresPorSaude } = useQuery<ColaboradoresPorSaude>({
    queryKey: ['/api/geg/colaboradores-por-saude'],
    enabled: selectedHealthCategory !== null,
  });

  const { data: colaboradoresFiltrados, isLoading: isLoadingColaboradoresFiltrados } = useQuery<ColaboradorFiltrado[]>({
    queryKey: ['/api/geg/colaboradores-por-filtro', { tipo: selectedChartFilter?.tipo, valor: selectedChartFilter?.valor }],
    enabled: selectedChartFilter !== null,
  });

  const handleChartClick = (tipo: ChartFilter['tipo'], valor: string, label: string) => {
    setSelectedChartFilter({ tipo, valor, label });
  };

  const formatMesAno = (mesAno: string) => {
    const [ano, mes] = mesAno.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(mes) - 1]}/${ano.slice(2)}`;
  };

  const formatData = (data: string) => {
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const receitaPorColaborador = metricas?.headcount && custoFolha?.custoTotal 
    ? custoFolha.custoTotal / metricas.headcount 
    : 0;

  const handlePeriodoPresetChange = (preset: PeriodoPreset) => {
    setPeriodoState({ preset });
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card className="mb-6" data-testid="card-filtros">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-filtros">
                      <Filter className="w-4 h-4" />
                      <span>Filtros</span>
                      {(squad !== "todos" || setor !== "todos" || nivel !== "todos" || cargo !== "todos") && (
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                          {[squad !== "todos", setor !== "todos", nivel !== "todos", cargo !== "todos"].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Filtros</h4>
                        {(squad !== "todos" || setor !== "todos" || nivel !== "todos" || cargo !== "todos") && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => {
                              setSquad("todos");
                              setSetor("todos");
                              setNivel("todos");
                              setCargo("todos");
                            }}
                            data-testid="button-limpar-filtros"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Limpar
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Squad</Label>
                          <Select value={squad} onValueChange={setSquad}>
                            <SelectTrigger className="w-full" data-testid="select-squad">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos</SelectItem>
                              {SQUAD_OPTIONS.map(({ value, label }) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Setor</Label>
                          <Select value={setor} onValueChange={setSetor}>
                            <SelectTrigger className="w-full" data-testid="select-setor">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos</SelectItem>
                              {filtros?.setores.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Nível</Label>
                          <Select value={nivel} onValueChange={setNivel}>
                            <SelectTrigger className="w-full" data-testid="select-nivel">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos</SelectItem>
                              {filtros?.niveis.map((n) => (
                                <SelectItem key={n.original} value={n.original}>{n.display}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Cargo</Label>
                          <Select value={cargo} onValueChange={setCargo}>
                            <SelectTrigger className="w-full" data-testid="select-cargo">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos</SelectItem>
                              {filtros?.cargos.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex flex-wrap gap-1.5">
                {PERIODO_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={periodoState.preset === preset.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodoPresetChange(preset.value)}
                    data-testid={`button-periodo-${preset.value}`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seção Aprovação de Indisponibilidade */}
        <UnavailabilityApprovalSection />

        {/* Seção Métricas Principais */}
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <Users className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Métricas Principais</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <Card data-testid="card-headcount">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Headcount</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Total de colaboradores com status ativo no período selecionado</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-headcount">{metricas?.headcount || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-turnover">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Turnover</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Taxa de rotatividade calculada como (Demissões / Headcount Médio) × 100</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-turnover">{metricas?.turnover || 0}%</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-contratados">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Contratados</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Número de novas contratações no período selecionado</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <UserPlus className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-green-600" data-testid="text-contratados">{metricas?.admissoes || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-demissoes">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Demissões</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Número de desligamentos no período selecionado</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <UserMinus className="w-4 h-4 text-red-600" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-red-600" data-testid="text-demissoes">{metricas?.demissoes || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-crescimento">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Crescimento</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Saldo entre contratados e desligados no período</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              {((metricas?.admissoes || 0) - (metricas?.demissoes || 0)) >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`text-2xl font-bold ${((metricas?.admissoes || 0) - (metricas?.demissoes || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-crescimento">
                  {((metricas?.admissoes || 0) - (metricas?.demissoes || 0)) >= 0 ? '+' : ''}{(metricas?.admissoes || 0) - (metricas?.demissoes || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-tempo-medio">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Permanência</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Tempo médio em meses que colaboradores ativos estão na empresa</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingTempoPermanencia ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-tempo-ativos">
                  {tempoPermanencia?.tempoMedioAtivos ? formatDecimal(tempoPermanencia.tempoMedioAtivos) : '0'}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-tempo-desligados">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Perm. Desligados</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Tempo médio em meses que colaboradores desligados ficaram na empresa</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <UserMinus className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              {isLoadingTempoPermanencia ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-red-600" data-testid="text-tempo-desligados">
                  {tempoPermanencia?.tempoMedioDesligados ? formatDecimal(tempoPermanencia.tempoMedioDesligados) : '0'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card data-testid="card-custo-folha">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Custo Folha</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Soma total dos salários de todos os colaboradores ativos</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <Wallet className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingCustoFolha ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-custo-folha">
                    R$ {formatCurrency(custoFolha?.custoTotal || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metricas?.headcount || 0} colaboradores ativos
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-valor-beneficio">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Valor Benefício</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Soma total dos benefícios (Caju) de todos os colaboradores ativos</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <Gift className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingValorBeneficio ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-valor-beneficio">
                    R$ {formatCurrency(valorBeneficio?.valorTotal || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metricas?.headcount || 0} colaboradores
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-valor-premiacao">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Valor Premiação</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Soma total das premiações pagas aos colaboradores (categorias 05.01.10 e 06.10.08)</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <Award className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingValorPremiacao ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-valor-premiacao">
                    R$ {formatCurrency(valorPremiacao?.valorTotal || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Categorias 05.01.10 e 06.10.08
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-valor-medio">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Salário Médio</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Média salarial dos colaboradores ativos</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingValorMedio ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-valor-medio">
                    R$ {formatCurrency(valorMedioSalario?.valorMedio || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Base: {metricas?.headcount || 0} colaboradores
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-salario-bonus">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className="text-sm font-medium">Salário + Bônus</CardTitle>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">Média salarial somada à média de premiações por colaborador</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <Wallet className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {(isLoadingValorMedio || isLoadingValorPremiacao) ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-salario-bonus">
                    R$ {formatCurrency(
                      (valorMedioSalario?.valorMedio || 0) + 
                      (valorMedioSalario?.totalColaboradores && valorMedioSalario.totalColaboradores > 0 
                        ? (valorPremiacao?.valorTotal || 0) / valorMedioSalario.totalColaboradores 
                        : 0)
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Base: {metricas?.headcount || 0} colaboradores
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <Card data-testid="card-evolucao-pessoas">
            <CardHeader>
              <CardTitle>Evolução de Pessoas</CardTitle>
              <CardDescription>Contratados, desligados e headcount mensal</CardDescription>
            </CardHeader>
            <CardContent>
              {(isLoadingEvolucao || isLoadingAdmissoesDemissoes) ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Skeleton className="h-[300px] w-full" />
                </div>
              ) : (() => {
                const combinedData = (admissoesDemissoes || []).map(ad => {
                  const hc = evolucaoHeadcount?.find(e => e.mes === ad.mes);
                  return {
                    mes: ad.mes,
                    admissoes: ad.admissoes,
                    demissoes: ad.demissoes,
                    headcount: hc?.headcount || 0
                  };
                });
                
                return combinedData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={combinedData}>
                      <defs>
                        <linearGradient id="gradientAdmissoes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="gradientDemissoes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                          <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="gradientHeadcount" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={1} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis dataKey="mes" tickFormatter={formatMesAno} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        labelFormatter={formatMesAno} 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar yAxisId="left" dataKey="admissoes" name="Contratados" fill="url(#gradientAdmissoes)" radius={[6, 6, 0, 0]} />
                      <Bar yAxisId="left" dataKey="demissoes" name="Demissões" fill="url(#gradientDemissoes)" radius={[6, 6, 0, 0]} />
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="headcount" 
                        name="Headcount" 
                        stroke="url(#gradientHeadcount)" 
                        strokeWidth={3} 
                        dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 2, fill: '#fff', stroke: '#0ea5e9' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px]" data-testid="text-no-data-evolucao-pessoas">
                    <p className="text-muted-foreground">Nenhum dado disponível</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card data-testid="card-pessoas-por-setor">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-500" />
                <CardTitle>Pessoas por Setor</CardTitle>
              </div>
              <CardDescription>Distribuição por área</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPessoasPorSetor ? (
                <Skeleton className="h-[250px] w-full" />
              ) : pessoasPorSetor && pessoasPorSetor.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={pessoasPorSetor} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="setor" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" name="Colaboradores" radius={[0, 4, 4, 0]}>
                      {pessoasPorSetor.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px]" data-testid="text-no-data-setor">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-custo-por-setor">
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                <CardTitle>Custo por Setor</CardTitle>
              </div>
              <CardDescription>Custos salariais por área</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCustoPorSetor ? (
                <Skeleton className="h-[250px] w-full" />
              ) : custoPorSetor && custoPorSetor.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={custoPorSetor} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <YAxis dataKey="setor" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as CustoPorSetor;
                          return (
                            <div className="bg-popover border rounded-md shadow-md p-2">
                              <p className="font-medium text-sm">{data.setor}</p>
                              <p className="text-xs text-muted-foreground">
                                R$ {formatCurrency(data.custoTotal)} ({data.totalColaboradores} colaboradores)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="custoTotal" name="Custo Total" radius={[0, 4, 4, 0]}>
                      {custoPorSetor.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px]" data-testid="text-no-data-custo-setor">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-headcount-tenure">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-purple-500" />
                <CardTitle>Tempo de Casa</CardTitle>
              </div>
              <CardDescription>Distribuição por faixa de permanência</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHeadcountPorTenure ? (
                <Skeleton className="h-[250px] w-full" />
              ) : headcountPorTenure && headcountPorTenure.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={headcountPorTenure}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="faixa" 
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as HeadcountPorTenure;
                          return (
                            <div className="bg-popover border rounded-md shadow-md p-2">
                              <p className="font-medium text-sm">{data.faixa}</p>
                              <p className="text-xs text-muted-foreground">{data.total} colaboradores</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="total" name="Colaboradores" radius={[4, 4, 0, 0]}>
                      {headcountPorTenure.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px]" data-testid="text-no-data-headcount-tenure">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Seção Alertas e Atenção */}
        {alertas && (
          <div className="mb-6" data-testid="section-alertas">
            {(() => {
              const filteredVeteranos = (alertas.veteranosSemAumento || []).filter(v => !isIgnored('veterano', v.id));
              const filteredExperiencia = (alertas.fimExperiencia || []).filter(f => !isIgnored('experiencia', f.id));
              const filteredSalario = (alertas.salarioAbaixoMedia || []).filter(s => !isIgnored('salario', s.id));
              const totalFiltered = filteredVeteranos.length + filteredExperiencia.length + filteredSalario.length;
              
              return (
                <>
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold">Alertas e Atenção</h2>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                      {totalFiltered} {totalFiltered === 1 ? 'alerta' : 'alertas'}
                    </Badge>
                    {ignoredAlerts.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={clearIgnored} data-testid="btn-limpar-ignorados">
                        <Eye className="w-3 h-3 mr-1" />
                        Mostrar {ignoredAlerts.length} ignorado(s)
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Veteranos sem Aumento */}
                    <Card className="border-amber-500/20" data-testid="card-alerta-veteranos">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <CardTitle className="text-sm font-medium">Veteranos sem Aumento</CardTitle>
                        </div>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                          {filteredVeteranos.length}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-3">12+ meses sem promoção</p>
                        {isLoadingAlertas ? (
                          <div className="space-y-2">
                            {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                          </div>
                        ) : filteredVeteranos.length > 0 ? (
                          <div className="space-y-2 max-h-[320px] overflow-y-auto">
                            {filteredVeteranos.slice(0, 8).map((v) => (
                              <div 
                                key={v.id} 
                                className="flex items-center justify-between p-2 bg-amber-500/5 rounded-lg border border-amber-500/20 cursor-pointer hover-elevate" 
                                data-testid={`alerta-veterano-${v.id}`}
                                onClick={() => setSelectedAlert({
                                  type: 'veterano',
                                  id: v.id,
                                  nome: v.nome,
                                  cargo: v.cargo,
                                  squad: v.squad,
                                  detail: v.mesesUltAumento ? `${v.mesesUltAumento} meses sem aumento` : 'Nunca recebeu aumento',
                                  salario: v.salario,
                                  setor: v.setor,
                                  nivel: v.nivel,
                                  admissao: v.admissao,
                                  mesesDeTurbo: v.mesesDeTurbo
                                })}
                              >
                                <div>
                                  <p className="font-medium text-xs">{v.nome}</p>
                                  <p className="text-[10px] text-muted-foreground">{v.cargo || 'N/A'} - {v.squad || 'N/A'}</p>
                                </div>
                                <Badge variant="outline" className="text-amber-600 text-[10px]">
                                  {v.mesesUltAumento ? `${v.mesesUltAumento}m` : 'Nunca'}
                                </Badge>
                              </div>
                            ))}
                            {filteredVeteranos.length > 8 && (
                              <p className="text-[10px] text-muted-foreground text-center">+{filteredVeteranos.length - 8} outros</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-4">Nenhum alerta</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Fim de Experiência */}
                    <Card className="border-amber-500/20" data-testid="card-alerta-experiencia">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-500" />
                          <CardTitle className="text-sm font-medium">Fim de Experiência</CardTitle>
                        </div>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                          {filteredExperiencia.length}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-1 mb-3">
                          <span className="text-xs text-muted-foreground">Próximos</span>
                          {[30, 60, 90].map((dias) => (
                            <Button
                              key={dias}
                              variant={diasExperiencia === dias ? "default" : "ghost"}
                              size="sm"
                              className="h-5 px-2 text-xs"
                              onClick={() => setDiasExperiencia(dias)}
                              data-testid={`btn-dias-experiencia-${dias}`}
                            >
                              {dias}d
                            </Button>
                          ))}
                        </div>
                        {isLoadingAlertas ? (
                          <div className="space-y-2">
                            {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                          </div>
                        ) : filteredExperiencia.length > 0 ? (
                          <div className="space-y-2 max-h-[320px] overflow-y-auto">
                            {filteredExperiencia.slice(0, 8).map((f) => (
                              <div 
                                key={f.id} 
                                className="flex items-center justify-between p-2 bg-amber-500/5 rounded-lg border border-amber-500/20 cursor-pointer hover-elevate" 
                                data-testid={`alerta-experiencia-${f.id}`}
                                onClick={() => setSelectedAlert({
                                  type: 'experiencia',
                                  id: f.id,
                                  nome: f.nome,
                                  cargo: f.cargo,
                                  squad: f.squad,
                                  detail: `${f.diasRestantes} dias restantes`,
                                  extra: `Admissão: ${f.admissao ? new Date(f.admissao).toLocaleDateString('pt-BR') : 'N/A'}`,
                                  salario: f.salario,
                                  setor: f.setor,
                                  nivel: f.nivel,
                                  admissao: f.admissao
                                })}
                              >
                                <div>
                                  <p className="font-medium text-xs">{f.nome}</p>
                                  <p className="text-[10px] text-muted-foreground">{f.cargo || 'N/A'} - {f.squad || 'N/A'}</p>
                                </div>
                                <Badge variant="outline" className="text-amber-600 text-[10px]">
                                  {f.diasRestantes}d
                                </Badge>
                              </div>
                            ))}
                            {filteredExperiencia.length > 8 && (
                              <p className="text-[10px] text-muted-foreground text-center">+{filteredExperiencia.length - 8} outros</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-4">Nenhum alerta</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Salário Abaixo da Média */}
                    <Card className="border-amber-500/20" data-testid="card-alerta-salario">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-500" />
                          <CardTitle className="text-sm font-medium">Salário Abaixo da Média</CardTitle>
                        </div>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                          {filteredSalario.length}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-3">Abaixo da média do cargo</p>
                        {isLoadingAlertas ? (
                          <div className="space-y-2">
                            {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                          </div>
                        ) : filteredSalario.length > 0 ? (
                          <div className="space-y-2 max-h-[320px] overflow-y-auto">
                            {filteredSalario.slice(0, 8).map((s) => (
                              <div 
                                key={s.id} 
                                className="flex items-center justify-between p-2 bg-amber-500/5 rounded-lg border border-amber-500/20 cursor-pointer hover-elevate" 
                                data-testid={`alerta-salario-${s.id}`}
                                onClick={() => setSelectedAlert({
                                  type: 'salario',
                                  id: s.id,
                                  nome: s.nome,
                                  cargo: s.cargo,
                                  squad: s.squad,
                                  detail: `${s.diferenca}% abaixo da média`,
                                  salario: s.salario,
                                  setor: s.setor,
                                  nivel: s.nivel,
                                  admissao: s.admissao,
                                  mediaCargo: s.mediaCargo,
                                  mesesDeTurbo: s.mesesDeTurbo
                                })}
                              >
                                <div>
                                  <p className="font-medium text-xs">{s.nome}</p>
                                  <p className="text-[10px] text-muted-foreground">{s.cargo || 'N/A'}</p>
                                </div>
                                <Badge variant="outline" className="text-amber-600 text-[10px]">
                                  {s.diferenca}
                                </Badge>
                              </div>
                            ))}
                            {filteredSalario.length > 8 && (
                              <p className="text-[10px] text-muted-foreground text-center">+{filteredSalario.length - 8} outros</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-4">Nenhum alerta</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Dialog de Detalhes do Alerta */}
        <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-alerta-detalhe">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Detalhe do Alerta
              </DialogTitle>
              <DialogDescription>
                {selectedAlert?.type === 'veterano' && 'Colaborador sem aumento salarial há muito tempo'}
                {selectedAlert?.type === 'experiencia' && 'Período de experiência próximo do fim'}
                {selectedAlert?.type === 'salario' && 'Salário abaixo da média do cargo'}
              </DialogDescription>
            </DialogHeader>
            {selectedAlert && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold text-lg">{selectedAlert.nome}</h3>
                  <p className="text-sm text-muted-foreground">{selectedAlert.cargo || 'Cargo não informado'}</p>
                  {selectedAlert.squad && (
                    <p className="text-sm text-muted-foreground">{selectedAlert.squad}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedAlert.salario !== undefined && selectedAlert.salario > 0 && (
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Salário Atual</p>
                      <p className="font-medium">R$ {selectedAlert.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {selectedAlert.setor && (
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Setor</p>
                      <p className="font-medium">{selectedAlert.setor}</p>
                    </div>
                  )}
                  {selectedAlert.nivel && (
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Nível</p>
                      <p className="font-medium">{selectedAlert.nivel}</p>
                    </div>
                  )}
                  {selectedAlert.admissao && (
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Data de Admissão</p>
                      <p className="font-medium">{formatData(selectedAlert.admissao)}</p>
                    </div>
                  )}
                  {selectedAlert.mesesDeTurbo !== undefined && selectedAlert.mesesDeTurbo > 0 && (
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Tempo na Turbo</p>
                      <p className="font-medium">
                        {selectedAlert.mesesDeTurbo >= 12
                          ? `${Math.floor(selectedAlert.mesesDeTurbo / 12)} ${Math.floor(selectedAlert.mesesDeTurbo / 12) === 1 ? 'ano' : 'anos'}${selectedAlert.mesesDeTurbo % 12 > 0 ? ` e ${selectedAlert.mesesDeTurbo % 12} ${selectedAlert.mesesDeTurbo % 12 === 1 ? 'mês' : 'meses'}` : ''}`
                          : `${selectedAlert.mesesDeTurbo} ${selectedAlert.mesesDeTurbo === 1 ? 'mês' : 'meses'}`}
                      </p>
                    </div>
                  )}
                  {selectedAlert.type === 'salario' && selectedAlert.mediaCargo && (
                    <div className="p-2 bg-muted/50 rounded col-span-2">
                      <p className="text-xs text-muted-foreground">Média do Cargo</p>
                      <p className="font-medium">R$ {selectedAlert.mediaCargo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-amber-700 dark:text-amber-400">{selectedAlert.detail}</p>
                      {selectedAlert.extra && (
                        <p className="text-xs text-muted-foreground mt-1">{selectedAlert.extra}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" asChild className="flex-1" data-testid="btn-ver-perfil">
                <Link href={`/colaboradores/${selectedAlert?.id}`}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver Perfil
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex-1 text-muted-foreground"
                onClick={() => selectedAlert && ignoreAlert(selectedAlert.type, selectedAlert.id)}
                data-testid="btn-ignorar-alerta"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Ignorar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Detalhe do Colaborador (Demissão/Má Contratação) */}
        <Dialog open={!!selectedColaboradorDetail} onOpenChange={(open) => !open && setSelectedColaboradorDetail(null)}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-colaborador-detalhe">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedColaboradorDetail?.type === 'demissao' && <UserMinus className="w-5 h-5 text-red-500" />}
                {selectedColaboradorDetail?.type === 'maContratacao' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                {selectedColaboradorDetail?.type === 'demissao' ? 'Detalhes da Demissão' : 'Má Contratação'}
              </DialogTitle>
              <DialogDescription>
                {selectedColaboradorDetail?.type === 'demissao' && 'Informações sobre o desligamento'}
                {selectedColaboradorDetail?.type === 'maContratacao' && 'Colaborador desligado em menos de 90 dias'}
              </DialogDescription>
            </DialogHeader>
            {selectedColaboradorDetail && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold text-lg">{selectedColaboradorDetail.nome}</h3>
                  {selectedColaboradorDetail.cargo && (
                    <p className="text-sm text-muted-foreground">{selectedColaboradorDetail.cargo}</p>
                  )}
                  {selectedColaboradorDetail.squad && (
                    <p className="text-sm text-muted-foreground">{selectedColaboradorDetail.squad}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedColaboradorDetail.setor && (
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Setor</p>
                      <p className="font-medium">{selectedColaboradorDetail.setor}</p>
                    </div>
                  )}
                  {selectedColaboradorDetail.demissao && (
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Data Desligamento</p>
                      <p className="font-medium">{new Date(selectedColaboradorDetail.demissao).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                  {selectedColaboradorDetail.tempoDeEmpresa !== undefined && (
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Tempo de Empresa</p>
                      <p className="font-medium">
                        {selectedColaboradorDetail.tempoDeEmpresa < 1 
                          ? 'Menos de 1 mês' 
                          : `${selectedColaboradorDetail.tempoDeEmpresa} ${selectedColaboradorDetail.tempoDeEmpresa === 1 ? 'mês' : 'meses'}`}
                      </p>
                    </div>
                  )}
                  {selectedColaboradorDetail.diasAteDesligamento !== undefined && (
                    <div className="p-2 bg-amber-500/10 rounded border border-amber-500/20">
                      <p className="text-xs text-muted-foreground">Dias até Desligamento</p>
                      <p className="font-medium text-amber-600">{selectedColaboradorDetail.diasAteDesligamento} dias</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" asChild data-testid="btn-ver-perfil-detalhe">
                <Link href={`/colaboradores/${selectedColaboradorDetail?.id}`}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver Perfil Completo
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Colaboradores por Saúde */}
        <Dialog open={!!selectedHealthCategory} onOpenChange={(open) => !open && setSelectedHealthCategory(null)}>
          <DialogContent className="sm:max-w-lg max-h-[80vh]" data-testid="dialog-health-category">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedHealthCategory === 'saudavel' && <Heart className="w-5 h-5 text-green-500" />}
                {selectedHealthCategory === 'atencao' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                {selectedHealthCategory === 'critico' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                Colaboradores - {selectedHealthCategory === 'saudavel' ? 'Saudável' : selectedHealthCategory === 'atencao' ? 'Atenção' : 'Crítico'}
              </DialogTitle>
              <DialogDescription>
                {selectedHealthCategory === 'saudavel' && 'Colaboradores em boas condições de carreira'}
                {selectedHealthCategory === 'atencao' && 'Colaboradores que precisam de atenção (12+ meses sem aumento ou salário <85% da média)'}
                {selectedHealthCategory === 'critico' && 'Colaboradores em situação crítica (24+ meses sem aumento ou salário <70% da média)'}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {isLoadingColaboradoresPorSaude ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : colaboradoresPorSaude && selectedHealthCategory ? (
                colaboradoresPorSaude[selectedHealthCategory].length > 0 ? (
                  colaboradoresPorSaude[selectedHealthCategory].map((c) => (
                    <div 
                      key={c.id} 
                      className={`p-3 rounded-lg border ${
                        selectedHealthCategory === 'saudavel' ? 'bg-green-500/5 border-green-500/20' :
                        selectedHealthCategory === 'atencao' ? 'bg-amber-500/5 border-amber-500/20' :
                        'bg-red-500/5 border-red-500/20'
                      }`}
                      data-testid={`health-colaborador-${c.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Link href={`/colaboradores/${c.id}`} className="hover:underline">
                            <p className="font-medium text-sm truncate">{c.nome}</p>
                          </Link>
                          <p className="text-xs text-muted-foreground">{c.cargo || 'N/A'}</p>
                          {c.squad && <p className="text-xs text-muted-foreground">{c.squad}</p>}
                        </div>
                        <Button variant="ghost" size="icon" asChild className="flex-shrink-0">
                          <Link href={`/colaboradores/${c.id}`}>
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.reasons.map((reason, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className={`text-[10px] ${
                              selectedHealthCategory === 'saudavel' ? 'text-green-600 border-green-500/30' :
                              selectedHealthCategory === 'atencao' ? 'text-amber-600 border-amber-500/30' :
                              'text-red-600 border-red-500/30'
                            }`}
                          >
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nenhum colaborador nesta categoria</p>
                )
              ) : (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedHealthCategory(null)} data-testid="btn-fechar-health">
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Colaboradores por Filtro (Charts/Tables) */}
        <Dialog open={!!selectedChartFilter} onOpenChange={(open) => !open && setSelectedChartFilter(null)}>
          <DialogContent className="sm:max-w-lg max-h-[80vh]" data-testid="dialog-chart-filter">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedChartFilter?.tipo === 'modalidade' && <Building className="w-5 h-5 text-teal-500" />}
                {selectedChartFilter?.tipo === 'cidade' && <MapPin className="w-5 h-5 text-blue-500" />}
                {selectedChartFilter?.tipo === 'estado' && <MapPin className="w-5 h-5 text-amber-500" />}
                {selectedChartFilter?.tipo === 'squad' && <Users className="w-5 h-5 text-blue-500" />}
                {selectedChartFilter?.tipo === 'cargo' && <Award className="w-5 h-5 text-purple-500" />}
                {selectedChartFilter?.tipo === 'nivel' && <TrendingUp className="w-5 h-5 text-green-500" />}
                {selectedChartFilter?.label}
              </DialogTitle>
              <DialogDescription>
                {colaboradoresFiltrados?.length || 0} colaborador{colaboradoresFiltrados?.length !== 1 ? 'es' : ''} encontrado{colaboradoresFiltrados?.length !== 1 ? 's' : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {isLoadingColaboradoresFiltrados ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : colaboradoresFiltrados && colaboradoresFiltrados.length > 0 ? (
                colaboradoresFiltrados.map((c) => (
                  <div 
                    key={c.id} 
                    className="p-3 rounded-lg border bg-muted/30"
                    data-testid={`filtro-colaborador-${c.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Link href={`/colaboradores/${c.id}`} className="hover:underline">
                          <p className="font-medium text-sm truncate">{c.nome}</p>
                        </Link>
                        <p className="text-xs text-muted-foreground">{c.cargo || 'N/A'}</p>
                        {c.squad && <p className="text-xs text-muted-foreground">{c.squad}</p>}
                      </div>
                      <Button variant="ghost" size="icon" asChild className="flex-shrink-0">
                        <Link href={`/colaboradores/${c.id}`}>
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhum colaborador encontrado</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedChartFilter(null)} data-testid="btn-fechar-filtro">
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Seção Retenção e Saúde */}
        <div className="mb-6" data-testid="section-retencao-saude">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b">
            <Heart className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold">Retenção e Saúde</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Taxa de Retenção KPI */}
            <Card data-testid="card-taxa-retencao">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <CardTitle className="text-sm font-medium">Taxa de Retenção</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingRetencaoSaude ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${
                      (retencaoSaude?.taxaRetencao || 0) >= 90 ? 'text-green-600' :
                      (retencaoSaude?.taxaRetencao || 0) >= 70 ? 'text-amber-600' : 'text-red-600'
                    }`} data-testid="text-taxa-retencao">
                      {retencaoSaude?.taxaRetencao?.toFixed(1) || '0.0'}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {retencaoSaude?.periodo || 'Período não definido'}
                    </p>
                    <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>Início: {retencaoSaude?.ativosInicio || 0}</span>
                      <span>Atual: {retencaoSaude?.ativosAtual || 0}</span>
                      <span className="text-red-500">-{retencaoSaude?.demitidosPeriodo || 0}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Health Distribution */}
            <Card className="md:col-span-2" data-testid="card-health-distribution">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-sm font-medium">Distribuição de Saúde</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingRetencaoSaude ? (
                  <Skeleton className="h-24 w-full" />
                ) : retencaoSaude?.healthDistribution ? (
                  <div className="space-y-4">
                    {(() => {
                      const total = (retencaoSaude.healthDistribution.saudavel || 0) + 
                                    (retencaoSaude.healthDistribution.atencao || 0) + 
                                    (retencaoSaude.healthDistribution.critico || 0);
                      const saudavelPct = total > 0 ? ((retencaoSaude.healthDistribution.saudavel / total) * 100) : 0;
                      const atencaoPct = total > 0 ? ((retencaoSaude.healthDistribution.atencao / total) * 100) : 0;
                      const criticoPct = total > 0 ? ((retencaoSaude.healthDistribution.critico / total) * 100) : 0;
                      
                      return (
                        <>
                          <div className="flex h-6 rounded-full overflow-hidden bg-muted" data-testid="progress-health">
                            <div 
                              className="bg-green-500 transition-all" 
                              style={{ width: `${saudavelPct}%` }}
                              title={`Saudável: ${saudavelPct.toFixed(1)}%`}
                            />
                            <div 
                              className="bg-amber-500 transition-all" 
                              style={{ width: `${atencaoPct}%` }}
                              title={`Atenção: ${atencaoPct.toFixed(1)}%`}
                            />
                            <div 
                              className="bg-red-500 transition-all" 
                              style={{ width: `${criticoPct}%` }}
                              title={`Crítico: ${criticoPct.toFixed(1)}%`}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div 
                              className="p-2 bg-green-500/10 rounded-lg border border-green-500/20 cursor-pointer hover-elevate" 
                              data-testid="health-saudavel"
                              onClick={() => setSelectedHealthCategory('saudavel')}
                            >
                              <div className="text-lg font-bold text-green-600">{retencaoSaude.healthDistribution.saudavel || 0}</div>
                              <p className="text-[10px] text-muted-foreground">Saudável</p>
                              <p className="text-[10px] text-green-600">{saudavelPct.toFixed(1)}%</p>
                            </div>
                            <div 
                              className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 cursor-pointer hover-elevate" 
                              data-testid="health-atencao"
                              onClick={() => setSelectedHealthCategory('atencao')}
                            >
                              <div className="text-lg font-bold text-amber-600">{retencaoSaude.healthDistribution.atencao || 0}</div>
                              <p className="text-[10px] text-muted-foreground">Atenção</p>
                              <p className="text-[10px] text-amber-600">{atencaoPct.toFixed(1)}%</p>
                            </div>
                            <div 
                              className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 cursor-pointer hover-elevate" 
                              data-testid="health-critico"
                              onClick={() => setSelectedHealthCategory('critico')}
                            >
                              <div className="text-lg font-bold text-red-600">{retencaoSaude.healthDistribution.critico || 0}</div>
                              <p className="text-[10px] text-muted-foreground">Crítico</p>
                              <p className="text-[10px] text-red-600">{criticoPct.toFixed(1)}%</p>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24" data-testid="text-no-health-data">
                    <p className="text-muted-foreground text-sm">Dados não disponíveis</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Seção Distribuição Geográfica */}
        <div className="mb-8" data-testid="section-distribuicao-geografica">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b">
            <MapPin className="w-5 h-5 text-teal-500" />
            <h2 className="text-lg font-semibold">Distribuição Geográfica</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Modalidade Presencial vs Remoto */}
            <Card data-testid="card-modalidade">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-teal-500" />
                  <CardTitle className="text-sm">Modalidade de Trabalho</CardTitle>
                </div>
                <CardDescription>Presencial vs Remoto</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDistribuicaoGeografica ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : distribuicaoGeografica?.modalidade ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Presencial', value: distribuicaoGeografica.modalidade.presencial },
                            { name: 'Remoto', value: distribuicaoGeografica.modalidade.remoto }
                          ]}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                          onClick={(data) => handleChartClick('modalidade', data.name, `Modalidade: ${data.name}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <Cell fill="#14b8a6" />
                          <Cell fill="#8b5cf6" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-2 text-xs">
                      <div 
                        className="flex items-center gap-1 cursor-pointer hover:opacity-80" 
                        data-testid="modalidade-presencial"
                        onClick={() => handleChartClick('modalidade', 'Presencial', 'Modalidade: Presencial')}
                      >
                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                        <span>Presencial: {distribuicaoGeografica.modalidade.presencial}</span>
                      </div>
                      <div 
                        className="flex items-center gap-1 cursor-pointer hover:opacity-80" 
                        data-testid="modalidade-remoto"
                        onClick={() => handleChartClick('modalidade', 'Remoto', 'Modalidade: Remoto')}
                      >
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span>Remoto: {distribuicaoGeografica.modalidade.remoto}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px]" data-testid="text-no-data-modalidade">
                    <p className="text-muted-foreground text-sm">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grande Vitória */}
            <Card data-testid="card-grande-vitoria">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-sm">Grande Vitória</CardTitle>
                </div>
                <CardDescription>Distribuição por cidade</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDistribuicaoGeografica ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : distribuicaoGeografica?.grandeVitoria && distribuicaoGeografica.grandeVitoria.length > 0 ? (
                  (() => {
                    const totalGV = distribuicaoGeografica.grandeVitoria.reduce((acc, item) => acc + item.total, 0);
                    return (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={distribuicaoGeografica.grandeVitoria} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="cidade" type="category" width={80} tick={{ fontSize: 10 }} />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as { cidade: string; total: number };
                                const pct = totalGV > 0 ? ((data.total / totalGV) * 100).toFixed(1) : '0';
                                return (
                                  <div className="bg-popover border rounded-md shadow-md p-2">
                                    <p className="font-medium text-sm">{data.cidade}</p>
                                    <p className="text-xs text-muted-foreground">Colaboradores: {data.total}</p>
                                    <p className="text-xs text-muted-foreground">{pct}%</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="total" 
                            name="Colaboradores" 
                            radius={[0, 4, 4, 0]}
                            onClick={(data) => handleChartClick('cidade', data.cidade, `Cidade: ${data.cidade}`)}
                            style={{ cursor: 'pointer' }}
                          >
                            {distribuicaoGeografica.grandeVitoria.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  <div className="flex items-center justify-center h-[200px]" data-testid="text-no-data-grande-vitoria">
                    <p className="text-muted-foreground text-sm">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Por Estado */}
            <Card data-testid="card-por-estado">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-sm">Por Estado</CardTitle>
                </div>
                <CardDescription>Distribuição por UF</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDistribuicaoGeografica ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : distribuicaoGeografica?.byEstado && distribuicaoGeografica.byEstado.length > 0 ? (
                  (() => {
                    const totalEstado = distribuicaoGeografica.byEstado.reduce((acc, item) => acc + item.total, 0);
                    return (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={distribuicaoGeografica.byEstado} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="estado" type="category" width={40} tick={{ fontSize: 10 }} />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as { estado: string; total: number };
                                const pct = totalEstado > 0 ? ((data.total / totalEstado) * 100).toFixed(1) : '0';
                                return (
                                  <div className="bg-popover border rounded-md shadow-md p-2">
                                    <p className="font-medium text-sm">{data.estado}</p>
                                    <p className="text-xs text-muted-foreground">Colaboradores: {data.total}</p>
                                    <p className="text-xs text-muted-foreground">{pct}%</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="total" 
                            name="Colaboradores" 
                            radius={[0, 4, 4, 0]}
                            onClick={(data) => handleChartClick('estado', data.estado, `Estado: ${data.estado}`)}
                            style={{ cursor: 'pointer' }}
                          >
                            {distribuicaoGeografica.byEstado.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  <div className="flex items-center justify-center h-[200px]" data-testid="text-no-data-estado">
                    <p className="text-muted-foreground text-sm">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Seção Distribuições */}
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <Users className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold">Distribuições por Categoria</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card data-testid="card-colaboradores-por-squad">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <CardTitle>Distribuição por Squad</CardTitle>
              </div>
              <CardDescription>Colaboradores ativos por squad</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingColaboradoresPorSquad ? (
                <Skeleton className="h-[250px] w-full" />
              ) : colaboradoresPorSquad && colaboradoresPorSquad.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const squadIcons: Record<string, string> = {
                          'Vendas': '💰 Vendas',
                          'Selva': '🪖 Selva',
                          'Squadra': '⚓️ Squadra',
                          'Pulse': '💠 Pulse',
                          'Squad X': '👾 Squad X',
                          'Tech': '🖥️ Tech',
                          'CX&CS': '📊 CX&CS',
                          'Turbo Interno': '🚀 Turbo Interno',
                          'Ventures': '⭐️ Ventures',
                          'Chama': '🔥 Chama (OFF)',
                          'Hunters': '🏹 Hunters (OFF)',
                          'Fragmentados': '🧩 Fragmentados (OFF)',
                          'Makers': '🛠️ Makers',
                        };
                        const removeEmoji = (str: string) => {
                          return str.split('').filter(char => {
                            const code = char.codePointAt(0) || 0;
                            return !(
                              (code >= 0x1F300 && code <= 0x1F9FF) ||
                              (code >= 0x2600 && code <= 0x26FF) ||
                              (code >= 0x2700 && code <= 0x27BF) ||
                              (code >= 0x1F600 && code <= 0x1F64F) ||
                              (code >= 0x1F680 && code <= 0x1F6FF) ||
                              code === 0x2693
                            );
                          }).join('').trim();
                        };
                        const formatSquadName = (nome: string) => {
                          const cleanName = removeEmoji(nome);
                          return squadIcons[cleanName] || nome;
                        };
                        const aggregatedSquads = colaboradoresPorSquad.reduce((acc, item) => {
                          const cleanName = removeEmoji(item.nome);
                          const existing = acc.find(s => removeEmoji(s.nome) === cleanName);
                          if (existing) {
                            existing.total += item.total;
                          } else {
                            acc.push({ nome: formatSquadName(item.nome), total: item.total });
                          }
                          return acc;
                        }, [] as { nome: string; total: number }[]);
                        const totalSquad = aggregatedSquads.reduce((sum, item) => sum + item.total, 0);
                        return aggregatedSquads.map((item, index) => {
                          const cleanName = removeEmoji(item.nome);
                          return (
                            <TableRow 
                              key={item.nome} 
                              data-testid={`squad-dist-${index}`}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleChartClick('squad', cleanName, `Squad: ${item.nome}`)}
                            >
                              <TableCell className="font-medium">{item.nome}</TableCell>
                              <TableCell className="text-right">{item.total}</TableCell>
                              <TableCell className="text-right">{totalSquad > 0 ? ((item.total / totalSquad) * 100).toFixed(1) : 0}%</TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px]" data-testid="text-no-data-squad">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-colaboradores-por-cargo">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                <CardTitle>Distribuição por Cargo</CardTitle>
              </div>
              <CardDescription>Colaboradores ativos por cargo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingColaboradoresPorCargo ? (
                <Skeleton className="h-[250px] w-full" />
              ) : colaboradoresPorCargo && colaboradoresPorCargo.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const totalCargo = colaboradoresPorCargo.reduce((sum, item) => sum + item.total, 0);
                        return colaboradoresPorCargo.map((item, index) => (
                          <TableRow 
                            key={item.nome} 
                            data-testid={`cargo-dist-${index}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleChartClick('cargo', item.nome, `Cargo: ${item.nome}`)}
                          >
                            <TableCell className="font-medium">{item.nome}</TableCell>
                            <TableCell className="text-right">{item.total}</TableCell>
                            <TableCell className="text-right">{totalCargo > 0 ? ((item.total / totalCargo) * 100).toFixed(1) : 0}%</TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px]" data-testid="text-no-data-cargo">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-colaboradores-por-nivel">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <CardTitle>Distribuição por Nível</CardTitle>
              </div>
              <CardDescription>Colaboradores ativos por nível</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingColaboradoresPorNivel ? (
                <Skeleton className="h-[250px] w-full" />
              ) : colaboradoresPorNivel && colaboradoresPorNivel.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const totalNivel = colaboradoresPorNivel.reduce((sum, item) => sum + item.total, 0);
                        const formatNivel = (nome: string) => nome.replace(/^X\s+/, '');
                        return colaboradoresPorNivel.map((item, index) => (
                          <TableRow 
                            key={item.nome} 
                            data-testid={`nivel-dist-${index}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleChartClick('nivel', item.nome, `Nível: ${formatNivel(item.nome)}`)}
                          >
                            <TableCell className="font-medium">{formatNivel(item.nome)}</TableCell>
                            <TableCell className="text-right">{item.total}</TableCell>
                            <TableCell className="text-right">{totalNivel > 0 ? ((item.total / totalNivel) * 100).toFixed(1) : 0}%</TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px]" data-testid="text-no-data-nivel">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card data-testid="card-aniversariantes-mes">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cake className="w-5 h-5 text-pink-500" />
                <CardTitle>Aniversariantes do Mês</CardTitle>
              </div>
              <CardDescription>Colaboradores que fazem aniversário este mês</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAniversariantes ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : aniversariantesMes && aniversariantesMes.length > 0 ? (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {aniversariantesMes.map((aniv) => (
                    <div key={aniv.id} className="flex items-center justify-between p-4 bg-card rounded-lg border" data-testid={`aniversariante-${aniv.id}`}>
                      <div>
                        <p className="font-medium text-base">{aniv.nome}</p>
                        <p className="text-xs text-muted-foreground">{aniv.cargo || 'N/A'} - {aniv.squad || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{String(aniv.diaAniversario).padStart(2, '0')}/{String(new Date().getMonth() + 1).padStart(2, '0')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px]" data-testid="text-no-aniversariantes">
                  <p className="text-muted-foreground">Nenhum aniversariante este mês</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-aniversarios-empresa">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                <CardTitle>Aniversários de Empresa</CardTitle>
              </div>
              <CardDescription>Colaboradores que completam tempo na empresa</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAniversariosEmpresa ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : aniversariosEmpresa && aniversariosEmpresa.filter(a => a.anosDeEmpresa > 0).length > 0 ? (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {aniversariosEmpresa.filter(a => a.anosDeEmpresa > 0).map((aniv) => {
                    const getYearBadgeColor = (anos: number) => {
                      if (anos >= 5) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
                      if (anos >= 3) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
                      if (anos >= 2) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
                      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
                    };
                    return (
                      <div key={aniv.id} className="flex items-center justify-between p-4 bg-card rounded-lg border" data-testid={`aniversario-empresa-${aniv.id}`}>
                        <div>
                          <p className="font-medium text-base">{aniv.nome}</p>
                          <p className="text-xs text-muted-foreground">{aniv.cargo || 'N/A'} - {aniv.squad || 'N/A'}</p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <Badge className={getYearBadgeColor(aniv.anosDeEmpresa)}>
                            {aniv.anosDeEmpresa} {aniv.anosDeEmpresa === 1 ? 'ano' : 'anos'}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {aniv.diasAteAniversario === 0 ? 'Hoje!' : 
                             aniv.diasAteAniversario === 1 ? 'Amanhã' : 
                             `Em ${aniv.diasAteAniversario} dias`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px]" data-testid="text-no-aniversarios-empresa">
                  <p className="text-muted-foreground">Nenhum aniversário de empresa próximo</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Seção Salário Médio por Cargo e Squad */}
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <DollarSign className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold">Análise Salarial</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card data-testid="card-salario-por-cargo">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                <CardTitle>Salário Médio por Cargo</CardTitle>
              </div>
              <CardDescription>Top 10 cargos por salário médio</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSalarioPorCargo ? (
                <Skeleton className="h-[300px] w-full" />
              ) : salarioPorCargo && salarioPorCargo.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salarioPorCargo.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis 
                      type="number" 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                    />
                    <YAxis 
                      dataKey="cargo" 
                      type="category" 
                      width={120} 
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as SalarioPorCargo;
                          return (
                            <div className="bg-popover border rounded-md shadow-md p-2">
                              <p className="font-medium text-sm">{data.cargo}</p>
                              <p className="text-xs text-muted-foreground">
                                R$ {data.salarioMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-muted-foreground">{data.total} colaboradores</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="salarioMedio" name="Salário Médio" radius={[0, 4, 4, 0]}>
                      {salarioPorCargo.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px]" data-testid="text-no-data-salario-cargo">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-salario-por-squad">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <CardTitle>Salário Médio por Squad</CardTitle>
              </div>
              <CardDescription>Comparativo entre squads</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSalarioPorSquad ? (
                <Skeleton className="h-[300px] w-full" />
              ) : salarioPorSquad && salarioPorSquad.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salarioPorSquad} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis 
                      type="number" 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                    />
                    <YAxis 
                      dataKey="squad" 
                      type="category" 
                      width={120} 
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as SalarioPorSquad;
                          return (
                            <div className="bg-popover border rounded-md shadow-md p-2">
                              <p className="font-medium text-sm">{data.squad}</p>
                              <p className="text-xs text-muted-foreground">
                                R$ {data.salarioMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-muted-foreground">{data.total} colaboradores</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="salarioMedio" name="Salário Médio" radius={[0, 4, 4, 0]}>
                      {salarioPorSquad.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px]" data-testid="text-no-data-salario-squad">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 1: Salário Médio por Tempo de Empresa + Últimas Demissões */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card data-testid="card-salario-tempo-empresa">
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-500" />
                <CardTitle>Salário Médio por Tempo de Empresa</CardTitle>
              </div>
              <CardDescription>Correlação entre tempo de casa e remuneração</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSalarioByTempo ? (
                <Skeleton className="h-[250px] w-full" />
              ) : salarioByTempo?.salarioByTempo ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={Object.entries(salarioByTempo.salarioByTempo).map(([tempo, data]) => ({
                      tempo,
                      avg: data.avg,
                    }))}
                    margin={{ left: 20, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
                    <XAxis dataKey="tempo" tick={{ fill: 'hsl(var(--muted-foreground))' }} fontSize={11} />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                      fontSize={12}
                      tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        color: 'hsl(var(--foreground))'
                      }} 
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Salário Médio']}
                    />
                    <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Salário Médio" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px]" data-testid="text-no-data-salario">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-ultimas-demissoes" className="border-red-500/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserMinus className="w-5 h-5 text-red-500" />
                <CardTitle>Últimas Demissões</CardTitle>
              </div>
              <CardDescription>Desligamentos recentes</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUltimasDemissoes ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : ultimasDemissoes && ultimasDemissoes.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {ultimasDemissoes.slice(0, 5).map((d) => (
                    <div 
                      key={d.id} 
                      className="flex items-center justify-between p-2 bg-red-500/5 rounded-lg border border-red-500/20 cursor-pointer hover-elevate" 
                      data-testid={`ultima-demissao-${d.id}`}
                      onClick={() => setSelectedColaboradorDetail({
                        type: 'demissao',
                        id: d.id,
                        nome: d.nome,
                        cargo: d.cargo,
                        squad: d.squad,
                        demissao: d.dataDesligamento,
                        tempoDeEmpresa: d.tempoDeEmpresa
                      })}
                    >
                      <div>
                        <p className="font-medium text-sm">{d.nome}</p>
                        <p className="text-xs text-muted-foreground">{d.cargo || 'N/A'} - {d.squad || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{d.dataDesligamento ? new Date(d.dataDesligamento).toLocaleDateString('pt-BR') : 'N/A'}</p>
                        <p className="text-xs text-muted-foreground text-red-600">
                          {d.tempoDeEmpresa < 1 ? 'Menos de 1 mês' : `${d.tempoDeEmpresa} ${d.tempoDeEmpresa === 1 ? 'mês' : 'meses'}`}
                        </p>
                      </div>
                    </div>
                  ))}
                  {ultimasDemissoes.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{ultimasDemissoes.length - 5} outros
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px]" data-testid="text-no-ultimas-demissoes">
                  <p className="text-muted-foreground text-sm">Nenhum desligamento registrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Más Contratações + Demissões por Tipo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card data-testid="card-mas-contratacoes" className="border-amber-500/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <CardTitle>Más Contratações</CardTitle>
              </div>
              <CardDescription>Desligados em até 90 dias após admissão</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMasContratacoes ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-3xl font-bold text-amber-500" data-testid="text-mas-contratacoes">
                      {masContratacoes?.total || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      colaboradores desligados antes de 90 dias
                    </p>
                  </div>
                  {masContratacoes?.colaboradores && masContratacoes.colaboradores.length > 0 ? (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto">
                      {masContratacoes.colaboradores.slice(0, 5).map((c) => (
                        <div 
                          key={c.id} 
                          className="flex items-center justify-between p-2 bg-amber-500/5 rounded-lg border border-amber-500/20 cursor-pointer hover-elevate" 
                          data-testid={`ma-contratacao-${c.id}`}
                          onClick={() => setSelectedColaboradorDetail({
                            type: 'maContratacao',
                            id: c.id,
                            nome: c.nome,
                            cargo: null,
                            squad: c.squad,
                            setor: c.setor,
                            diasAteDesligamento: c.diasAteDesligamento
                          })}
                        >
                          <div>
                            <p className="font-medium text-sm">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">{c.setor || 'N/A'} - {c.squad || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-amber-600">{c.diasAteDesligamento} dias</p>
                          </div>
                        </div>
                      ))}
                      {masContratacoes.colaboradores.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{masContratacoes.colaboradores.length - 5} outros
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[100px]">
                      <p className="text-muted-foreground text-sm">Nenhuma má contratação registrada</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-demissoes-por-tipo">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-red-500" />
                <CardTitle>Demissões por Tipo</CardTitle>
              </div>
              <CardDescription>Distribuição por tipo de desligamento</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDemissoesPorTipo ? (
                <Skeleton className="h-[250px] w-full" />
              ) : demissoesPorTipo && demissoesPorTipo.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={demissoesPorTipo}
                        dataKey="total"
                        nameKey="tipo"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {demissoesPorTipo.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as DemissoesPorTipo;
                            return (
                              <div className="bg-popover border rounded-md shadow-md p-2">
                                <p className="font-medium text-sm">{data.tipo}</p>
                                <p className="text-xs text-muted-foreground">{data.total} ({data.percentual.toFixed(1)}%)</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 mt-2 max-h-[80px] overflow-y-auto w-full">
                    {demissoesPorTipo.map((item, index) => (
                      <div key={item.tipo} className="flex items-center gap-2 text-xs" data-testid={`demissao-tipo-${index}`}>
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} 
                        />
                        <span className="text-muted-foreground truncate">{item.tipo}</span>
                        <span className="font-medium ml-auto">({item.total})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px]" data-testid="text-no-data-demissoes-tipo">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8">
          <Card data-testid="card-ultimas-promocoes">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                <CardTitle>Últimas Promoções</CardTitle>
              </div>
              <CardDescription>Colaboradores promovidos recentemente</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPromocoes ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : ultimasPromocoes && ultimasPromocoes.length > 0 ? (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {ultimasPromocoes.map((promo) => (
                    <div key={promo.id} className="flex items-center justify-between p-3 bg-card rounded-lg border" data-testid={`promocao-${promo.id}`}>
                      <div>
                        <p className="font-medium text-sm">{promo.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {promo.cargo || 'N/A'} {promo.nivel ? `- ${promo.nivel}` : ''} | {promo.squad || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {promo.ultimoAumento ? new Date(promo.ultimoAumento).toLocaleDateString('pt-BR') : 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Há {promo.mesesUltAumento} {promo.mesesUltAumento === 1 ? 'mês' : 'meses'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px]" data-testid="text-no-promocoes">
                  <p className="text-muted-foreground">Nenhuma promoção registrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
