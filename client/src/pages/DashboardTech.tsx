import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Monitor, 
  Rocket, 
  Clock, 
  DollarSign, 
  Users, 
  CheckCircle2, 
  Target,
  AlertCircle,
  Calendar,
  TrendingUp,
  ArrowRight,
  Zap
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface TechVelocidade {
  projetosEntreguesMes: number;
  tempoMedioEntrega: number;
  taxaCumprimentoPrazo: number;
}

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

const getStatusInfo = (status: string): { color: string; bgColor: string; order: number } => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('deploy') || statusLower.includes('completo') || statusLower.includes('finalizado')) {
    return { color: 'text-green-600', bgColor: 'bg-green-500', order: 5 };
  }
  if (statusLower.includes('review') || statusLower.includes('qa') || statusLower.includes('teste')) {
    return { color: 'text-purple-600', bgColor: 'bg-purple-500', order: 4 };
  }
  if (statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('dev')) {
    return { color: 'text-blue-600', bgColor: 'bg-blue-500', order: 3 };
  }
  if (statusLower.includes('design')) {
    return { color: 'text-pink-600', bgColor: 'bg-pink-500', order: 2 };
  }
  if (statusLower.includes('kickoff') || statusLower.includes('planejamento')) {
    return { color: 'text-yellow-600', bgColor: 'bg-yellow-500', order: 1 };
  }
  return { color: 'text-slate-600', bgColor: 'bg-slate-400', order: 0 };
};

const isOverdue = (dateStr: string | null) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const getDaysUntil = (dateStr: string | null) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  const { data: velocidade, isLoading: isLoadingVelocidade } = useQuery<TechVelocidade>({
    queryKey: ['/api/tech/velocidade'],
  });

  const sortedStatus = projetosPorStatus?.slice().sort((a, b) => {
    return getStatusInfo(b.status).order - getStatusInfo(a.status).order;
  }) || [];

  const totalProjetos = sortedStatus.reduce((sum, s) => sum + s.quantidade, 0);

  const projetosAtrasados = projetosEmAndamento?.filter(p => isOverdue(p.dataVencimento)) || [];
  const projetosProximos = projetosEmAndamento?.filter(p => {
    const days = getDaysUntil(p.dataVencimento);
    return days !== null && days >= 0 && days <= 7;
  }) || [];

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-title">Projetos Tech</h1>
            <p className="text-muted-foreground text-sm">Visão consolidada do pipeline de entregas</p>
          </div>
          {velocidade && !isLoadingVelocidade && (
            <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {velocidade.projetosEntreguesMes} entregas este mês
              </span>
            </div>
          )}
        </div>

        {/* Alertas - Só mostra se houver projetos atrasados */}
        {projetosAtrasados.length > 0 && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">
                    {projetosAtrasados.length} projeto{projetosAtrasados.length > 1 ? 's' : ''} atrasado{projetosAtrasados.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {projetosAtrasados.slice(0, 3).map(p => p.taskName).join(', ')}
                    {projetosAtrasados.length > 3 && ` e mais ${projetosAtrasados.length - 3}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs Principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Em Andamento</span>
                <Monitor className="h-4 w-4 text-blue-500" />
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-projetos-ativos">
                  {metricas?.projetosEmAndamento || 0}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Entregues</span>
                <Rocket className="h-4 w-4 text-green-500" />
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-projetos-fechados">
                  {metricas?.projetosFechados || 0}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Valor Total</span>
                <DollarSign className="h-4 w-4 text-purple-500" />
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-xl font-bold" data-testid="text-valor-total">
                  {formatCurrency(metricas?.valorTotalProjetos || 0)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Tempo Médio</span>
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-tempo-medio">
                  {Math.round(metricas?.tempoMedioEntrega || 0)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">dias</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Visual + Velocidade */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Pipeline de Status */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Pipeline de Projetos</CardTitle>
              <CardDescription>Distribuição por estágio de desenvolvimento</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStatus ? (
                <Skeleton className="h-[200px] w-full" />
              ) : sortedStatus.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Nenhum projeto encontrado
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedStatus.map((status, index) => {
                    const info = getStatusInfo(status.status);
                    const percent = totalProjetos > 0 ? (status.quantidade / totalProjetos) * 100 : 0;
                    return (
                      <div key={index} data-testid={`pipeline-status-${index}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${info.bgColor}`} />
                            <span className="text-sm font-medium">{status.status}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{percent.toFixed(0)}%</span>
                            <Badge variant="secondary" className="min-w-[2rem] justify-center">
                              {status.quantidade}
                            </Badge>
                          </div>
                        </div>
                        <Progress value={percent} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Métricas de Velocidade */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Performance</CardTitle>
              <CardDescription>Indicadores de velocidade</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingVelocidade ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Entregas no mês</span>
                    </div>
                    <span className="text-lg font-bold" data-testid="text-entregas-mes">
                      {velocidade?.projetosEntreguesMes || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">No prazo</span>
                    </div>
                    <span className="text-lg font-bold" data-testid="text-taxa-prazo">
                      {(velocidade?.taxaCumprimentoPrazo || 0).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">Tempo médio</span>
                    </div>
                    <span className="text-lg font-bold">
                      {Math.round(velocidade?.tempoMedioEntrega || 0)}d
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Responsáveis + Tipos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Por Responsável */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Carga por Responsável
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingResponsavel ? (
                <Skeleton className="h-[200px] w-full" />
              ) : !projetosPorResponsavel || projetosPorResponsavel.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Nenhum responsável encontrado
                </div>
              ) : (
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2">
                    {projetosPorResponsavel.slice(0, 8).map((resp, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-2 rounded-lg hover-elevate"
                        data-testid={`row-responsavel-${index}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-primary">
                              {(resp.responsavel || 'NA').substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium truncate">
                            {resp.responsavel || 'Não atribuído'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                            {resp.projetosAtivos} ativos
                          </Badge>
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            {resp.projetosFechados} entregues
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Por Tipo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Por Tipo de Projeto
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTipo ? (
                <Skeleton className="h-[200px] w-full" />
              ) : !projetosPorTipo || projetosPorTipo.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Nenhum tipo encontrado
                </div>
              ) : (
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2">
                    {projetosPorTipo.map((tipo, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-2 rounded-lg hover-elevate"
                        data-testid={`row-tipo-${index}`}
                      >
                        <span className="text-sm font-medium">{tipo.tipo || 'Não definido'}</span>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{tipo.quantidade}</Badge>
                          <span className="text-sm text-muted-foreground min-w-[80px] text-right">
                            {formatCurrency(tipo.valorTotal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Projetos em Andamento */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Projetos em Andamento
                </CardTitle>
                <CardDescription>
                  {projetosEmAndamento?.length || 0} projetos ativos
                </CardDescription>
              </div>
              {projetosProximos.length > 0 && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                  <Calendar className="h-3 w-3 mr-1" />
                  {projetosProximos.length} próximo{projetosProximos.length > 1 ? 's' : ''} do prazo
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingAtivos ? (
              <Skeleton className="h-[300px] w-full" />
            ) : !projetosEmAndamento || projetosEmAndamento.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Monitor className="h-12 w-12 mb-4 opacity-50" />
                <p>Nenhum projeto em andamento</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Prazo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projetosEmAndamento.map((projeto, index) => {
                      const statusInfo = getStatusInfo(projeto.statusProjeto);
                      const overdue = isOverdue(projeto.dataVencimento);
                      const daysUntil = getDaysUntil(projeto.dataVencimento);
                      
                      return (
                        <TableRow 
                          key={projeto.clickupTaskId} 
                          data-testid={`row-projeto-${index}`}
                          className={overdue ? 'bg-destructive/5' : ''}
                        >
                          <TableCell className="font-medium max-w-[250px]">
                            <p className="truncate">{projeto.taskName}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${statusInfo.bgColor}`} />
                              <span className="text-sm">{projeto.statusProjeto}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {projeto.responsavel || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {projeto.tipo || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {projeto.valorP ? formatCurrency(projeto.valorP) : '-'}
                          </TableCell>
                          <TableCell>
                            {projeto.dataVencimento ? (
                              <div className="flex items-center gap-1">
                                {overdue ? (
                                  <Badge variant="destructive" className="text-xs">
                                    Atrasado
                                  </Badge>
                                ) : daysUntil !== null && daysUntil <= 7 ? (
                                  <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                    {daysUntil === 0 ? 'Hoje' : `${daysUntil}d`}
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    {formatDate(projeto.dataVencimento)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimas Entregas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Últimas Entregas
            </CardTitle>
            <CardDescription>Projetos recentemente concluídos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingFechados ? (
              <Skeleton className="h-[200px] w-full" />
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
                    {projetosFechados.slice(0, 10).map((projeto, index) => (
                      <TableRow key={projeto.clickupTaskId} data-testid={`row-entrega-${index}`}>
                        <TableCell className="font-medium max-w-[250px]">
                          <p className="truncate">{projeto.taskName}</p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {projeto.responsavel || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {projeto.tipo || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {projeto.valorP ? formatCurrency(projeto.valorP) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {formatDate(projeto.lancamento)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
