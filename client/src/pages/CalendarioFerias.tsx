import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, CalendarDays, Clock, User, CheckCircle, XCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isWithinInterval, parseISO, isSameMonth } from "date-fns";
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
  aprovador_nome: string | null;
  data_aprovacao: string | null;
  observacao_aprovador: string | null;
  data_admissao: string | null;
  meses_empresa: number | null;
  created_at: string;
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

  const { data: pendingRequests = [], isLoading: isLoadingPending, refetch: refetchPending } = useQuery<UnavailabilityRequest[]>({
    queryKey: ["/api/unavailability-requests", { status: "pendente" }],
  });

  const { data: approvedRequests = [], isLoading: isLoadingApproved } = useQuery<UnavailabilityRequest[]>({
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

  const handleAction = (req: UnavailabilityRequest, action: 'aprovar' | 'reprovar') => {
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

  const colaboradorColors = useMemo(() => {
    const colorMap = new Map<number, string>();
    approvedRequests.forEach((req, index) => {
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
    </div>
  );
}
