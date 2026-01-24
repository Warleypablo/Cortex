import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CalendarDays, Clock, User, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
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

export default function CalendarioFerias() {
  usePageTitle("Calendário de Férias");
  useSetPageInfo("Calendário de Férias", "Visualizar e alinhar períodos de indisponibilidade dos prestadores");

  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<UnavailabilityRequest | null>(null);
  const [actionType, setActionType] = useState<'aprovar' | 'reprovar' | null>(null);
  const [observacao, setObservacao] = useState('');
  const [activeTab, setActiveTab] = useState('calendario');

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

  const groupedByMonth = approvedRequests.reduce((acc, req) => {
    const monthKey = format(new Date(req.data_inicio), "MMMM yyyy", { locale: ptBR });
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(req);
    return acc;
  }, {} as Record<string, UnavailabilityRequest[]>);

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
              ) : approvedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma indisponibilidade alinhada registrada.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedByMonth).map(([month, requests]) => (
                    <div key={month}>
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        {month}
                      </h3>
                      <div className="grid gap-3">
                        {requests.map((req) => (
                          <div 
                            key={req.id} 
                            className="flex items-center justify-between p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                            data-testid={`calendar-item-${req.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
                                <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <p className="font-medium">{req.colaborador_nome}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(req.data_inicio), "dd/MM", { locale: ptBR })} - {format(new Date(req.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300">
                                Alinhado
                              </Badge>
                              {req.motivo && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">{req.motivo}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
