import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, CalendarDays, Clock, User, CheckCircle, XCircle, Loader2, ChevronLeft, ChevronRight, Plus, ChevronsUpDown, Check, Search, Pencil, Trash2, UserCheck, Users, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isWithinInterval, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UnavailabilityRequest {
  id: number;
  colaborador_id: number;
  colaborador_nome: string;
  colaborador_email: string | null;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
  status: 'pendente' | 'aprovado' | 'reprovado';
  status_rh: 'pendente' | 'aprovado' | 'reprovado';
  status_lider: 'pendente' | 'aprovado' | 'reprovado';
  aprovador_rh_nome: string | null;
  aprovador_lider_nome: string | null;
  data_aprovacao_rh: string | null;
  data_aprovacao_lider: string | null;
  observacao_rh: string | null;
  observacao_lider: string | null;
  aprovador_nome: string | null;
  data_aprovacao: string | null;
  observacao_aprovador: string | null;
  data_admissao: string | null;
  meses_empresa: number | null;
  squad_nome: string | null;
  created_at: string;
}

interface Colaborador {
  id: number;
  nome: string;
  status: string | null;
  squad?: string | null;
}

const COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-amber-500',
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarioFerias() {
  usePageTitle("Calendário de Férias");
  useSetPageInfo("Calendário de Férias", "Visualizar e alinhar períodos de indisponibilidade dos prestadores");

  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<UnavailabilityRequest | null>(null);
  const [actionType, setActionType] = useState<'aprovar' | 'reprovar' | null>(null);
  const [observacao, setObservacao] = useState('');
  const [activeTab, setActiveTab] = useState('calendario');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>('');
  const [novaDataInicio, setNovaDataInicio] = useState('');
  const [novaDataFim, setNovaDataFim] = useState('');
  const [novoMotivo, setNovoMotivo] = useState('');
  const [comboboxOpen, setComboboxOpen] = useState(false);
  
  const [squadFilter, setSquadFilter] = useState<string>('all');
  const [approvalType, setApprovalType] = useState<'rh' | 'lider' | null>(null);
  
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRequest, setEditingRequest] = useState<UnavailabilityRequest | null>(null);
  const [editDataInicio, setEditDataInicio] = useState('');
  const [editDataFim, setEditDataFim] = useState('');
  const [editMotivo, setEditMotivo] = useState('');
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState<UnavailabilityRequest | null>(null);

  const { data: squads = [] } = useQuery<string[]>({
    queryKey: ["/api/unavailability-requests/squads"],
  });

  const { data: pendingRequests = [], isLoading: isLoadingPending, refetch: refetchPending } = useQuery<UnavailabilityRequest[]>({
    queryKey: ["/api/unavailability-requests", { status: "pendente", squadNome: squadFilter !== 'all' ? squadFilter : undefined }],
  });

  const { data: approvedRequests = [], isLoading: isLoadingApproved, refetch: refetchApproved } = useQuery<UnavailabilityRequest[]>({
    queryKey: ["/api/unavailability-requests", { status: "aprovado" }],
  });

  const { data: colaboradores = [] } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores/dropdown"],
  });

  const colaboradoresAtivos = useMemo(() => {
    return colaboradores.filter(c => c.status?.toLowerCase() === 'ativo');
  }, [colaboradores]);

  const approvalMutation = useMutation({
    mutationFn: async (data: { id: number; approvalType: 'rh' | 'lider'; status: string; aprovadorEmail?: string; aprovadorNome?: string; observacao?: string }) => {
      return await apiRequest("PATCH", `/api/unavailability-requests/${data.id}/approve`, data);
    },
    onSuccess: () => {
      const typeLabel = approvalType === 'rh' ? 'RH' : 'Líder';
      toast({ 
        title: actionType === 'aprovar' ? `Alinhamento ${typeLabel} confirmado` : `Alinhamento ${typeLabel} negado`,
        description: `O alinhamento do ${typeLabel} foi ${actionType === 'aprovar' ? 'confirmado' : 'negado'} com sucesso.`,
      });
      setSelectedRequest(null);
      setActionType(null);
      setApprovalType(null);
      setObservacao('');
      queryClient.invalidateQueries({ queryKey: ["/api/unavailability-requests"] });
      refetchPending();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: { id: number; dataInicio: string; dataFim: string; motivo?: string }) => {
      return await apiRequest("PUT", `/api/unavailability-requests/${data.id}`, data);
    },
    onSuccess: () => {
      toast({ 
        title: "Período atualizado",
        description: "As datas do período foram atualizadas com sucesso.",
      });
      setShowEditDialog(false);
      setEditingRequest(null);
      queryClient.invalidateQueries({ queryKey: ["/api/unavailability-requests"] });
      refetchApproved();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/unavailability-requests/${id}?fromCalendar=true`);
    },
    onSuccess: () => {
      toast({ 
        title: "Período excluído",
        description: "O período foi removido do calendário.",
      });
      setShowDeleteDialog(false);
      setDeletingRequest(null);
      queryClient.invalidateQueries({ queryKey: ["/api/unavailability-requests"] });
      refetchApproved();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { colaboradorId: number; colaboradorNome: string; dataInicio: string; dataFim: string; motivo?: string }) => {
      return await apiRequest("POST", "/api/unavailability-requests", data);
    },
    onSuccess: () => {
      toast({ 
        title: "Indisponibilidade registrada",
        description: "O período de indisponibilidade foi adicionado ao calendário.",
      });
      setShowAddDialog(false);
      resetAddForm();
      queryClient.invalidateQueries({ queryKey: ["/api/unavailability-requests"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const resetAddForm = () => {
    setSelectedColaboradorId('');
    setNovaDataInicio('');
    setNovaDataFim('');
    setNovoMotivo('');
    setComboboxOpen(false);
  };

  const handleAction = (req: UnavailabilityRequest, action: 'aprovar' | 'reprovar', type: 'rh' | 'lider') => {
    setSelectedRequest(req);
    setActionType(action);
    setApprovalType(type);
    setObservacao('');
  };

  const handleConfirm = () => {
    if (!selectedRequest || !actionType || !approvalType) return;
    
    approvalMutation.mutate({
      id: selectedRequest.id,
      approvalType: approvalType,
      status: actionType === 'aprovar' ? 'aprovado' : 'reprovado',
      aprovadorEmail: user?.email || undefined,
      aprovadorNome: user?.name || undefined,
      observacao: observacao || undefined,
    });
  };

  const handleEditClick = (req: UnavailabilityRequest) => {
    setEditingRequest(req);
    setEditDataInicio(req.data_inicio.split('T')[0]);
    setEditDataFim(req.data_fim.split('T')[0]);
    setEditMotivo(req.motivo || '');
    setShowEditDialog(true);
  };

  const handleEditSubmit = () => {
    if (!editingRequest || !editDataInicio || !editDataFim) return;
    
    editMutation.mutate({
      id: editingRequest.id,
      dataInicio: editDataInicio,
      dataFim: editDataFim,
      motivo: editMotivo || undefined,
    });
  };

  const handleDeleteClick = (req: UnavailabilityRequest) => {
    setDeletingRequest(req);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (!deletingRequest) return;
    deleteMutation.mutate(deletingRequest.id);
  };

  const handleAddSubmit = () => {
    if (!selectedColaboradorId || !novaDataInicio || !novaDataFim) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    const colaborador = colaboradoresAtivos.find(c => c.id === parseInt(selectedColaboradorId));
    if (!colaborador) {
      toast({ title: "Erro", description: "Colaborador não encontrado", variant: "destructive" });
      return;
    }

    const inicio = new Date(novaDataInicio);
    const fim = new Date(novaDataFim);
    const diffDays = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      toast({ title: "Erro", description: "Data de fim deve ser posterior à data de início", variant: "destructive" });
      return;
    }
    if (diffDays > 7) {
      toast({ title: "Erro", description: "Período máximo de 7 dias", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      dataInicio: novaDataInicio,
      dataFim: novaDataFim,
      motivo: novoMotivo || undefined,
    });
  };

  const handleDataInicioChange = (value: string) => {
    setNovaDataInicio(value);
    if (value && !novaDataFim) {
      setNovaDataFim(value);
    }
  };

  const formatTempoEmpresa = (meses: number | null) => {
    if (meses === null) return 'N/A';
    if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    const anos = Math.floor(meses / 12);
    const mesesRestantes = meses % 12;
    if (mesesRestantes === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
    return `${anos}a ${mesesRestantes}m`;
  };

  const colaboradorColors = useMemo(() => {
    const colorMap = new Map<number, string>();
    approvedRequests.forEach((req) => {
      if (!colorMap.has(req.colaborador_id)) {
        colorMap.set(req.colaborador_id, COLORS[colorMap.size % COLORS.length]);
      }
    });
    return colorMap;
  }, [approvedRequests]);

  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const startPadding = getDay(monthStart);
    
    return { days, startPadding, monthStart, monthEnd };
  }, [currentDate]);

  const getVacationsForDay = (date: Date) => {
    return approvedRequests.filter(req => {
      const start = parseISO(req.data_inicio);
      const end = parseISO(req.data_fim);
      return isWithinInterval(date, { start, end });
    });
  };

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const uniqueCollaborators = useMemo(() => {
    const seen = new Set<number>();
    return approvedRequests.filter(req => {
      if (seen.has(req.colaborador_id)) return false;
      seen.add(req.colaborador_id);
      return true;
    });
  }, [approvedRequests]);

  return (
    <div className="p-6 space-y-6" data-testid="page-calendario-ferias">
      <Card className="border-orange-200 dark:border-orange-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Calendário de Indisponibilidade</CardTitle>
                <CardDescription>Visualizar e alinhar períodos de indisponibilidade dos prestadores</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingRequests.length > 0 && (
                <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300">
                  {pendingRequests.length} pendente{pendingRequests.length > 1 ? 's' : ''}
                </Badge>
              )}
              <Button onClick={() => setShowAddDialog(true)} className="gap-2" data-testid="button-add-unavailability">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
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
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={goToPreviousMonth} data-testid="button-prev-month">
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={goToNextMonth} data-testid="button-next-month">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <h2 className="text-lg font-semibold capitalize ml-2">
                        {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                      </h2>
                    </div>
                    <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
                      Hoje
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-7 bg-muted/50">
                      {WEEKDAYS.map((day) => (
                        <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-b">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {Array.from({ length: calendarData.startPadding }).map((_, i) => (
                        <div key={`empty-${i}`} className="min-h-[80px] p-1 border-b border-r bg-muted/20" />
                      ))}
                      {calendarData.days.map((day) => {
                        const vacations = getVacationsForDay(day);
                        const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                        const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                        
                        return (
                          <div 
                            key={day.toISOString()} 
                            className={`min-h-[80px] p-1 border-b border-r relative ${isWeekend ? 'bg-muted/30' : ''}`}
                            data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                          >
                            <div className={`text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-orange-500 text-white' : ''}`}>
                              {format(day, 'd')}
                            </div>
                            <div className="space-y-0.5 overflow-hidden">
                              {vacations.slice(0, 3).map((vac) => (
                                <Tooltip key={vac.id}>
                                  <TooltipTrigger asChild>
                                    <div 
                                      className={`text-xs text-white px-1 py-0.5 rounded truncate cursor-pointer ${colaboradorColors.get(vac.colaborador_id)}`}
                                      data-testid={`vacation-badge-${vac.id}`}
                                    >
                                      {vac.colaborador_nome.split(' ')[0]}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <div className="text-sm">
                                      <p className="font-medium">{vac.colaborador_nome}</p>
                                      <p className="text-muted-foreground">
                                        {format(parseISO(vac.data_inicio), "dd/MM", { locale: ptBR })} - {format(parseISO(vac.data_fim), "dd/MM", { locale: ptBR })}
                                      </p>
                                      {vac.motivo && <p className="text-xs mt-1">{vac.motivo}</p>}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                              {vacations.length > 3 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-xs text-muted-foreground px-1 cursor-pointer">
                                      +{vacations.length - 3} mais
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <div className="space-y-1">
                                      {vacations.slice(3).map((vac) => (
                                        <p key={vac.id} className="text-sm">{vac.colaborador_nome}</p>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {uniqueCollaborators.length > 0 && (
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                      <h3 className="text-sm font-medium mb-2 text-muted-foreground">Legenda</h3>
                      <div className="flex flex-wrap gap-2">
                        {uniqueCollaborators.map((req) => (
                          <div key={req.colaborador_id} className="flex items-center gap-1.5">
                            <div className={`w-3 h-3 rounded ${colaboradorColors.get(req.colaborador_id)}`} />
                            <span className="text-sm">{req.colaborador_nome}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {approvedRequests.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Períodos Aprovados (editar/excluir)
                      </h3>
                      <div className="space-y-2">
                        {approvedRequests.map((req) => (
                          <div 
                            key={req.id} 
                            className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50"
                            data-testid={`period-${req.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded ${colaboradorColors.get(req.colaborador_id)}`} />
                              <div>
                                <span className="font-medium">{req.colaborador_nome}</span>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(req.data_inicio), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(req.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                                  {req.motivo && <span className="ml-2">• {req.motivo}</span>}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleEditClick(req)}
                                    data-testid={`button-edit-${req.id}`}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar período</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleDeleteClick(req)}
                                    data-testid={`button-delete-${req.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Excluir período</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pendentes">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Filtrar por Squad:</span>
                </div>
                <Select value={squadFilter} onValueChange={setSquadFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-squad-filter">
                    <SelectValue placeholder="Todos os squads" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os squads</SelectItem>
                    {squads.map((squad) => (
                      <SelectItem key={squad} value={squad}>{squad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {isLoadingPending ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma solicitação pendente de alinhamento{squadFilter !== 'all' ? ` para o squad ${squadFilter}` : ''}.</p>
                </div>
              ) : (
                <Table data-testid="table-unavailability-approvals">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Status de Alinhamento</TableHead>
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
                              {req.squad_nome && (
                                <p className="text-xs text-muted-foreground">{req.squad_nome}</p>
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
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">RH:</span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  req.status_rh === 'aprovado' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300",
                                  req.status_rh === 'pendente' && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300",
                                  req.status_rh === 'reprovado' && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300"
                                )}
                              >
                                {req.status_rh === 'aprovado' ? 'Alinhado' : req.status_rh === 'pendente' ? 'Pendente' : 'Não Alinhado'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Líder:</span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  req.status_lider === 'aprovado' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300",
                                  req.status_lider === 'pendente' && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300",
                                  req.status_lider === 'reprovado' && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300"
                                )}
                              >
                                {req.status_lider === 'aprovado' ? 'Alinhado' : req.status_lider === 'pendente' ? 'Pendente' : 'Não Alinhado'}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{req.motivo || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(req.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col gap-2">
                            {req.status_rh === 'pendente' && (
                              <div className="flex gap-1 justify-end">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1 text-green-600"
                                      onClick={() => handleAction(req, 'aprovar', 'rh')}
                                      data-testid={`button-alinhar-rh-${req.id}`}
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      RH
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Alinhar como RH</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1 text-red-600"
                                      onClick={() => handleAction(req, 'reprovar', 'rh')}
                                      data-testid={`button-nao-alinhar-rh-${req.id}`}
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Não alinhar como RH</TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                            {req.status_lider === 'pendente' && (
                              <div className="flex gap-1 justify-end">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1 text-green-600"
                                      onClick={() => handleAction(req, 'aprovar', 'lider')}
                                      data-testid={`button-alinhar-lider-${req.id}`}
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Líder
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Alinhar como Líder</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1 text-red-600"
                                      onClick={() => handleAction(req, 'reprovar', 'lider')}
                                      data-testid={`button-nao-alinhar-lider-${req.id}`}
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Não alinhar como Líder</TooltipContent>
                                </Tooltip>
                              </div>
                            )}
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

      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetAddForm(); }}>
        <DialogContent data-testid="dialog-add-unavailability">
          <DialogHeader>
            <DialogTitle>Adicionar Período de Indisponibilidade</DialogTitle>
            <DialogDescription>
              Registre manualmente um período de férias ou indisponibilidade para um colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="colaborador">Colaborador *</Label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between font-normal"
                    data-testid="select-colaborador"
                  >
                    {selectedColaboradorId
                      ? colaboradoresAtivos.find((c) => c.id.toString() === selectedColaboradorId)?.nome
                      : "Pesquisar colaborador..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por nome..." data-testid="input-search-colaborador" />
                    <CommandList>
                      <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                      <CommandGroup>
                        {colaboradoresAtivos.map((colab) => (
                          <CommandItem
                            key={colab.id}
                            value={colab.nome}
                            onSelect={() => {
                              setSelectedColaboradorId(colab.id.toString());
                              setComboboxOpen(false);
                            }}
                            data-testid={`option-colaborador-${colab.id}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedColaboradorId === colab.id.toString() ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {colab.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataInicio">Data Início *</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={novaDataInicio}
                  onChange={(e) => handleDataInicioChange(e.target.value)}
                  data-testid="input-data-inicio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataFim">Data Fim *</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={novaDataFim}
                  onChange={(e) => setNovaDataFim(e.target.value)}
                  min={novaDataInicio}
                  max={novaDataInicio ? format(addDays(parseISO(novaDataInicio), 7), 'yyyy-MM-dd') : undefined}
                  disabled={!novaDataInicio}
                  data-testid="input-data-fim"
                />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Período máximo: 7 dias
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo (opcional)</Label>
              <Textarea
                id="motivo"
                value={novoMotivo}
                onChange={(e) => setNovoMotivo(e.target.value)}
                placeholder="Ex: Férias, viagem, compromisso pessoal..."
                rows={2}
                data-testid="input-motivo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetAddForm(); }} data-testid="button-cancelar-add">
              Cancelar
            </Button>
            <Button
              onClick={handleAddSubmit}
              disabled={createMutation.isPending || !selectedColaboradorId || !novaDataInicio || !novaDataFim}
              data-testid="button-confirmar-add"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRequest && !!actionType && !!approvalType} onOpenChange={() => { setSelectedRequest(null); setActionType(null); setApprovalType(null); }}>
        <DialogContent data-testid="dialog-confirm-action">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'aprovar' ? 'Alinhar' : 'Não Alinhar'} como {approvalType === 'rh' ? 'RH' : 'Líder'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  <strong>{selectedRequest.colaborador_nome}</strong> solicitou indisponibilidade de{' '}
                  <strong>{format(new Date(selectedRequest.data_inicio), "dd/MM/yyyy", { locale: ptBR })}</strong>{' '}
                  a <strong>{format(new Date(selectedRequest.data_fim), "dd/MM/yyyy", { locale: ptBR })}</strong>.
                  <br /><br />
                  <span className="text-muted-foreground">
                    Você está {actionType === 'aprovar' ? 'alinhando' : 'não alinhando'} esta solicitação como <strong>{approvalType === 'rh' ? 'RH' : 'Líder'}</strong>.
                    {actionType === 'aprovar' && ' O período só será adicionado ao calendário após ambos os alinhamentos (RH e Líder) serem confirmados.'}
                  </span>
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
            <Button variant="outline" onClick={() => { setSelectedRequest(null); setActionType(null); setApprovalType(null); }} data-testid="button-cancelar-dialog">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={approvalMutation.isPending}
              className={actionType === 'aprovar' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              data-testid="button-confirmar-acao"
            >
              {approvalMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmar {actionType === 'aprovar' ? 'Alinhamento' : 'Não Alinhamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) setEditingRequest(null); }}>
        <DialogContent data-testid="dialog-edit-unavailability">
          <DialogHeader>
            <DialogTitle>Editar Período</DialogTitle>
            <DialogDescription>
              {editingRequest && (
                <>
                  Editando período de indisponibilidade de <strong>{editingRequest.colaborador_nome}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editDataInicio">Data Início *</Label>
                <Input
                  id="editDataInicio"
                  type="date"
                  value={editDataInicio}
                  onChange={(e) => setEditDataInicio(e.target.value)}
                  data-testid="input-edit-data-inicio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDataFim">Data Fim *</Label>
                <Input
                  id="editDataFim"
                  type="date"
                  value={editDataFim}
                  onChange={(e) => setEditDataFim(e.target.value)}
                  min={editDataInicio}
                  max={editDataInicio ? format(addDays(parseISO(editDataInicio), 7), 'yyyy-MM-dd') : undefined}
                  data-testid="input-edit-data-fim"
                />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Período máximo: 7 dias
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="editMotivo">Motivo (opcional)</Label>
              <Textarea
                id="editMotivo"
                value={editMotivo}
                onChange={(e) => setEditMotivo(e.target.value)}
                placeholder="Ex: Férias, viagem, compromisso pessoal..."
                rows={2}
                data-testid="input-edit-motivo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingRequest(null); }} data-testid="button-cancelar-edit">
              Cancelar
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={editMutation.isPending || !editDataInicio || !editDataFim}
              data-testid="button-confirmar-edit"
            >
              {editMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setDeletingRequest(null); }}>
        <DialogContent data-testid="dialog-delete-unavailability">
          <DialogHeader>
            <DialogTitle>Excluir Período</DialogTitle>
            <DialogDescription>
              {deletingRequest && (
                <>
                  Tem certeza que deseja excluir o período de indisponibilidade de <strong>{deletingRequest.colaborador_nome}</strong>?
                  <br /><br />
                  Período: <strong>{format(new Date(deletingRequest.data_inicio), "dd/MM/yyyy", { locale: ptBR })}</strong>{' '}
                  a <strong>{format(new Date(deletingRequest.data_fim), "dd/MM/yyyy", { locale: ptBR })}</strong>
                  <br /><br />
                  <span className="text-red-500">Esta ação não pode ser desfeita.</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setDeletingRequest(null); }} data-testid="button-cancelar-delete">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              data-testid="button-confirmar-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
