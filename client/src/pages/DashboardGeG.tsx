import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDecimal } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, TrendingUp, UserPlus, UserMinus, Clock, Cake, Award, Calendar, AlertTriangle, PieChart as PieChartIcon, BarChart2, Building, DollarSign, Wallet } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

interface Filtros {
  squads: string[];
  setores: string[];
}

interface ValorMedioSalario {
  valorMedio: number;
  totalColaboradores: number;
}

interface CustoFolha {
  custoTotal: number;
  totalColaboradores: number;
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

interface HeadcountPorTenure {
  faixa: string;
  total: number;
  ordem: number;
}

const CHART_COLORS = [
  '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', 
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

export default function DashboardGeG() {
  useSetPageInfo("Dashboard GEG", "Gestão Estratégica de Pessoas");
  
  const [periodo, setPeriodo] = useState("trimestre");
  const [squad, setSquad] = useState("todos");
  const [setor, setSetor] = useState("todos");

  const { data: metricas, isLoading: isLoadingMetricas } = useQuery<GegMetricas>({
    queryKey: ['/api/geg/metricas', { periodo, squad, setor }],
  });

  const { data: evolucaoHeadcount, isLoading: isLoadingEvolucao } = useQuery<EvolucaoHeadcount[]>({
    queryKey: ['/api/geg/evolucao-headcount', { periodo, squad, setor }],
  });

  const { data: admissoesDemissoes, isLoading: isLoadingAdmissoesDemissoes } = useQuery<AdmissoesDemissoes[]>({
    queryKey: ['/api/geg/admissoes-demissoes', { periodo, squad, setor }],
  });

  const { data: aniversariantesMes, isLoading: isLoadingAniversariantes } = useQuery<Aniversariante[]>({
    queryKey: ['/api/geg/aniversariantes-mes', { squad, setor }],
  });

  const { data: aniversariosEmpresa, isLoading: isLoadingAniversariosEmpresa } = useQuery<AniversarioEmpresa[]>({
    queryKey: ['/api/geg/aniversarios-empresa', { squad, setor }],
  });

  const { data: filtros } = useQuery<Filtros>({
    queryKey: ['/api/geg/filtros'],
  });

  const { data: valorMedioSalario, isLoading: isLoadingValorMedio } = useQuery<ValorMedioSalario>({
    queryKey: ['/api/geg/valor-medio-salario', { squad, setor }],
  });

  const { data: custoFolha, isLoading: isLoadingCustoFolha } = useQuery<CustoFolha>({
    queryKey: ['/api/geg/custo-folha', { squad, setor }],
  });

  const { data: ultimasPromocoes, isLoading: isLoadingPromocoes } = useQuery<UltimaPromocao[]>({
    queryKey: ['/api/geg/ultimas-promocoes', { squad, setor, limit: 10 }],
  });

  const { data: tempoPermanencia, isLoading: isLoadingTempoPermanencia } = useQuery<TempoPermanencia>({
    queryKey: ['/api/geg/tempo-permanencia', { squad, setor }],
  });

  const { data: masContratacoes, isLoading: isLoadingMasContratacoes } = useQuery<MasContratacoes>({
    queryKey: ['/api/geg/mas-contratacoes', { squad, setor }],
  });

  const { data: pessoasPorSetor, isLoading: isLoadingPessoasPorSetor } = useQuery<PessoasPorSetor[]>({
    queryKey: ['/api/geg/pessoas-por-setor', { squad, setor }],
  });

  const { data: demissoesPorTipo, isLoading: isLoadingDemissoesPorTipo } = useQuery<DemissoesPorTipo[]>({
    queryKey: ['/api/geg/demissoes-por-tipo', { squad, setor }],
  });

  const { data: headcountPorTenure, isLoading: isLoadingHeadcountPorTenure } = useQuery<HeadcountPorTenure[]>({
    queryKey: ['/api/geg/headcount-por-tenure', { squad, setor }],
  });

  const { data: colaboradoresPorSquad, isLoading: isLoadingColaboradoresPorSquad } = useQuery<Distribuicao[]>({
    queryKey: ['/api/geg/colaboradores-por-squad', { squad, setor }],
  });

  const { data: colaboradoresPorCargo, isLoading: isLoadingColaboradoresPorCargo } = useQuery<Distribuicao[]>({
    queryKey: ['/api/geg/colaboradores-por-cargo', { squad, setor }],
  });

  const { data: colaboradoresPorNivel, isLoading: isLoadingColaboradoresPorNivel } = useQuery<Distribuicao[]>({
    queryKey: ['/api/geg/colaboradores-por-nivel', { squad, setor }],
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

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div>
            <label className="text-sm font-medium mb-2 block">Período</label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger data-testid="select-periodo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="semestre">Semestre</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Squad</label>
            <Select value={squad} onValueChange={setSquad}>
              <SelectTrigger data-testid="select-squad">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {filtros?.squads.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Setor</label>
            <Select value={setor} onValueChange={setSetor}>
              <SelectTrigger data-testid="select-setor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {filtros?.setores.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card data-testid="card-headcount">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Headcount</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-headcount">{metricas?.headcount || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Colaboradores ativos</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-turnover">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Turnover</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-turnover">{metricas?.turnover || 0}%</div>
                  <p className="text-xs text-muted-foreground mt-1">No período</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-admissoes">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admissões</CardTitle>
              <UserPlus className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-admissoes">{metricas?.admissoes || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">No período</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-demissoes">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Demissões</CardTitle>
              <UserMinus className="w-4 h-4 text-red-600" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-demissoes">{metricas?.demissoes || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">No período</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-tempo-medio">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Permanência</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingTempoPermanencia ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-tempo-ativos">
                    {tempoPermanencia?.tempoMedioAtivos ? formatDecimal(tempoPermanencia.tempoMedioAtivos) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">meses (ativos)</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-tempo-desligados">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Permanência Desligados</CardTitle>
              <UserMinus className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              {isLoadingTempoPermanencia ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-tempo-desligados">
                    {tempoPermanencia?.tempoMedioDesligados ? formatDecimal(tempoPermanencia.tempoMedioDesligados) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">meses (desligados)</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card data-testid="card-valor-medio">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Salário Médio</CardTitle>
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

          <Card data-testid="card-custo-folha">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo Folha Total</CardTitle>
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

          <Card data-testid="card-custo-por-colaborador">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo por Colaborador</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingCustoFolha || isLoadingMetricas ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-custo-por-colaborador">
                    R$ {formatCurrency(receitaPorColaborador)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Folha / Headcount
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card data-testid="card-evolucao-headcount">
            <CardHeader>
              <CardTitle>Evolução do Headcount</CardTitle>
              <CardDescription>Histórico de colaboradores ativos</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEvolucao ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Skeleton className="h-[300px] w-full" />
                </div>
              ) : evolucaoHeadcount && evolucaoHeadcount.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={evolucaoHeadcount}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tickFormatter={formatMesAno} />
                    <YAxis />
                    <Tooltip labelFormatter={formatMesAno} />
                    <Legend />
                    <Line type="monotone" dataKey="headcount" name="Headcount" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px]" data-testid="text-no-data-evolucao">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-admissoes-demissoes">
            <CardHeader>
              <CardTitle>Admissões vs Demissões</CardTitle>
              <CardDescription>Comparação mensal de entradas e saídas</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAdmissoesDemissoes ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Skeleton className="h-[300px] w-full" />
                </div>
              ) : admissoesDemissoes && admissoesDemissoes.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={admissoesDemissoes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tickFormatter={formatMesAno} />
                    <YAxis />
                    <Tooltip labelFormatter={formatMesAno} />
                    <Legend />
                    <Bar dataKey="admissoes" name="Admissões" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="demissoes" name="Demissões" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px]" data-testid="text-no-data-admissoes-demissoes">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
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
                        const removeEmoji = (str: string) => str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '').trim();
                        const aggregatedSquads = colaboradoresPorSquad.reduce((acc, item) => {
                          const cleanName = removeEmoji(item.nome);
                          const existing = acc.find(s => removeEmoji(s.nome) === cleanName);
                          if (existing) {
                            existing.total += item.total;
                            if (item.nome.length > existing.nome.length) {
                              existing.nome = item.nome;
                            }
                          } else {
                            acc.push({ ...item });
                          }
                          return acc;
                        }, [] as typeof colaboradoresPorSquad);
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
              ) : aniversariosEmpresa && aniversariosEmpresa.length > 0 ? (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {aniversariosEmpresa.map((aniv) => (
                    <div key={aniv.id} className="flex items-center justify-between p-3 bg-card rounded-lg border" data-testid={`aniversario-empresa-${aniv.id}`}>
                      <div>
                        <p className="font-medium text-sm">{aniv.nome}</p>
                        <p className="text-xs text-muted-foreground">{aniv.cargo || 'N/A'} - {aniv.squad || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{aniv.anosDeEmpresa} {aniv.anosDeEmpresa === 1 ? 'ano' : 'anos'}</p>
                        <p className="text-xs text-muted-foreground">
                          {aniv.diasAteAniversario === 0 ? 'Hoje!' : 
                           aniv.diasAteAniversario === 1 ? 'Amanhã' : 
                           `Em ${aniv.diasAteAniversario} dias`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px]" data-testid="text-no-aniversarios-empresa">
                  <p className="text-muted-foreground">Nenhum aniversário de empresa próximo</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8">
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
