import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Video, Clock, CheckCircle2, Banknote, Search, CreditCard, AlertTriangle,
  User, Mail, Key, CalendarDays, FileText, DollarSign, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ============================================
// Types
// ============================================
interface ContratoPagamento {
  id: number;
  creator_id: number;
  cargo: string;
  cliente_nome: string;
  valor_remuneracao: string;
  assinado_em: string;
  etapa_pagamento: string;
  observacoes: string | null;
  atualizado_em: string;
  creator_nome: string;
  creator_email: string;
  prazo_entrega_dias: number | null;
  chave_pix: string | null;
  tipo_pix: string | null;
}

// ============================================
// Etapas Config
// ============================================
const ETAPAS = [
  { id: "producao", label: "Conteúdo em Produção", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", dotColor: "bg-blue-500", headerBg: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-200 dark:border-blue-800", icon: Video },
  { id: "aguardando_aprovacao", label: "Aguardando Aprovação", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", dotColor: "bg-amber-500", headerBg: "bg-amber-50 dark:bg-amber-950/30", borderColor: "border-amber-200 dark:border-amber-800", icon: Clock },
  { id: "aprovado", label: "Pagamento Aprovado", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", dotColor: "bg-indigo-500", headerBg: "bg-indigo-50 dark:bg-indigo-950/30", borderColor: "border-indigo-200 dark:border-indigo-800", icon: CheckCircle2 },
  { id: "pago", label: "Pago", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", dotColor: "bg-green-500", headerBg: "bg-green-50 dark:bg-green-950/30", borderColor: "border-green-200 dark:border-green-800", icon: Banknote },
] as const;

const ETAPA_MAP = Object.fromEntries(ETAPAS.map((e) => [e.id, e]));

const KANBAN_COLUMNS = ETAPAS.map((e) => e.id);

// ============================================
// Helpers
// ============================================
function formatCurrency(val: string | number | null) {
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (!num && num !== 0) return "R$ 0";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function isAtrasado(c: ContratoPagamento): boolean {
  if (c.etapa_pagamento !== "producao") return false;
  if (!c.assinado_em || !c.prazo_entrega_dias) return false;
  const deadline = new Date(c.assinado_em);
  deadline.setDate(deadline.getDate() + c.prazo_entrega_dias);
  return new Date() > deadline;
}

function diasAtraso(c: ContratoPagamento): number {
  if (!c.assinado_em || !c.prazo_entrega_dias) return 0;
  const deadline = new Date(c.assinado_em);
  deadline.setDate(deadline.getDate() + c.prazo_entrega_dias);
  const diff = Date.now() - deadline.getTime();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
}

function timeAgo(date: string | null) {
  if (!date) return "";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

// ============================================
// Main Page
// ============================================
export default function PagamentoFreelancers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ContratoPagamento | null>(null);

  const { data: contratos = [], isLoading } = useQuery<ContratoPagamento[]>({
    queryKey: ["/api/creators/pagamentos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/creators/pagamentos");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return contratos;
    const q = search.toLowerCase();
    return contratos.filter(
      (c) =>
        c.creator_nome?.toLowerCase().includes(q) ||
        c.cliente_nome?.toLowerCase().includes(q) ||
        c.cargo?.toLowerCase().includes(q)
    );
  }, [contratos, search]);

  // Group by etapa
  const kanbanData = useMemo(() => {
    const grouped: Record<string, ContratoPagamento[]> = {};
    for (const col of KANBAN_COLUMNS) grouped[col] = [];
    for (const c of filtered) {
      if (grouped[c.etapa_pagamento]) grouped[c.etapa_pagamento].push(c);
    }
    return grouped;
  }, [filtered]);

  // KPI stats
  const stats = useMemo(() => {
    const result: Record<string, { count: number; valor: number }> = {};
    for (const col of KANBAN_COLUMNS) result[col] = { count: 0, valor: 0 };
    for (const c of contratos) {
      if (result[c.etapa_pagamento]) {
        result[c.etapa_pagamento].count++;
        result[c.etapa_pagamento].valor += parseFloat(c.valor_remuneracao) || 0;
      }
    }
    return result;
  }, [contratos]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-500" />
            Pagamento Freelancers
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Fluxo de pagamento dos contratos assinados
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <Input
            placeholder="Buscar creator, cliente ou cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ETAPAS.map((etapa) => {
          const Icon = etapa.icon;
          const s = stats[etapa.id] || { count: 0, valor: 0 };
          return (
            <Card key={etapa.id} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", etapa.headerBg)}>
                  <Icon className={cn("w-5 h-5", etapa.dotColor.replace("bg-", "text-"))} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{etapa.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{s.count}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{formatCurrency(s.valor)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ETAPAS.map((etapa) => {
            const items = kanbanData[etapa.id] || [];
            const Icon = etapa.icon;
            return (
              <div key={etapa.id}>
                {/* Column Header */}
                <div className={cn("flex items-center gap-2 p-3 rounded-t-xl border-b", etapa.headerBg, etapa.borderColor)}>
                  <div className={cn("w-2 h-2 rounded-full", etapa.dotColor)} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-zinc-200">{etapa.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5 bg-white/60 dark:bg-zinc-800/60">
                    {items.length}
                  </Badge>
                </div>
                {/* Column Body */}
                <div className="space-y-2 min-h-[200px] p-2 rounded-b-xl bg-gray-50 dark:bg-zinc-800/50 border border-t-0 border-gray-100 dark:border-zinc-800">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-zinc-600">
                      <Icon className="w-8 h-8 mb-2 opacity-30" />
                      <span className="text-xs">Nenhum contrato</span>
                    </div>
                  ) : (
                    items.map((c) => (
                      <KanbanCard key={c.id} contrato={c} onClick={() => setSelected(c)} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <DetailSheet
        contrato={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onUpdate={(updated) => setSelected(updated)}
      />
    </div>
  );
}

// ============================================
// KanbanCard
// ============================================
function KanbanCard({ contrato: c, onClick }: { contrato: ContratoPagamento; onClick: () => void }) {
  const atrasado = isAtrasado(c);
  const dias = atrasado ? diasAtraso(c) : 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg transition-colors cursor-pointer",
        atrasado
          ? "bg-red-50 dark:bg-red-950/30 border-2 border-red-400 dark:border-red-600 hover:border-red-500 dark:hover:border-red-500"
          : "bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-600"
      )}
    >
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium">
          {c.cargo || "Creator"}
        </span>
        {c.chave_pix && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300 font-medium">
            PIX
          </span>
        )}
        {atrasado && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold flex items-center gap-0.5">
            <AlertTriangle className="w-3 h-3" />
            {dias}d atrasado
          </span>
        )}
      </div>
      <p className={cn("text-sm font-medium line-clamp-1", atrasado ? "text-red-800 dark:text-red-300" : "text-gray-900 dark:text-white")}>{c.creator_nome}</p>
      <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-1 mt-0.5">{c.cliente_nome}</p>
      <div className="flex items-center justify-between mt-2">
        <span className={cn("text-sm font-semibold", atrasado ? "text-red-700 dark:text-red-400" : "text-gray-800 dark:text-zinc-200")}>
          {formatCurrency(c.valor_remuneracao)}
        </span>
        <span className="text-[11px] text-gray-400 dark:text-zinc-500">{timeAgo(c.assinado_em)}</span>
      </div>
    </button>
  );
}

// ============================================
// DetailSheet
// ============================================
function DetailSheet({
  contrato,
  open,
  onClose,
  onUpdate,
}: {
  contrato: ContratoPagamento | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (c: ContratoPagamento) => void;
}) {
  const { toast } = useToast();
  const [targetEtapa, setTargetEtapa] = useState("");

  const etapaConfig = contrato ? ETAPA_MAP[contrato.etapa_pagamento] : null;

  // Get valid next etapas
  const nextEtapas = useMemo(() => {
    if (!contrato) return [];
    const currentIdx = KANBAN_COLUMNS.indexOf(contrato.etapa_pagamento as typeof KANBAN_COLUMNS[number]);
    return ETAPAS.filter((_, i) => i !== currentIdx);
  }, [contrato]);

  const moveMutation = useMutation({
    mutationFn: async ({ id, etapa }: { id: number; etapa: string }) => {
      const res = await apiRequest("PATCH", `/api/creators/contratos/${id}/etapa-pagamento`, { etapa_pagamento: etapa });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/creators/pagamentos"] });
      onUpdate({ ...contrato!, etapa_pagamento: data.etapa_pagamento, atualizado_em: data.atualizado_em });
      setTargetEtapa("");
      toast({ title: "Etapa atualizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar etapa", variant: "destructive" });
    },
  });

  if (!contrato) return null;

  const atrasado = isAtrasado(contrato);
  const dias = atrasado ? diasAtraso(contrato) : 0;

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-[480px] p-0 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 flex flex-col">
        <SheetHeader className="p-5 pb-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {etapaConfig && (
              <Badge className={cn("text-xs", etapaConfig.color)}>
                {etapaConfig.label}
              </Badge>
            )}
            {atrasado && (
              <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {dias}d atrasado
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg text-gray-900 dark:text-white">
            {contrato.creator_nome}
          </SheetTitle>
          <p className="text-sm text-gray-500 dark:text-zinc-400">{contrato.cargo || "Creator"} — {contrato.cliente_nome}</p>
        </SheetHeader>

        <Separator className="dark:bg-zinc-800" />

        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-4">
            {/* Valor */}
            <InfoRow icon={<DollarSign className="w-4 h-4 text-green-500" />} label="Valor" value={formatCurrency(contrato.valor_remuneracao)} />

            {/* Assinado em */}
            <InfoRow
              icon={<CalendarDays className="w-4 h-4 text-blue-500" />}
              label="Assinado em"
              value={contrato.assinado_em ? new Date(contrato.assinado_em).toLocaleDateString("pt-BR") : "—"}
            />

            {/* Prazo de entrega */}
            {contrato.prazo_entrega_dias && contrato.assinado_em && (
              <InfoRow
                icon={<Clock className={cn("w-4 h-4", atrasado ? "text-red-500" : "text-amber-500")} />}
                label="Prazo de entrega"
                value={(() => {
                  const deadline = new Date(contrato.assinado_em);
                  deadline.setDate(deadline.getDate() + contrato.prazo_entrega_dias!);
                  const formatted = deadline.toLocaleDateString("pt-BR");
                  return atrasado ? `${formatted} (${dias}d atrasado)` : `${formatted} (${contrato.prazo_entrega_dias}d)`;
                })()}
              />
            )}

            {/* Creator Info */}
            <InfoRow icon={<User className="w-4 h-4 text-indigo-500" />} label="Creator" value={contrato.creator_nome} />
            <InfoRow icon={<Mail className="w-4 h-4 text-gray-400" />} label="Email" value={contrato.creator_email} />

            {/* PIX */}
            {contrato.chave_pix && (
              <InfoRow
                icon={<Key className="w-4 h-4 text-amber-500" />}
                label={`PIX (${contrato.tipo_pix || "chave"})`}
                value={contrato.chave_pix}
              />
            )}

            {/* Observações */}
            {contrato.observacoes && (
              <InfoRow icon={<FileText className="w-4 h-4 text-gray-400" />} label="Observações" value={contrato.observacoes} />
            )}

            <Separator className="dark:bg-zinc-800" />

            {/* Move to */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Mover para:</label>
              <Select value={targetEtapa} onValueChange={setTargetEtapa}>
                <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                  <SelectValue placeholder="Selecione a etapa..." />
                </SelectTrigger>
                <SelectContent>
                  {nextEtapas.map((e) => {
                    const Icon = e.icon;
                    return (
                      <SelectItem key={e.id} value={e.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" />
                          {e.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {targetEtapa && (
                <Button
                  size="sm"
                  className="w-full mt-2"
                  disabled={moveMutation.isPending}
                  onClick={() => moveMutation.mutate({ id: contrato.id, etapa: targetEtapa })}
                >
                  <ArrowRight className="w-4 h-4 mr-1" />
                  {moveMutation.isPending ? "Movendo..." : `Mover para ${ETAPA_MAP[targetEtapa]?.label}`}
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-gray-100 dark:border-zinc-800">
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">
            Atualizado {timeAgo(contrato.atualizado_em)}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// InfoRow
// ============================================
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 dark:text-zinc-500">{label}</p>
        <p className="text-sm text-gray-900 dark:text-white break-all">{value}</p>
      </div>
    </div>
  );
}
