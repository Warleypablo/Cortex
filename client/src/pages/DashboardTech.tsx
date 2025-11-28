import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Monitor, 
  Rocket, 
  Clock, 
  DollarSign, 
  Users, 
  CheckCircle2, 
  Timer, 
  BarChart3,
  TrendingUp,
  Target,
  FileCode,
  Layers
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TechMetricas {
  projetosEmAndamento: number;
  projetosFechados: number;
  totalTasks: number;
  valorTotalProjetos: number;
  valorMedioProjeto: number;
  tempoMedioEntrega: number;
}

interface TechProjetoStatus {
  status: string;
  quantidade: number;
  percentual: number;
}

interface TechProjetoResponsavel {
  responsavel: string | null;
  projetosAtivos: number;
  projetosFechados: number;
  valorTotal: number;
}

interface TechProjetoTipo {
  tipo: string;
  quantidade: number;
  valorTotal: number;
}

interface TechProjetoDetalhe {
  clickupTaskId: string;
  taskName: string;
  statusProjeto: string;
  responsavel: string | null;
  faseProjeto: string | null;
  tipo: string | null;
  tipoProjeto: string | null;
  valorP: number | null;
  dataVencimento: string | null;
  lancamento: string | null;
  dataCriada: string | null;
}

interface TechTaskStatus {
  status: string;
  quantidade: number;
}

interface TechVelocidade {
  projetosEntreguesMes: number;
  tempoMedioEntrega: number;
  taxaCumprimentoPrazo: number;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
};

const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('deploy') || statusLower.includes('completo')) return 'bg-green-500';
  if (statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('dev')) return 'bg-blue-500';
  if (statusLower.includes('review') || statusLower.includes('design')) return 'bg-purple-500';
  if (statusLower.includes('kickoff') || statusLower.includes('planejamento')) return 'bg-yellow-500';
  if (statusLower.includes('não iniciado') || statusLower.includes('backlog')) return 'bg-gray-500';
  return 'bg-slate-500';
};

export default function DashboardTech() {
  const { data: metricas, isLoading: isLoadingMetricas } = useQuery<TechMetricas>({
    queryKey: ['/api/tech/metricas'],
  });

  const { data: projetosPorStatus, isLoading: isLoadingStatus } = useQuery<TechProjetoStatus[]>({
    queryKey: ['/api/tech/projetos-por-status'],
  });

  const { data: projetosPorResponsavel, isLoading: isLoadingResponsavel } = useQuery<TechProjetoResponsavel[]>({
    queryKey: ['/api/tech/projetos-por-responsavel'],
  });

  const { data: projetosPorTipo, isLoading: isLoadingTipo } = useQuery<TechProjetoTipo[]>({
    queryKey: ['/api/tech/projetos-por-tipo'],
  });

  const { data: projetosEmAndamento, isLoading: isLoadingAtivos } = useQuery<TechProjetoDetalhe[]>({
    queryKey: ['/api/tech/projetos-em-andamento'],
  });

  const { data: projetosFechados, isLoading: isLoadingFechados } = useQuery<TechProjetoDetalhe[]>({
    queryKey: ['/api/tech/projetos-fechados'],
  });

  const { data: tasksPorStatus, isLoading: isLoadingTasks } = useQuery<TechTaskStatus[]>({
    queryKey: ['/api/tech/tasks-por-status'],
  });

  const { data: velocidade, isLoading: isLoadingVelocidade } = useQuery<TechVelocidade>({
    queryKey: ['/api/tech/velocidade'],
  });

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-title">Dashboard Tech</h1>
          <p className="text-muted-foreground">Gestão de Projetos de Tecnologia</p>
        </div>

        {/* KPIs Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Projetos em Andamento</CardTitle>
              <Monitor className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold text-blue-600" data-testid="text-projetos-ativos">
                  {metricas?.projetosEmAndamento || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Projetos Entregues</CardTitle>
              <Rocket className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold text-green-600" data-testid="text-projetos-fechados">
                  {metricas?.projetosFechados || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Valor Total Projetos</CardTitle>
              <DollarSign className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-purple-600" data-testid="text-valor-total">
                  {formatCurrency(metricas?.valorTotalProjetos || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Tempo Médio Entrega</CardTitle>
              <Clock className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold text-orange-600" data-testid="text-tempo-medio">
                  {Math.round(metricas?.tempoMedioEntrega || 0)} <span className="text-lg font-normal">dias</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Velocity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Entregas no Mês</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingVelocidade ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-entregas-mes">
                  {velocidade?.projetosEntreguesMes || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Taxa Cumprimento Prazo</CardTitle>
              <Target className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingVelocidade ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-taxa-prazo">
                  {(velocidade?.taxaCumprimentoPrazo || 0).toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total de Tasks</CardTitle>
              <FileCode className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-total-tasks">
                  {metricas?.totalTasks || 0}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Projetos por Status
              </CardTitle>
              <CardDescription>Distribuição dos projetos em andamento</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStatus ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={projetosPorStatus}
                      dataKey="quantidade"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {projetosPorStatus?.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, 'Projetos']} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Projects by Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Projetos por Tipo
              </CardTitle>
              <CardDescription>Tipos de projeto e valor total</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTipo ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={projetosPorTipo} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="tipo" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'quantidade' ? value : formatCurrency(value),
                        name === 'quantidade' ? 'Projetos' : 'Valor'
                      ]} 
                    />
                    <Bar dataKey="quantidade" fill="#3b82f6" name="Quantidade" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Responsavel Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Projetos por Responsável
            </CardTitle>
            <CardDescription>Performance individual dos desenvolvedores</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingResponsavel ? (
              <Skeleton className="h-[200px] w-full" />
            ) : !projetosPorResponsavel || projetosPorResponsavel.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-50" />
                <p>Nenhum responsável encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-center">Ativos</TableHead>
                    <TableHead className="text-center">Entregues</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projetosPorResponsavel.slice(0, 10).map((resp, index) => (
                    <TableRow key={index} data-testid={`row-responsavel-${index}`}>
                      <TableCell className="font-medium">{resp.responsavel || 'Não atribuído'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                          {resp.projetosAtivos}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                          {resp.projetosFechados}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(resp.valorTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Tasks por Status
            </CardTitle>
            <CardDescription>Distribuição das tasks dos projetos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTasks ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="flex flex-wrap gap-4">
                {tasksPorStatus?.map((task, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
                    data-testid={`task-status-${index}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)}`} />
                    <span className="font-medium">{task.status}</span>
                    <Badge variant="secondary">{task.quantidade}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projects Tabs */}
        <Tabs defaultValue="ativos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ativos" data-testid="tab-ativos">
              <Monitor className="h-4 w-4 mr-2" />
              Projetos em Andamento ({metricas?.projetosEmAndamento || 0})
            </TabsTrigger>
            <TabsTrigger value="fechados" data-testid="tab-fechados">
              <Rocket className="h-4 w-4 mr-2" />
              Últimos Entregues
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ativos">
            <Card>
              <CardHeader>
                <CardTitle>Projetos em Andamento</CardTitle>
                <CardDescription>Lista de todos os projetos ativos</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAtivos ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : !projetosEmAndamento || projetosEmAndamento.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Monitor className="h-12 w-12 mb-4 opacity-50" />
                    <p>Nenhum projeto em andamento encontrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Projeto</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Fase</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projetosEmAndamento.map((projeto, index) => (
                          <TableRow key={projeto.clickupTaskId} data-testid={`row-projeto-${index}`}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {projeto.taskName}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getStatusColor(projeto.statusProjeto)} text-white`}>
                                {projeto.statusProjeto}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {projeto.faseProjeto || '-'}
                            </TableCell>
                            <TableCell>{projeto.responsavel || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{projeto.tipo || '-'}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {projeto.valorP ? formatCurrency(projeto.valorP) : '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(projeto.dataVencimento)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fechados">
            <Card>
              <CardHeader>
                <CardTitle>Últimos Projetos Entregues</CardTitle>
                <CardDescription>Projetos recentemente concluídos (últimos 20)</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingFechados ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : !projetosFechados || projetosFechados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Rocket className="h-12 w-12 mb-4 opacity-50" />
                    <p>Nenhum projeto entregue encontrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Projeto</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Lançamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projetosFechados.map((projeto, index) => (
                          <TableRow key={projeto.clickupTaskId} data-testid={`row-projeto-fechado-${index}`}>
                            <TableCell className="font-medium max-w-[250px] truncate">
                              {projeto.taskName}
                            </TableCell>
                            <TableCell>{projeto.responsavel || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{projeto.tipo || '-'}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {projeto.valorP ? formatCurrency(projeto.valorP) : '-'}
                            </TableCell>
                            <TableCell className="text-green-600 font-medium">
                              {formatDate(projeto.lancamento)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
