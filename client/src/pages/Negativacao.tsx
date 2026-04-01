import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { formatCurrency, cn } from "@/lib/utils";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Scale,
  Gavel,
  FileWarning,
  Handshake,
  Clock,
  User,
  Calendar,
  ChevronRight,
  GripVertical,
  CircleDot,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface NegativacaoAcao {
  id: number;
  clienteId: string;
  clienteNome: string;
  clienteCnpj: string | null;
  etapa: string;
  status: string;
  valorInadimplente: string;
  diasAtraso: number;
  protocolo: string | null;
  responsavel: string | null;
  valorAcordado: string | null;
  dataAcao: string | null;
  dataAcordo: string | null;
  observacoes: string | null;
  documentoUrl: string | null;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

interface KanbanData {
  colunas: {
    notificacao: NegativacaoAcao[];
    protesto: NegativacaoAcao[];
    negativacao: NegativacaoAcao[];
    acao_judicial: NegativacaoAcao[];
  };
  resumo: {
    totalClientes: number;
    totalValor: number;
    totalAcordos: number;
    taxaRecuperacao: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────────

const ETAPAS = [
  {
    key: "notificacao",
    label: "Notificacao",
    icon: FileWarning,
    color: "amber",
    bgLight: "bg-amber-50",
    bgDark: "dark:bg-amber-950/30",
    borderLight: "border-amber-200",
    borderDark: "dark:border-amber-800",
    headerBg: "bg-amber-100 dark:bg-amber-900/40",
    badgeBg: "bg-amber-500",
    textColor: "text-amber-700 dark:text-amber-400",
  },
  {
    key: "protesto",
    label: "Protesto",
    icon: AlertTriangle,
    color: "orange",
    bgLight: "bg-orange-50",
    bgDark: "dark:bg-orange-950/30",
    borderLight: "border-orange-200",
    borderDark: "dark:border-orange-800",
    headerBg: "bg-orange-100 dark:bg-orange-900/40",
    badgeBg: "bg-orange-500",
    textColor: "text-orange-700 dark:text-orange-400",
  },
  {
    key: "negativacao",
    label: "Negativacao",
    icon: Scale,
    color: "red",
    bgLight: "bg-red-50",
    bgDark: "dark:bg-red-950/30",
    borderLight: "border-red-200",
    borderDark: "dark:border-red-800",
    headerBg: "bg-red-100 dark:bg-red-900/40",
    badgeBg: "bg-red-500",
    textColor: "text-red-700 dark:text-red-400",
  },
  {
    key: "acao_judicial",
    label: "Acao Judicial",
    icon: Gavel,
    color: "purple",
    bgLight: "bg-purple-50",
    bgDark: "dark:bg-purple-950/30",
    borderLight: "border-purple-200",
    borderDark: "dark:border-purple-800",
    headerBg: "bg-purple-100 dark:bg-purple-900/40",
    badgeBg: "bg-purple-500",
    textColor: "text-purple-700 dark:text-purple-400",
  },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  em_andamento: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  concluido: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  cancelado: "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
};

const ETAPA_ORDER = ["notificacao", "protesto", "negativacao", "acao_judicial"];

// ─── Component ───────────────────────────────────────────────────────

export default function Negativacao() {
  usePageTitle("Negativacao");
  const { setPageInfo } = usePageInfo();
  const { toast } = useToast();

  useEffect(() => {
    setPageInfo("Negativacao", "Pipeline de cobranca e recuperacao de credito");
  }, [setPageInfo]);

  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  // ─── Data Fetching ──────────────────────────────────────────────────

  const { data: kanbanData, isLoading } = useQuery<KanbanData>({
    queryKey: ["/api/negativacao/kanban"],
    queryFn: async () => {
      const r = await fetch("/api/negativacao/kanban");
      if (!r.ok) throw new Error("Failed to fetch kanban");
      return r.json();
    },
  });

  const { data: clientHistory } = useQuery<NegativacaoAcao[]>({
    queryKey: ["/api/negativacao/cliente", selectedClient],
    queryFn: async () => {
      const r = await fetch(`/api/negativacao/cliente/${selectedClient}`);
      if (!r.ok) throw new Error("Failed to fetch client history");
      return r.json();
    },
    enabled: !!selectedClient,
  });

  // ─── Mutations ──────────────────────────────────────────────────────

  const moveMutation = useMutation({
    mutationFn: async ({
      clienteId,
      novaEtapa,
    }: {
      clienteId: string;
      novaEtapa: string;
    }) => {
      const r = await fetch(`/api/negativacao/mover/${clienteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaEtapa, responsavel: null, criadoPor: null }),
      });
      if (!r.ok) throw new Error("Failed to move client");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/negativacao/kanban"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/negativacao/cliente"],
      });
      toast({ title: "Cliente movido com sucesso" });
    },
    onError: () => {
      toast({
        title: "Erro ao mover cliente",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Record<string, any>) => {
      const r = await fetch(`/api/negativacao/acoes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Failed to update action");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/negativacao/kanban"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/negativacao/cliente", selectedClient],
      });
      toast({ title: "Acao atualizada com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar acao", variant: "destructive" });
    },
  });

  // ─── Drag and Drop ─────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent, clienteId: string) => {
      setDraggedClientId(clienteId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", clienteId);
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetEtapa: string) => {
      e.preventDefault();
      const clienteId = e.dataTransfer.getData("text/plain");
      if (!clienteId) return;

      // Find current etapa of the client
      if (!kanbanData) return;
      const cols = kanbanData.colunas as Record<string, NegativacaoAcao[]>;
      let currentEtapa = "";
      for (const [etapa, actions] of Object.entries(cols)) {
        if (actions.some((a) => a.clienteId === clienteId)) {
          currentEtapa = etapa;
          break;
        }
      }

      if (currentEtapa === targetEtapa) {
        setDraggedClientId(null);
        return;
      }

      moveMutation.mutate({ clienteId, novaEtapa: targetEtapa });
      setDraggedClientId(null);
    },
    [kanbanData, moveMutation]
  );

  // ─── Card click → open drawer ──────────────────────────────────────

  const handleCardClick = useCallback((action: NegativacaoAcao) => {
    setSelectedClient(action.clienteId);
    setEditForm({
      dataAcao: action.dataAcao || "",
      status: action.status || "pendente",
      protocolo: action.protocolo || "",
      responsavel: action.responsavel || "",
      valorAcordado: action.valorAcordado || "",
      observacoes: action.observacoes || "",
      documentoUrl: action.documentoUrl || "",
    });
    setDrawerOpen(true);
  }, []);

  // ─── Get latest action for a client ────────────────────────────────

  const getLatestAction = useCallback(
    (clienteId: string): NegativacaoAcao | undefined => {
      if (!clientHistory || clientHistory.length === 0) return undefined;
      return clientHistory[clientHistory.length - 1];
    },
    [clientHistory]
  );

  // ─── Deduplicate cards per column (show latest per client) ─────────

  const getUniqueCards = useCallback(
    (actions: NegativacaoAcao[]): NegativacaoAcao[] => {
      const map = new Map<string, NegativacaoAcao>();
      for (const a of actions) {
        const existing = map.get(a.clienteId);
        if (
          !existing ||
          new Date(a.criadoEm) > new Date(existing.criadoEm)
        ) {
          map.set(a.clienteId, a);
        }
      }
      return Array.from(map.values());
    },
    []
  );

  // ─── Save handler ──────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const latest = getLatestAction(selectedClient || "");
    if (!latest) return;
    updateMutation.mutate({ id: latest.id, ...editForm });
  }, [selectedClient, editForm, getLatestAction, updateMutation]);

  // ─── Advance stage handler ─────────────────────────────────────────

  const handleAdvanceStage = useCallback(() => {
    if (!selectedClient || !kanbanData) return;

    const cols = kanbanData.colunas as Record<string, NegativacaoAcao[]>;
    let currentEtapa = "";
    for (const [etapa, actions] of Object.entries(cols)) {
      if (actions.some((a) => a.clienteId === selectedClient)) {
        currentEtapa = etapa;
        break;
      }
    }

    const currentIdx = ETAPA_ORDER.indexOf(currentEtapa);
    if (currentIdx < 0 || currentIdx >= ETAPA_ORDER.length - 1) {
      toast({ title: "Cliente ja esta na ultima etapa", variant: "destructive" });
      return;
    }

    const nextEtapa = ETAPA_ORDER[currentIdx + 1];
    moveMutation.mutate({ clienteId: selectedClient, novaEtapa: nextEtapa });
    setDrawerOpen(false);
  }, [selectedClient, kanbanData, moveMutation, toast]);

  // ─── Column total value ────────────────────────────────────────────

  const getColumnTotal = useCallback(
    (actions: NegativacaoAcao[]): number => {
      const unique = getUniqueCards(actions);
      return unique.reduce(
        (sum, a) => sum + parseFloat(a.valorInadimplente || "0"),
        0
      );
    },
    [getUniqueCards]
  );

  // ─── Render ────────────────────────────────────────────────────────

  const resumo = kanbanData?.resumo;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ─── Hero Metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Scale className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Total em processo
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {resumo?.totalClientes || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Valor total
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(resumo?.totalValor || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Handshake className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Acordos realizados
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {resumo?.totalAcordos || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <ChevronRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Taxa de recuperacao
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {resumo?.taxaRecuperacao || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Kanban Board ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ETAPAS.map((etapa) => {
          const actions =
            (kanbanData?.colunas as any)?.[etapa.key] || [];
          const uniqueCards = getUniqueCards(actions);
          const columnTotal = getColumnTotal(actions);
          const Icon = etapa.icon;

          return (
            <div
              key={etapa.key}
              className={cn(
                "rounded-xl border flex flex-col",
                etapa.bgLight,
                etapa.bgDark,
                etapa.borderLight,
                etapa.borderDark
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, etapa.key)}
            >
              {/* Column Header */}
              <div
                className={cn(
                  "px-4 py-3 rounded-t-xl flex items-center justify-between",
                  etapa.headerBg
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", etapa.textColor)} />
                  <span
                    className={cn(
                      "font-semibold text-sm",
                      etapa.textColor
                    )}
                  >
                    {etapa.label}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-white text-xs h-5 px-1.5",
                      etapa.badgeBg
                    )}
                  >
                    {uniqueCards.length}
                  </Badge>
                </div>
                <span className={cn("text-xs font-medium", etapa.textColor)}>
                  {formatCurrency(columnTotal)}
                </span>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-350px)] min-h-[200px]">
                {uniqueCards.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-sm text-gray-400 dark:text-zinc-500">
                    Nenhum cliente
                  </div>
                ) : (
                  uniqueCards.map((action) => (
                    <div
                      key={action.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, action.clienteId)}
                      onClick={() => handleCardClick(action)}
                      className={cn(
                        "bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-3 cursor-pointer",
                        "hover:shadow-md transition-shadow",
                        "active:opacity-75",
                        draggedClientId === action.clienteId && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
                          <span className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[140px]">
                            {action.clienteNome}
                          </span>
                        </div>
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs flex-shrink-0">
                          {formatCurrency(
                            parseFloat(action.valorInadimplente || "0")
                          )}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
                          <Clock className="h-3 w-3" />
                          <span>{action.diasAtraso || 0} dias de atraso</span>
                        </div>
                        {action.dataAcao && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(action.dataAcao).toLocaleDateString(
                                "pt-BR"
                              )}
                            </span>
                          </div>
                        )}
                        {action.responsavel && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
                            <User className="h-3 w-3" />
                            <span className="truncate">
                              {action.responsavel}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            STATUS_COLORS[action.status] ||
                              STATUS_COLORS.pendente
                          )}
                        >
                          {action.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Detail Drawer ─────────────────────────────────────────────── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-gray-900 dark:text-white">
              Detalhes do Cliente
            </SheetTitle>
          </SheetHeader>

          {selectedClient && clientHistory && clientHistory.length > 0 && (
            <div className="mt-6 space-y-6">
              {/* Client Info */}
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {clientHistory[0].clienteNome}
                </h3>
                {clientHistory[0].clienteCnpj && (
                  <p className="text-sm text-gray-500 dark:text-zinc-400">
                    CNPJ: {clientHistory[0].clienteCnpj}
                  </p>
                )}
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Valor inadimplente:{" "}
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {formatCurrency(
                      parseFloat(
                        clientHistory[clientHistory.length - 1]
                          .valorInadimplente || "0"
                      )
                    )}
                  </span>
                </p>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="font-medium text-sm text-gray-700 dark:text-zinc-300 mb-3">
                  Historico de acoes
                </h4>
                <div className="space-y-3">
                  {clientHistory.map((action, idx) => {
                    const etapaConfig = ETAPAS.find(
                      (e) => e.key === action.etapa
                    );
                    return (
                      <div
                        key={action.id}
                        className="flex gap-3 items-start"
                      >
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                              etapaConfig?.headerBg ||
                                "bg-gray-100 dark:bg-zinc-800"
                            )}
                          >
                            <CircleDot
                              className={cn(
                                "h-4 w-4",
                                etapaConfig?.textColor ||
                                  "text-gray-500"
                              )}
                            />
                          </div>
                          {idx < clientHistory.length - 1 && (
                            <div className="w-px h-6 bg-gray-200 dark:bg-zinc-700" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                              {action.criadoEm
                                ? new Date(
                                    action.criadoEm
                                  ).toLocaleDateString("pt-BR")
                                : "-"}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                etapaConfig?.textColor
                              )}
                            >
                              {etapaConfig?.label || action.etapa}
                            </Badge>
                          </div>
                          {action.observacoes && (
                            <p className="text-sm text-gray-600 dark:text-zinc-400 truncate">
                              {action.observacoes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Edit Form */}
              <div className="border-t border-gray-200 dark:border-zinc-700 pt-4 space-y-4">
                <h4 className="font-medium text-sm text-gray-700 dark:text-zinc-300">
                  Editar acao atual
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 dark:text-zinc-300">
                      Data da acao
                    </Label>
                    <Input
                      type="date"
                      value={editForm.dataAcao || ""}
                      onChange={(e) =>
                        setEditForm((f: Record<string, any>) => ({
                          ...f,
                          dataAcao: e.target.value,
                        }))
                      }
                      className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-gray-700 dark:text-zinc-300">
                      Status
                    </Label>
                    <Select
                      value={editForm.status || "pendente"}
                      onValueChange={(val) =>
                        setEditForm((f: Record<string, any>) => ({
                          ...f,
                          status: val,
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="em_andamento">
                          Em andamento
                        </SelectItem>
                        <SelectItem value="concluido">Concluido</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 dark:text-zinc-300">
                      Protocolo
                    </Label>
                    <Input
                      value={editForm.protocolo || ""}
                      onChange={(e) =>
                        setEditForm((f: Record<string, any>) => ({
                          ...f,
                          protocolo: e.target.value,
                        }))
                      }
                      placeholder="Numero do protocolo"
                      className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-gray-700 dark:text-zinc-300">
                      Responsavel
                    </Label>
                    <Input
                      value={editForm.responsavel || ""}
                      onChange={(e) =>
                        setEditForm((f: Record<string, any>) => ({
                          ...f,
                          responsavel: e.target.value,
                        }))
                      }
                      placeholder="Nome do responsavel"
                      className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-700 dark:text-zinc-300">
                    Valor acordado
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.valorAcordado || ""}
                    onChange={(e) =>
                      setEditForm((f: Record<string, any>) => ({
                        ...f,
                        valorAcordado: e.target.value,
                      }))
                    }
                    placeholder="0,00"
                    className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-700 dark:text-zinc-300">
                    Observacoes
                  </Label>
                  <Textarea
                    value={editForm.observacoes || ""}
                    onChange={(e) =>
                      setEditForm((f: Record<string, any>) => ({
                        ...f,
                        observacoes: e.target.value,
                      }))
                    }
                    placeholder="Notas sobre a acao..."
                    className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-700 dark:text-zinc-300">
                    URL do documento
                  </Label>
                  <Input
                    value={editForm.documentoUrl || ""}
                    onChange={(e) =>
                      setEditForm((f: Record<string, any>) => ({
                        ...f,
                        documentoUrl: e.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    {updateMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleAdvanceStage}
                    disabled={moveMutation.isPending}
                    className="flex-1 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"
                  >
                    {moveMutation.isPending
                      ? "Movendo..."
                      : "Avancar etapa"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {selectedClient && (!clientHistory || clientHistory.length === 0) && (
            <div className="mt-6 flex items-center justify-center h-40">
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
