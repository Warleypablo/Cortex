import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, FileText, RefreshCw, Play, CheckCircle, XCircle, Clock, AlertTriangle, EyeOff, RotateCcw, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format, subDays, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

interface AutoReportCliente {
  rowIndex: number;
  gerar: boolean;
  cliente: string;
  categoria: 'ecommerce' | 'lead_com_site' | 'lead_sem_site' | '';
  linkPainel: string;
  linkPasta: string;
  idGoogleAds: string;
  idMetaAds: string;
  idGa4: string;
  gestor: string;
  squad: string;
  status: string;
  ultimaGeracao: string;
}

interface AutoReportJob {
  id: string;
  clienteNome: string;
  categoria: string;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  mensagem?: string;
  presentationId?: string;
  presentationUrl?: string;
  downloadUrl?: string;
  fileName?: string;
  criadoEm: string;
  concluidoEm?: string;
}

function getCategoriaLabel(categoria: string): string {
  switch (categoria) {
    case 'ecommerce': return 'E-commerce';
    case 'lead_com_site': return 'Lead (Com Site)';
    case 'lead_sem_site': return 'Lead (Sem Site)';
    default: return categoria || 'Não definida';
  }
}

function getCategoriaBadgeVariant(categoria: string): "default" | "secondary" | "outline" | "destructive" {
  switch (categoria) {
    case 'ecommerce': return 'default';
    case 'lead_com_site': return 'secondary';
    case 'lead_sem_site': return 'outline';
    default: return 'outline';
  }
}

function getStatusBadge(status: string) {
  const statusLower = status?.toLowerCase() || '';
  
  if (statusLower.includes('conclu') || statusLower.includes('sucesso')) {
    return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Concluído</Badge>;
  }
  if (statusLower.includes('process')) {
    return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processando</Badge>;
  }
  if (statusLower.includes('erro')) {
    return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
  }
  if (statusLower.includes('pend')) {
    return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
  }
  
  return <Badge variant="outline">{status || 'Aguardando'}</Badge>;
}

function getDefaultDateRange(): DateRange {
  const hoje = new Date();
  const inicioSemanaPassada = startOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 });
  const fimSemanaPassada = endOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 });
  return { from: inicioSemanaPassada, to: fimSemanaPassada };
}

export default function AutoReport() {
  const { toast } = useToast();
  const [selectedClientes, setSelectedClientes] = useState<Set<number>>(new Set());
  const [filtroGestor, setFiltroGestor] = useState<string>('todos');
  const [hiddenClientes, setHiddenClientes] = useState<Set<number>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getDefaultDateRange());

  const { data: clientes = [], isLoading: loadingClientes, refetch: refetchClientes } = useQuery<AutoReportCliente[]>({
    queryKey: ['/api/autoreport/clientes'],
  });

  const { data: jobs = [], refetch: refetchJobs } = useQuery<AutoReportJob[]>({
    queryKey: ['/api/autoreport/jobs'],
    refetchInterval: 5000,
  });

  const gestores = useMemo(() => {
    const uniqueGestores = new Set(clientes.map(c => c.gestor).filter(Boolean));
    return Array.from(uniqueGestores).sort();
  }, [clientes]);

  const formatDateRange = () => {
    if (!dateRange?.from) return 'Selecionar período';
    if (!dateRange.to) return format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR });
    return `${format(dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  const setPresetRange = (preset: 'ultima_semana' | 'ultimos_7' | 'ultimos_14' | 'ultimos_30') => {
    const hoje = new Date();
    switch (preset) {
      case 'ultima_semana':
        setDateRange(getDefaultDateRange());
        break;
      case 'ultimos_7':
        setDateRange({ from: subDays(hoje, 7), to: subDays(hoje, 1) });
        break;
      case 'ultimos_14':
        setDateRange({ from: subDays(hoje, 14), to: subDays(hoje, 1) });
        break;
      case 'ultimos_30':
        setDateRange({ from: subDays(hoje, 30), to: subDays(hoje, 1) });
        break;
    }
  };

  const gerarRelatorioMutation = useMutation({
    mutationFn: async (cliente: AutoReportCliente): Promise<AutoReportJob> => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error('Selecione um período válido');
      }
      const response = await fetch('/api/autoreport/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          cliente,
          dataInicio: dateRange.from.toISOString(),
          dataFim: dateRange.to.toISOString(),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar relatório');
      }
      return response.json();
    },
    onSuccess: (data: AutoReportJob) => {
      toast({
        title: data.status === 'concluido' ? 'Relatório gerado!' : 'Relatório em processamento',
        description: data.downloadUrl 
          ? `PDF de ${data.clienteNome} pronto para download.`
          : `Processando relatório de ${data.clienteNome}...`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/autoreport/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/autoreport/clientes'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao gerar relatório',
        description: error.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    },
  });

  const gerarLoteMutation = useMutation({
    mutationFn: async (clientes: AutoReportCliente[]): Promise<AutoReportJob[]> => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error('Selecione um período válido');
      }
      const response = await fetch('/api/autoreport/gerar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          clientes,
          dataInicio: dateRange.from.toISOString(),
          dataFim: dateRange.to.toISOString(),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar relatórios');
      }
      return response.json();
    },
    onSuccess: (data: AutoReportJob[]) => {
      const concluidos = data.filter(j => j.status === 'concluido').length;
      const erros = data.filter(j => j.status === 'erro').length;
      toast({
        title: 'Geração em lote concluída',
        description: `${concluidos} relatórios gerados, ${erros} erros.`,
      });
      setSelectedClientes(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/autoreport/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/autoreport/clientes'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro na geração em lote',
        description: error.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    },
  });

  const toggleCliente = (rowIndex: number) => {
    const newSelected = new Set(selectedClientes);
    if (newSelected.has(rowIndex)) {
      newSelected.delete(rowIndex);
    } else {
      newSelected.add(rowIndex);
    }
    setSelectedClientes(newSelected);
  };

  const selectAllGerar = () => {
    const toSelect = clientesFiltrados.filter(c => c.gerar && c.categoria).map(c => c.rowIndex);
    setSelectedClientes(new Set(toSelect));
  };

  const handleGerarLote = () => {
    const clientesSelecionados = clientes.filter(c => selectedClientes.has(c.rowIndex));
    if (clientesSelecionados.length === 0) {
      toast({
        title: 'Nenhum cliente selecionado',
        description: 'Selecione pelo menos um cliente para gerar relatórios.',
        variant: 'destructive',
      });
      return;
    }
    gerarLoteMutation.mutate(clientesSelecionados);
  };

  const hideCliente = (rowIndex: number) => {
    const newHidden = new Set(hiddenClientes);
    newHidden.add(rowIndex);
    setHiddenClientes(newHidden);
    const newSelected = new Set(selectedClientes);
    newSelected.delete(rowIndex);
    setSelectedClientes(newSelected);
    toast({
      title: 'Cliente oculto',
      description: 'O cliente foi removido da lista. Use "Restaurar Ocultos" para trazer de volta.',
    });
  };

  const restoreHidden = () => {
    setHiddenClientes(new Set());
    toast({
      title: 'Clientes restaurados',
      description: `${hiddenClientes.size} cliente(s) foram restaurados à lista.`,
    });
  };

  const clientesValidos = clientes.filter(c => c.categoria);
  const clientesParaGerar = clientes.filter(c => c.gerar && c.categoria);
  
  const clientesFiltrados = useMemo(() => {
    return clientesValidos.filter(c => {
      if (hiddenClientes.has(c.rowIndex)) return false;
      if (filtroGestor !== 'todos' && c.gestor !== filtroGestor) return false;
      return true;
    });
  }, [clientesValidos, hiddenClientes, filtroGestor]);

  return (
    <div className="p-6 space-y-6" data-testid="autoreport-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Auto Report</h1>
          <p className="text-muted-foreground">
            Geração automática de relatórios semanais para clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => { refetchClientes(); refetchJobs(); }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Período do Relatório</CardTitle>
          <CardDescription>Selecione o intervalo de datas para coleta de métricas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[260px] justify-start text-left" data-testid="button-date-picker">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateRange()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPresetRange('ultima_semana')} data-testid="button-preset-semana">
                Última Semana
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPresetRange('ultimos_7')} data-testid="button-preset-7">
                Últimos 7 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPresetRange('ultimos_14')} data-testid="button-preset-14">
                Últimos 14 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPresetRange('ultimos_30')} data-testid="button-preset-30">
                Últimos 30 dias
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-clientes">{clientesValidos.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marcados para Gerar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-para-gerar">{clientesParaGerar.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Selecionados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-selecionados">{selectedClientes.size}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jobs Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-jobs-recentes">{jobs.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle>Clientes</CardTitle>
                <CardDescription>
                  {clientesFiltrados.length} de {clientesValidos.length} clientes
                  {hiddenClientes.size > 0 && ` (${hiddenClientes.size} ocultos)`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filtroGestor} onValueChange={setFiltroGestor}>
                  <SelectTrigger className="w-[180px]" data-testid="select-gestor">
                    <SelectValue placeholder="Filtrar por gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Gestores</SelectItem>
                    {gestores.map(gestor => (
                      <SelectItem key={gestor} value={gestor}>{gestor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hiddenClientes.size > 0 && (
                  <Button variant="outline" size="sm" onClick={restoreHidden} data-testid="button-restore-hidden">
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Restaurar ({hiddenClientes.size})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={selectAllGerar} data-testid="button-select-all">
                  Selecionar Todos
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleGerarLote}
                  disabled={selectedClientes.size === 0 || gerarLoteMutation.isPending}
                  data-testid="button-gerar-lote"
                >
                  {gerarLoteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Gerar ({selectedClientes.size})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingClientes ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                {clientesValidos.length === 0 ? (
                  <>
                    <p>Nenhum cliente encontrado na planilha central.</p>
                    <p className="text-sm mt-2">Verifique se a planilha está configurada corretamente.</p>
                  </>
                ) : (
                  <>
                    <p>Nenhum cliente corresponde aos filtros aplicados.</p>
                    <p className="text-sm mt-2">Altere o filtro de gestor ou restaure os clientes ocultos.</p>
                  </>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {clientesFiltrados.map((cliente) => (
                    <div 
                      key={cliente.rowIndex}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        selectedClientes.has(cliente.rowIndex) ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/50'
                      }`}
                      data-testid={`row-cliente-${cliente.rowIndex}`}
                    >
                      <Checkbox
                        checked={selectedClientes.has(cliente.rowIndex)}
                        onCheckedChange={() => toggleCliente(cliente.rowIndex)}
                        data-testid={`checkbox-cliente-${cliente.rowIndex}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{cliente.cliente}</span>
                          {cliente.gerar && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              Auto
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <span>{cliente.gestor || 'Sem gestor'}</span>
                          <span>•</span>
                          <span>{cliente.squad || 'Sem squad'}</span>
                        </div>
                      </div>
                      <Badge variant={getCategoriaBadgeVariant(cliente.categoria)}>
                        {getCategoriaLabel(cliente.categoria)}
                      </Badge>
                      {getStatusBadge(cliente.status)}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => gerarRelatorioMutation.mutate(cliente)}
                          disabled={gerarRelatorioMutation.isPending}
                          title="Gerar relatório"
                          data-testid={`button-gerar-${cliente.rowIndex}`}
                        >
                          {gerarRelatorioMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => hideCliente(cliente.rowIndex)}
                          title="Ocultar da lista"
                          data-testid={`button-hide-${cliente.rowIndex}`}
                        >
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jobs Recentes</CardTitle>
            <CardDescription>Histórico de relatórios gerados</CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum relatório gerado ainda</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <div 
                      key={job.id}
                      className="p-3 rounded-lg border space-y-2"
                      data-testid={`job-${job.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{job.clienteNome}</span>
                        {job.status === 'concluido' && (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            OK
                          </Badge>
                        )}
                        {job.status === 'processando' && (
                          <Badge variant="secondary">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ...
                          </Badge>
                        )}
                        {job.status === 'erro' && (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Erro
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(job.criadoEm).toLocaleString('pt-BR')}
                      </div>
                      {job.downloadUrl && (
                        <a 
                          href={job.downloadUrl}
                          download={job.fileName || 'relatorio.pdf'}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          data-testid={`link-download-${job.id}`}
                        >
                          <FileText className="w-3 h-3" />
                          Baixar PDF
                        </a>
                      )}
                      {job.mensagem && (
                        <div className="text-xs text-destructive">{job.mensagem}</div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
