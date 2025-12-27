import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDecimal } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, TrendingDown, UserPlus, UserMinus, Clock, Cake, Award, Gift, Calendar, AlertTriangle, PieChart as PieChartIcon, BarChart2, Building, DollarSign, Wallet, Filter, Info, X, MapPin, Heart, Activity, ShieldCheck } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ComposedChart } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

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
  veteranosSemAumento: { id: number; nome: string; cargo: string | null; squad: string | null; mesesDeTurbo: number; mesesUltAumento: number | null }[];
  fimExperiencia: { id: number; nome: string; cargo: string | null; squad: string | null; admissao: string; diasRestantes: number }[];
  salarioAbaixoMedia: { id: number; nome: string; cargo: string | null; squad: string | null; salario: number; mediaCargo: number; diferenca: string }[];
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

export default function DashboardGeG() {
  usePageTitle("G&G");
  useSetPageInfo("Dashboard GEG", "Gestão Estratégica de Pessoas");
  
  const [periodoState, setPeriodoState] = useState<PeriodoState>({ preset: "trimestre" });
  const [squad, setSquad] = useState("todos");
  const [setor, setSetor] = useState("todos");
  const [nivel, setNivel] = useState("todos");
  const [cargo, setCargo] = useState("todos");

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

  const { data: distribuicaoGeografica, isLoading: isLoadingDistribuicaoGeografica } = useQuery<DistribuicaoGeografica>({
    queryKey: ['/api/geg/distribuicao-geografica', { squad, setor, nivel, cargo }],
  });

  const { data: alertas, isLoading: isLoadingAlertas } = useQuery<GegAlertas>({
    queryKey: ['/api/geg/alertas', { squad, setor, nivel, cargo }],
  });

  const { data: retencaoSaude, isLoading: isLoadingRetencaoSaude } = useQuery<RetencaoSaude>({
    queryKey: ['/api/geg/retencao-saude', { periodo, squad, setor, nivel, cargo }],
  });

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

        {/* Seção Alertas e Atenção */}
        {alertas && alertas.totalAlertas > 0 && (
          <div className="mb-6" data-testid="section-alertas">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold">Alertas e Atenção</h2>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                {alertas.totalAlertas} {alertas.totalAlertas === 1 ? 'alerta' : 'alertas'}
              </Badge>
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
                    {alertas.veteranosSemAumento?.length || 0}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">36+ meses sem promoção</p>
                  {isLoadingAlertas ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : alertas.veteranosSemAumento && alertas.veteranosSemAumento.length > 0 ? (
                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                      {alertas.veteranosSemAumento.slice(0, 5).map((v) => (
                        <div key={v.id} className="flex items-center justify-between p-2 bg-amber-500/5 rounded-lg border border-amber-500/20" data-testid={`alerta-veterano-${v.id}`}>
                          <div>
                            <p className="font-medium text-xs">{v.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{v.cargo || 'N/A'} - {v.squad || 'N/A'}</p>
                          </div>
                          <Badge variant="outline" className="text-amber-600 text-[10px]">
                            {v.mesesUltAumento ? `${v.mesesUltAumento}m` : 'Nunca'}
                          </Badge>
                        </div>
                      ))}
                      {alertas.veteranosSemAumento.length > 5 && (
                        <p className="text-[10px] text-muted-foreground text-center">+{alertas.veteranosSemAumento.length - 5} outros</p>
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
                    {alertas.fimExperiencia?.length || 0}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">Próximos 30 dias</p>
                  {isLoadingAlertas ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : alertas.fimExperiencia && alertas.fimExperiencia.length > 0 ? (
                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                      {alertas.fimExperiencia.slice(0, 5).map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-2 bg-amber-500/5 rounded-lg border border-amber-500/20" data-testid={`alerta-experiencia-${f.id}`}>
                          <div>
                            <p className="font-medium text-xs">{f.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{f.cargo || 'N/A'} - {f.squad || 'N/A'}</p>
                          </div>
                          <Badge variant="outline" className="text-amber-600 text-[10px]">
                            {f.diasRestantes}d
                          </Badge>
                        </div>
                      ))}
                      {alertas.fimExperiencia.length > 5 && (
                        <p className="text-[10px] text-muted-foreground text-center">+{alertas.fimExperiencia.length - 5} outros</p>
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
                    {alertas.salarioAbaixoMedia?.length || 0}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">Abaixo da média do cargo</p>
                  {isLoadingAlertas ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : alertas.salarioAbaixoMedia && alertas.salarioAbaixoMedia.length > 0 ? (
                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                      {alertas.salarioAbaixoMedia.slice(0, 5).map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-amber-500/5 rounded-lg border border-amber-500/20" data-testid={`alerta-salario-${s.id}`}>
                          <div>
                            <p className="font-medium text-xs">{s.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{s.cargo || 'N/A'}</p>
                          </div>
                          <Badge variant="outline" className="text-amber-600 text-[10px]">
                            {s.diferenca}
                          </Badge>
                        </div>
                      ))}
                      {alertas.salarioAbaixoMedia.length > 5 && (
                        <p className="text-[10px] text-muted-foreground text-center">+{alertas.salarioAbaixoMedia.length - 5} outros</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum alerta</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

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
                            <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20" data-testid="health-saudavel">
                              <div className="text-lg font-bold text-green-600">{retencaoSaude.healthDistribution.saudavel || 0}</div>
                              <p className="text-[10px] text-muted-foreground">Saudável</p>
                              <p className="text-[10px] text-green-600">{saudavelPct.toFixed(1)}%</p>
                            </div>
                            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20" data-testid="health-atencao">
                              <div className="text-lg font-bold text-amber-600">{retencaoSaude.healthDistribution.atencao || 0}</div>
                              <p className="text-[10px] text-muted-foreground">Atenção</p>
                              <p className="text-[10px] text-amber-600">{atencaoPct.toFixed(1)}%</p>
                            </div>
                            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20" data-testid="health-critico">
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
                    {custoFolha?.totalColaboradores || 0} colaboradores ativos
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
                    {valorBeneficio?.totalColaboradores || 0} colaboradores
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
                    Base: {valorMedioSalario?.totalColaboradores || 0} colaboradores
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
                    Base: {valorMedioSalario?.totalColaboradores || 0} colaboradores
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
                        >
                          <Cell fill="#14b8a6" />
                          <Cell fill="#8b5cf6" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-2 text-xs">
                      <div className="flex items-center gap-1" data-testid="modalidade-presencial">
                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                        <span>Presencial: {distribuicaoGeografica.modalidade.presencial}</span>
                      </div>
                      <div className="flex items-center gap-1" data-testid="modalidade-remoto">
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
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={distribuicaoGeografica.grandeVitoria} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="cidade" type="category" width={80} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="total" name="Colaboradores" radius={[0, 4, 4, 0]}>
                        {distribuicaoGeografica.grandeVitoria.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={distribuicaoGeografica.byEstado} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="estado" type="category" width={40} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="total" name="Colaboradores" radius={[0, 4, 4, 0]}>
                        {distribuicaoGeografica.byEstado.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
                <div className="max-h-[280px] overflow-y-auto">
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
                        return aggregatedSquads.map((item, index) => (
                          <TableRow key={item.nome} data-testid={`squad-dist-${index}`}>
                            <TableCell className="font-medium">{item.nome}</TableCell>
                            <TableCell className="text-right">{item.total}</TableCell>
                            <TableCell className="text-right">{totalSquad > 0 ? ((item.total / totalSquad) * 100).toFixed(1) : 0}%</TableCell>
                          </TableRow>
                        ));
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
                <div className="max-h-[280px] overflow-y-auto">
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
                          <TableRow key={item.nome} data-testid={`cargo-dist-${index}`}>
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
                <div className="max-h-[280px] overflow-y-auto">
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
                          <TableRow key={item.nome} data-testid={`nivel-dist-${index}`}>
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
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {aniversariantesMes.map((aniv) => (
                    <div key={aniv.id} className="flex items-center justify-between p-3 bg-card rounded-lg border" data-testid={`aniversariante-${aniv.id}`}>
                      <div>
                        <p className="font-medium text-sm">{aniv.nome}</p>
                        <p className="text-xs text-muted-foreground">{aniv.cargo || 'N/A'} - {aniv.squad || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatData(aniv.aniversario)}</p>
                        <p className="text-xs text-muted-foreground">Dia {aniv.diaAniversario}</p>
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
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {aniversariosEmpresa.filter(a => a.anosDeEmpresa > 0).map((aniv) => {
                    const getYearBadgeColor = (anos: number) => {
                      if (anos >= 5) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
                      if (anos >= 3) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
                      if (anos >= 2) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
                      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
                    };
                    return (
                      <div key={aniv.id} className="flex items-center justify-between p-3 bg-card rounded-lg border" data-testid={`aniversario-empresa-${aniv.id}`}>
                        <div>
                          <p className="font-medium text-sm">{aniv.nome}</p>
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
                        <div key={c.id} className="flex items-center justify-between p-2 bg-amber-500/5 rounded-lg border border-amber-500/20" data-testid={`ma-contratacao-${c.id}`}>
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

          {/* Salário Médio por Tempo de Empresa */}
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
