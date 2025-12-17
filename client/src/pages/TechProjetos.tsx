import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  FolderOpen, 
  FolderCheck, 
  Clock, 
  User, 
  Search,
  Timer,
  Target,
  TrendingUp,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface TechTempoResponsavel {
  responsavel: string;
  totalEntregas: number;
  tempoMedioEntrega: number;
  taxaNoPrazo: number;
  valorTotalEntregue: number;
}

interface TechProjetoResponsavel {
  responsavel: string;
  projetosAtivos: number;
  projetosFechados: number;
  valorTotal: number;
}

interface TechProjetoTipo {
  tipo: string;
  quantidade: number;
  valorTotal: number;
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

const getStatusInfo = (status: string): { bgColor: string } => {
  const statusLower = status?.toLowerCase() || '';
  if (statusLower.includes('deploy') || statusLower.includes('completo') || statusLower.includes('finalizado')) {
    return { bgColor: 'bg-green-500' };
  }
  if (statusLower.includes('review') || statusLower.includes('qa') || statusLower.includes('teste')) {
    return { bgColor: 'bg-purple-500' };
  }
  if (statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('dev')) {
    return { bgColor: 'bg-blue-500' };
  }
  if (statusLower.includes('design')) {
    return { bgColor: 'bg-pink-500' };
  }
  if (statusLower.includes('kickoff') || statusLower.includes('planejamento')) {
    return { bgColor: 'bg-yellow-500' };
  }
  return { bgColor: 'bg-slate-400' };
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

const getDaysFromCreation = (dateStr: string | null) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - date.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function TechProjetos() {
  const [activeTab, setActiveTab] = useState<'abertos' | 'fechados'>('abertos');
  const [responsavelFilter, setResponsavelFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'data' | 'valor' | 'prazo'>('data');

  const { data: tempoResponsavel, isLoading: isLoadingTempo } = useQuery<TechTempoResponsavel[]>({
    queryKey: ['/api/tech/tempo-responsavel'],
  });

  const { data: responsaveis, isLoading: isLoadingResp } = useQuery<TechProjetoResponsavel[]>({
    queryKey: ['/api/tech/projetos-por-responsavel'],
  });

  const { data: tipos, isLoading: isLoadingTipos } = useQuery<TechProjetoTipo[]>({
    queryKey: ['/api/tech/projetos-por-tipo'],
  });

  const { data: projetos, isLoading: isLoadingProjetos } = useQuery<TechProjetoDetalhe[]>({
    queryKey: ['/api/tech/projetos', activeTab, responsavelFilter, tipoFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('tipo', activeTab);
      if (responsavelFilter !== 'todos') params.set('responsavel', responsavelFilter);
      if (tipoFilter !== 'todos') params.set('tipoP', tipoFilter);
      const res = await fetch(`/api/tech/projetos?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const uniqueResponsaveis = useMemo(() => {
    return responsaveis?.map(r => r.responsavel).filter(r => r && r !== 'Não atribuído') || [];
  }, [responsaveis]);

  const uniqueTipos = useMemo(() => {
    return tipos?.map(t => t.tipo).filter(t => t && t !== 'Não definido') || [];
  }, [tipos]);

  const filteredProjetos = useMemo(() => {
    let result = projetos || [];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.taskName?.toLowerCase().includes(term) ||
        p.responsavel?.toLowerCase().includes(term) ||
        p.tipo?.toLowerCase().includes(term)
      );
    }

    if (sortBy === 'valor') {
      result = [...result].sort((a, b) => (b.valorP || 0) - (a.valorP || 0));
    } else if (sortBy === 'prazo' && activeTab === 'abertos') {
      result = [...result].sort((a, b) => {
        if (!a.dataVencimento) return 1;
        if (!b.dataVencimento) return -1;
        return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
      });
    }

    return result;
  }, [projetos, searchTerm, sortBy, activeTab]);

  const totalValor = filteredProjetos.reduce((sum, p) => sum + (p.valorP || 0), 0);
  const projetosAtrasados = activeTab === 'abertos' 
    ? filteredProjetos.filter(p => isOverdue(p.dataVencimento)).length 
    : 0;

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-title">Projetos Tech</h1>
          <p className="text-muted-foreground text-sm">Gestão detalhada de projetos e performance da equipe</p>
        </div>

        {/* Tempo de Entrega por Responsável */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Performance por Responsável
            </CardTitle>
            <CardDescription>Tempo médio de entrega e taxa de cumprimento de prazo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTempo ? (
              <Skeleton className="h-[200px] w-full" />
            ) : !tempoResponsavel || tempoResponsavel.length === 0 ? (
              <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                Nenhum dado de entrega encontrado
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tempoResponsavel.slice(0, 8).map((resp, index) => (
                  <div 
                    key={index}
                    className="p-4 rounded-lg border bg-card hover-elevate"
                    data-testid={`card-responsavel-${index}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {(resp.responsavel || 'NA').substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium truncate">{resp.responsavel}</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Entregas
                        </span>
                        <span className="font-medium">{resp.totalEntregas}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Tempo médio
                        </span>
                        <span className="font-medium">{Math.round(resp.tempoMedioEntrega)}d</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          No prazo
                        </span>
                        <Badge 
                          variant="outline" 
                          className={resp.taxaNoPrazo >= 80 
                            ? 'bg-green-500/10 text-green-600 border-green-500/30' 
                            : resp.taxaNoPrazo >= 60 
                              ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                              : 'bg-red-500/10 text-red-600 border-red-500/30'
                          }
                        >
                          {resp.taxaNoPrazo?.toFixed(0) || 0}%
                        </Badge>
                      </div>
                      
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Valor entregue
                          </span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(resp.valorTotalEntregue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs Abertos/Fechados + Filtros */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'abertos' | 'fechados')}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="abertos" data-testid="tab-abertos" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Projetos Abertos
              </TabsTrigger>
              <TabsTrigger value="fechados" data-testid="tab-fechados" className="gap-2">
                <FolderCheck className="h-4 w-4" />
                Projetos Fechados
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar projeto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[180px]"
                  data-testid="input-search"
                />
              </div>

              <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-responsavel">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {uniqueResponsaveis.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-tipo">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {uniqueTipos.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[130px]" data-testid="select-ordenar">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="data">Data</SelectItem>
                  <SelectItem value="valor">Valor</SelectItem>
                  {activeTab === 'abertos' && <SelectItem value="prazo">Prazo</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Total</span>
                  {activeTab === 'abertos' ? <FolderOpen className="h-4 w-4 text-blue-500" /> : <FolderCheck className="h-4 w-4 text-green-500" />}
                </div>
                <p className="text-2xl font-bold" data-testid="text-total-projetos">
                  {filteredProjetos.length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Valor Total</span>
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-xl font-bold" data-testid="text-valor-total">
                  {formatCurrency(totalValor)}
                </p>
              </CardContent>
            </Card>

            {activeTab === 'abertos' && (
              <>
                <Card className={projetosAtrasados > 0 ? 'border-destructive/50' : ''}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Atrasados</span>
                      <AlertCircle className={`h-4 w-4 ${projetosAtrasados > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </div>
                    <p className={`text-2xl font-bold ${projetosAtrasados > 0 ? 'text-destructive' : ''}`} data-testid="text-atrasados">
                      {projetosAtrasados}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Próximos 7d</span>
                      <Calendar className="h-4 w-4 text-yellow-500" />
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-proximos">
                      {filteredProjetos.filter(p => {
                        const days = getDaysUntil(p.dataVencimento);
                        return days !== null && days >= 0 && days <= 7;
                      }).length}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === 'fechados' && (
              <>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Responsáveis</span>
                      <User className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold">
                      {new Set(filteredProjetos.map(p => p.responsavel).filter(Boolean)).size}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Tipos</span>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-2xl font-bold">
                      {new Set(filteredProjetos.map(p => p.tipo).filter(Boolean)).size}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Lista de Projetos */}
          <Card>
            <CardContent className="p-0">
              {isLoadingProjetos ? (
                <div className="p-6">
                  <Skeleton className="h-[400px] w-full" />
                </div>
              ) : !filteredProjetos || filteredProjetos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  {activeTab === 'abertos' ? <FolderOpen className="h-12 w-12 mb-4 opacity-50" /> : <FolderCheck className="h-12 w-12 mb-4 opacity-50" />}
                  <p>Nenhum projeto encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[250px]">Projeto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        {activeTab === 'abertos' ? (
                          <>
                            <TableHead>Idade</TableHead>
                            <TableHead>Prazo</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>Tempo</TableHead>
                            <TableHead>Lançamento</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjetos.map((projeto, index) => {
                        const statusInfo = getStatusInfo(projeto.statusProjeto);
                        const overdue = activeTab === 'abertos' && isOverdue(projeto.dataVencimento);
                        const daysUntil = getDaysUntil(projeto.dataVencimento);
                        const daysFromCreation = getDaysFromCreation(projeto.dataCriada);
                        const deliveryTime = projeto.lancamento && projeto.dataCriada 
                          ? Math.ceil((new Date(projeto.lancamento).getTime() - new Date(projeto.dataCriada).getTime()) / (1000 * 60 * 60 * 24))
                          : null;

                        return (
                          <TableRow 
                            key={projeto.clickupTaskId} 
                            data-testid={`row-projeto-${index}`}
                            className={overdue ? 'bg-destructive/5' : ''}
                          >
                            <TableCell className="font-medium">
                              <p className="truncate max-w-[300px]">{projeto.taskName}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${statusInfo.bgColor}`} />
                                <span className="text-sm">{projeto.statusProjeto || '-'}</span>
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
                            
                            {activeTab === 'abertos' ? (
                              <>
                                <TableCell className="text-sm text-muted-foreground">
                                  {daysFromCreation !== null ? `${daysFromCreation}d` : '-'}
                                </TableCell>
                                <TableCell>
                                  {projeto.dataVencimento ? (
                                    overdue ? (
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
                                    )
                                  ) : (
                                    <span className="text-sm text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="text-sm">
                                  {deliveryTime !== null ? (
                                    <Badge variant="outline" className={
                                      deliveryTime <= 30 
                                        ? 'bg-green-500/10 text-green-600 border-green-500/30'
                                        : deliveryTime <= 60 
                                          ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                                          : 'bg-red-500/10 text-red-600 border-red-500/30'
                                    }>
                                      {deliveryTime}d
                                    </Badge>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm text-green-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {formatDate(projeto.lancamento)}
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
