import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Target, 
  TrendingUp, 
  DollarSign, 
  CheckCircle,
  Users,
  Pencil,
  Trash2
} from "lucide-react";

interface SquadMeta {
  id: number | null;
  squad: string;
  ano: number;
  mes: number;
  metaMrr: number;
  metaContratos: number;
  mrrRealizado: number;
  contratosRealizados: number;
  percentualMrr: number;
  percentualContratos: number;
}

interface SquadProgressoResponse {
  ano: number;
  mes: number;
  squads: SquadMeta[];
}

interface MetaFormData {
  squad: string;
  ano: number;
  mes: number;
  metaMrr: number;
  metaContratos: number;
  observacoes: string;
}

const mesesNomes = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const currentYear = new Date().getFullYear();
const years = [currentYear - 1, currentYear, currentYear + 1];

function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 75) return "bg-yellow-500";
  return "bg-red-500";
}

function getCardBorderColor(percent: number): string {
  if (percent >= 100) return "border-green-500/50";
  if (percent >= 75) return "border-yellow-500/50";
  return "border-red-500/50";
}

export default function MetasSquad() {
  useSetPageInfo("Metas por Squad", "Acompanhamento das metas de MRR por squad");
  
  const { toast } = useToast();
  const hoje = new Date();
  const [selectedYear, setSelectedYear] = useState(hoje.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(String(hoje.getMonth() + 1));
  const [filterSquad, setFilterSquad] = useState<string>("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<SquadMeta | null>(null);
  const [formData, setFormData] = useState<MetaFormData>({
    squad: "",
    ano: hoje.getFullYear(),
    mes: hoje.getMonth() + 1,
    metaMrr: 0,
    metaContratos: 0,
    observacoes: "",
  });

  const { data: progressoData, isLoading } = useQuery<SquadProgressoResponse>({
    queryKey: ["/api/squads/metas/progresso", selectedYear, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("ano", String(selectedYear));
      if (selectedMonth !== "todos") {
        params.append("mes", selectedMonth);
      }
      const response = await fetch(`/api/squads/metas/progresso?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch squad progress");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MetaFormData) => {
      const response = await apiRequest("POST", "/api/squads/metas", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/squads/metas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/squads/metas/progresso"] });
      toast({ title: "Meta criada com sucesso" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao criar meta", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MetaFormData> }) => {
      const response = await apiRequest("PUT", `/api/squads/metas/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/squads/metas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/squads/metas/progresso"] });
      toast({ title: "Meta atualizada com sucesso" });
      setIsDialogOpen(false);
      setEditingMeta(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar meta", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/squads/metas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/squads/metas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/squads/metas/progresso"] });
      toast({ title: "Meta removida com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao remover meta", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      squad: "",
      ano: hoje.getFullYear(),
      mes: hoje.getMonth() + 1,
      metaMrr: 0,
      metaContratos: 0,
      observacoes: "",
    });
  };

  const handleOpenDialog = (meta?: SquadMeta) => {
    if (meta && meta.id) {
      setEditingMeta(meta);
      setFormData({
        squad: meta.squad,
        ano: meta.ano,
        mes: meta.mes,
        metaMrr: meta.metaMrr,
        metaContratos: meta.metaContratos,
        observacoes: "",
      });
    } else {
      setEditingMeta(null);
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.squad) {
      toast({ title: "Selecione um squad", variant: "destructive" });
      return;
    }
    
    if (editingMeta && editingMeta.id) {
      updateMutation.mutate({
        id: editingMeta.id,
        data: {
          metaMrr: formData.metaMrr,
          metaContratos: formData.metaContratos,
          observacoes: formData.observacoes,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (meta: SquadMeta) => {
    if (meta.id && confirm(`Tem certeza que deseja remover a meta de ${meta.squad}?`)) {
      deleteMutation.mutate(meta.id);
    }
  };

  const filteredSquads = useMemo(() => {
    if (!progressoData?.squads) return [];
    if (filterSquad === "todos") return progressoData.squads;
    return progressoData.squads.filter(s => s.squad.toLowerCase() === filterSquad.toLowerCase());
  }, [progressoData, filterSquad]);

  const uniqueSquads = useMemo(() => {
    if (!progressoData?.squads) return [];
    const squads = new Set(progressoData.squads.map(s => s.squad));
    return Array.from(squads).filter(Boolean).sort();
  }, [progressoData]);

  const summary = useMemo(() => {
    const squads = filteredSquads;
    const totalMrrAtual = squads.reduce((sum, s) => sum + s.mrrRealizado, 0);
    const totalMetaMrr = squads.reduce((sum, s) => sum + s.metaMrr, 0);
    const atingimentoGeral = totalMetaMrr > 0 ? (totalMrrAtual / totalMetaMrr) * 100 : 0;
    const squadsComMetaBatida = squads.filter(s => s.percentualMrr >= 100).length;
    
    return {
      totalMrrAtual,
      totalMetaMrr,
      atingimentoGeral,
      squadsComMetaBatida,
      totalSquads: squads.length,
    };
  }, [filteredSquads]);

  return (
    <div className="p-6 space-y-6" data-testid="page-metas-squad">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[120px]" data-testid="select-year">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[150px]" data-testid="select-month">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {mesesNomes.map((mes, idx) => (
                <SelectItem key={idx} value={String(idx + 1)}>
                  {mes}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterSquad} onValueChange={setFilterSquad}>
            <SelectTrigger className="w-[180px]" data-testid="select-squad-filter">
              <SelectValue placeholder="Squad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os squads</SelectItem>
              {uniqueSquads.map((squad) => (
                <SelectItem key={squad} value={squad.toLowerCase()}>
                  {squad}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-meta">
              <Plus className="w-4 h-4 mr-2" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMeta ? "Editar Meta" : "Nova Meta"}</DialogTitle>
              <DialogDescription>
                {editingMeta 
                  ? "Atualize os valores da meta do squad." 
                  : "Defina uma nova meta para um squad."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="squad">Squad</Label>
                <Select 
                  value={formData.squad} 
                  onValueChange={(v) => setFormData({ ...formData, squad: v })}
                  disabled={!!editingMeta}
                >
                  <SelectTrigger data-testid="input-squad">
                    <SelectValue placeholder="Selecione um squad" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueSquads.map((squad) => (
                      <SelectItem key={squad} value={squad}>
                        {squad}
                      </SelectItem>
                    ))}
                    <SelectItem value="Growth">Growth</SelectItem>
                    <SelectItem value="Performance">Performance</SelectItem>
                    <SelectItem value="Tech">Tech</SelectItem>
                    <SelectItem value="CS">CS</SelectItem>
                    <SelectItem value="Comercial">Comercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ano">Ano</Label>
                  <Select 
                    value={String(formData.ano)} 
                    onValueChange={(v) => setFormData({ ...formData, ano: Number(v) })}
                    disabled={!!editingMeta}
                  >
                    <SelectTrigger data-testid="input-ano">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mes">Mês</Label>
                  <Select 
                    value={String(formData.mes)} 
                    onValueChange={(v) => setFormData({ ...formData, mes: Number(v) })}
                    disabled={!!editingMeta}
                  >
                    <SelectTrigger data-testid="input-mes">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mesesNomes.map((mes, idx) => (
                        <SelectItem key={idx} value={String(idx + 1)}>
                          {mes}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="metaMrr">Meta MRR (R$)</Label>
                <Input
                  id="metaMrr"
                  type="number"
                  value={formData.metaMrr}
                  onChange={(e) => setFormData({ ...formData, metaMrr: Number(e.target.value) })}
                  placeholder="0.00"
                  data-testid="input-meta-mrr"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="metaContratos">Meta Contratos</Label>
                <Input
                  id="metaContratos"
                  type="number"
                  value={formData.metaContratos}
                  onChange={(e) => setFormData({ ...formData, metaContratos: Number(e.target.value) })}
                  placeholder="0"
                  data-testid="input-meta-contratos"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-meta"
              >
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-mrr-atual">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground font-medium">MRR Atual Total</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(summary.totalMrrAtual)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Soma de todos os squads</p>
                  </div>
                  <div className="p-2 rounded-lg shrink-0 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-meta-total">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground font-medium">Meta MRR Total</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(summary.totalMetaMrr)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Meta definida</p>
                  </div>
                  <div className="p-2 rounded-lg shrink-0 bg-primary/10 text-primary">
                    <Target className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-atingimento">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground font-medium">Atingimento Geral</p>
                    <p className="text-2xl font-bold mt-1">{formatPercent(summary.atingimentoGeral)}</p>
                    <p className="text-xs text-muted-foreground mt-1">MRR / Meta</p>
                  </div>
                  <div className={`p-2 rounded-lg shrink-0 ${summary.atingimentoGeral >= 100 ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : summary.atingimentoGeral >= 75 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-squads-batida">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground font-medium">Squads com Meta Batida</p>
                    <p className="text-2xl font-bold mt-1">{summary.squadsComMetaBatida} / {summary.totalSquads}</p>
                    <p className="text-xs text-muted-foreground mt-1">Atingiram 100%+</p>
                  </div>
                  <div className="p-2 rounded-lg shrink-0 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSquads.map((squad) => (
              <Card 
                key={`${squad.squad}-${squad.ano}-${squad.mes}`} 
                className={`${getCardBorderColor(squad.percentualMrr)} border-2`}
                data-testid={`card-squad-${squad.squad.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {squad.squad}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {squad.id && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(squad)}
                            data-testid={`button-edit-${squad.squad.toLowerCase()}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(squad)}
                            data-testid={`button-delete-${squad.squad.toLowerCase()}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Atingimento</span>
                        <span className="font-medium">{formatPercent(squad.percentualMrr)}</span>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`absolute left-0 top-0 h-full transition-all ${getProgressColor(squad.percentualMrr)}`}
                          style={{ width: `${Math.min(squad.percentualMrr, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">MRR Atual</p>
                        <p className="font-medium">{formatCurrency(squad.mrrRealizado)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Meta MRR</p>
                        <p className="font-medium">{formatCurrency(squad.metaMrr)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Contratos</p>
                        <p className="font-medium">{squad.contratosRealizados}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Meta Contratos</p>
                        <p className="font-medium">{squad.metaContratos}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredSquads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Detalhamento por Squad
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Squad</TableHead>
                        <TableHead className="text-right">Meta MRR</TableHead>
                        <TableHead className="text-right">MRR Atual</TableHead>
                        <TableHead className="text-right">% Atingido</TableHead>
                        <TableHead className="text-right">Meta Contratos</TableHead>
                        <TableHead className="text-right">Contratos Atual</TableHead>
                        <TableHead className="text-right">% Contratos</TableHead>
                        <TableHead className="text-right">Ticket Médio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSquads.map((squad) => {
                        const ticketMedio = squad.contratosRealizados > 0 
                          ? squad.mrrRealizado / squad.contratosRealizados 
                          : 0;
                        return (
                          <TableRow 
                            key={`${squad.squad}-${squad.ano}-${squad.mes}`}
                            data-testid={`row-squad-${squad.squad.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <TableCell className="font-medium">{squad.squad}</TableCell>
                            <TableCell className="text-right">{formatCurrency(squad.metaMrr)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(squad.mrrRealizado)}</TableCell>
                            <TableCell className="text-right">
                              <span className={`font-medium ${squad.percentualMrr >= 100 ? 'text-green-600' : squad.percentualMrr >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {formatPercent(squad.percentualMrr)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{squad.metaContratos}</TableCell>
                            <TableCell className="text-right">{squad.contratosRealizados}</TableCell>
                            <TableCell className="text-right">
                              <span className={`font-medium ${squad.percentualContratos >= 100 ? 'text-green-600' : squad.percentualContratos >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {formatPercent(squad.percentualContratos)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(ticketMedio)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredSquads.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum dado disponível para o período selecionado. Clique em "Nova Meta" para adicionar metas.
            </div>
          )}
        </>
      )}
    </div>
  );
}
