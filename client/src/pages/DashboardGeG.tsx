import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, TrendingUp, UserPlus, UserMinus, Clock, Cake, Award, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function DashboardGeG() {
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
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-title">Dashboard GEG</h1>
          <p className="text-muted-foreground">Gestão Estratégica de Pessoas</p>
        </div>

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
