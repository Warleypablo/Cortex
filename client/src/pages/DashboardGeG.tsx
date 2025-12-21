import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, TrendingUp, UserPlus, UserMinus, Clock, Cake, Award, Calendar, AlertTriangle, PieChart as PieChartIcon, BarChart2, Building } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, PieChart, Pie, Cell } from "recharts";
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

interface TempoPromocao {
  squad: string;
  tempoMedioMeses: number;
  totalColaboradores: number;
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

interface PatrimonioResumo {
  totalAtivos: number;
  valorTotalPago: number;
  valorTotalMercado: number;
  porTipo: { tipo: string; quantidade: number }[];
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

  const { data: tempoPromocao, isLoading: isLoadingTempoPromocao } = useQuery<TempoPromocao[]>({
    queryKey: ['/api/geg/tempo-promocao', { squad, setor }],
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

  const { data: patrimonioResumo, isLoading: isLoadingPatrimonio } = useQuery<PatrimonioResumo>({
    queryKey: ['/api/geg/patrimonio-resumo'],
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

  const formatMesAno = (mesAno: string) => {
    const [ano, mes] = mesAno.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(mes) - 1]}/${ano.slice(2)}`;
  };

  const formatData = (data: string) => {
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card data-testid="card-headcount">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Headcount Atual</CardTitle>
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
                  <p className="text-xs text-muted-foreground mt-1">No período selecionado</p>
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
                  <p className="text-xs text-muted-foreground mt-1">No período selecionado</p>
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
                  <p className="text-xs text-muted-foreground mt-1">No período selecionado</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-tempo-medio">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tempo de Permanência</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingTempoPermanencia ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-2">
                  <div>
                    <div className="text-xl font-bold" data-testid="text-tempo-ativos">
                      {tempoPermanencia?.tempoMedioAtivos ? tempoPermanencia.tempoMedioAtivos.toFixed(1) : '0'} meses
                    </div>
                    <p className="text-xs text-muted-foreground">Ativos</p>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-muted-foreground" data-testid="text-tempo-desligados">
                      {tempoPermanencia?.tempoMedioDesligados ? tempoPermanencia.tempoMedioDesligados.toFixed(1) : '0'} meses
                    </div>
                    <p className="text-xs text-muted-foreground">Desligados</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card data-testid="card-valor-medio">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Médio</CardTitle>
              <Award className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingValorMedio ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-valor-medio">
                    R$ {valorMedioSalario?.valorMedio ? valorMedioSalario.valorMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {valorMedioSalario?.totalColaboradores || 0} colaboradores
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-patrimonio" className="col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Resumo de Patrimônio</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingPatrimonio ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-total-ativos">{patrimonioResumo?.totalAtivos || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total de Ativos</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-valor-pago">
                      R$ {patrimonioResumo?.valorTotalPago ? (patrimonioResumo.valorTotalPago / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0,0'}k
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Valor Pago Total</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-valor-mercado">
                      R$ {patrimonioResumo?.valorTotalMercado ? (patrimonioResumo.valorTotalMercado / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0,0'}k
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Valor de Mercado</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="card-mas-contratacoes" className="border-amber-500/20 bg-amber-500/5">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Más Contratações</CardTitle>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isLoadingMasContratacoes ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <div className="text-2xl font-bold text-amber-500 cursor-help" data-testid="text-mas-contratacoes">
                        {masContratacoes?.total || 0}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {masContratacoes?.colaboradores && masContratacoes.colaboradores.length > 0 ? (
                        <div className="space-y-1">
                          <p className="font-medium text-xs mb-2">Desligados em até 90 dias:</p>
                          {masContratacoes.colaboradores.slice(0, 5).map((c) => (
                            <p key={c.id} className="text-xs">
                              {c.nome} ({c.diasAteDesligamento} dias)
                            </p>
                          ))}
                          {masContratacoes.colaboradores.length > 5 && (
                            <p className="text-xs text-muted-foreground">
                              +{masContratacoes.colaboradores.length - 5} outros
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs">Nenhuma má contratação encontrada</p>
                      )}
                    </TooltipContent>
                  </UITooltip>
                  <p className="text-xs text-muted-foreground mt-1">Desligados em até 90 dias</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-pessoas-por-setor" className="col-span-1 md:col-span-1 lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pessoas por Setor</CardTitle>
              <Building className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingPessoasPorSetor ? (
                <Skeleton className="h-[150px] w-full" />
              ) : pessoasPorSetor && pessoasPorSetor.length > 0 ? (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={pessoasPorSetor} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="setor" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as PessoasPorSetor;
                          return (
                            <div className="bg-popover border rounded-md shadow-md p-2">
                              <p className="font-medium text-sm">{data.setor}</p>
                              <p className="text-xs text-muted-foreground">{data.total} colaboradores</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="total" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[150px]" data-testid="text-no-data-pessoas-setor">
                  <p className="text-muted-foreground text-sm">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
                <div className="flex items-center justify-center gap-4">
                  <ResponsiveContainer width="60%" height={250}>
                    <PieChart>
                      <Pie
                        data={demissoesPorTipo}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="total"
                        nameKey="tipo"
                        label={({ tipo, percentual }) => `${percentual}%`}
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
                                <p className="text-xs text-muted-foreground">{data.total} ({data.percentual}%)</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {demissoesPorTipo.map((item, index) => (
                      <div key={item.tipo} className="flex items-center gap-2 text-sm" data-testid={`demissao-tipo-${index}`}>
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} 
                        />
                        <span className="text-muted-foreground">{item.tipo}</span>
                        <span className="font-medium">({item.total})</span>
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
                <CardTitle>Headcount por Tempo de Permanência</CardTitle>
              </div>
              <CardDescription>Distribuição de colaboradores ativos por faixa de tempo</CardDescription>
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
                      angle={-20}
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
                    <Bar 
                      dataKey="total" 
                      name="Colaboradores"
                      radius={[4, 4, 0, 0]}
                    >
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
                    <Line type="monotone" dataKey="headcount" name="Headcount" stroke="#0ea5e9" strokeWidth={2} />
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
                    <Bar dataKey="admissoes" name="Admissões" fill="#10b981" />
                    <Bar dataKey="demissoes" name="Demissões" fill="#ef4444" />
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

        <Card className="mb-8" data-testid="card-tempo-promocao">
          <CardHeader>
            <CardTitle>Tempo Médio de Promoção por Squad</CardTitle>
            <CardDescription>Média de meses entre admissão e última promoção</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTempoPromocao ? (
              <div className="flex items-center justify-center h-[300px]">
                <Skeleton className="h-[300px] w-full" />
              </div>
            ) : tempoPromocao && tempoPromocao.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tempoPromocao} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" label={{ value: 'Meses', position: 'insideBottom', offset: -5 }} />
                  <YAxis type="category" dataKey="squad" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tempoMedioMeses" name="Tempo Médio (meses)" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px]" data-testid="text-no-data-tempo-promocao">
                <p className="text-muted-foreground">Nenhum dado disponível</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="card-ultimas-promocoes">
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
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : ultimasPromocoes && ultimasPromocoes.length > 0 ? (
              <div className="space-y-3">
                {ultimasPromocoes.map((promo) => (
                  <div key={promo.id} className="flex items-center justify-between p-3 bg-card rounded-lg border" data-testid={`promocao-${promo.id}`}>
                    <div>
                      <p className="font-medium">{promo.nome}</p>
                      <p className="text-sm text-muted-foreground">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : aniversariantesMes && aniversariantesMes.length > 0 ? (
                <div className="space-y-3">
                  {aniversariantesMes.map((aniv) => (
                    <div key={aniv.id} className="flex items-center justify-between p-3 bg-card rounded-lg border" data-testid={`aniversariante-${aniv.id}`}>
                      <div>
                        <p className="font-medium">{aniv.nome}</p>
                        <p className="text-sm text-muted-foreground">{aniv.cargo || 'N/A'} - {aniv.squad || 'N/A'}</p>
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
                <CardTitle>Próximos Aniversários de Empresa</CardTitle>
              </div>
              <CardDescription>Colaboradores que completam tempo na Turbo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAniversariosEmpresa ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : aniversariosEmpresa && aniversariosEmpresa.length > 0 ? (
                <div className="space-y-3">
                  {aniversariosEmpresa.map((aniv) => (
                    <div key={aniv.id} className="flex items-center justify-between p-3 bg-card rounded-lg border" data-testid={`aniversario-empresa-${aniv.id}`}>
                      <div>
                        <p className="font-medium">{aniv.nome}</p>
                        <p className="text-sm text-muted-foreground">{aniv.cargo || 'N/A'} - {aniv.squad || 'N/A'}</p>
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
      </div>
    </div>
  );
}
