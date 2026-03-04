import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Clock,
  Search,
  RefreshCw,
  Mail,
  Phone,
  Building2,
  Package,
  User,
  X,
  Send,
  Repeat,
  Zap,
  DollarSign,
  Hash,
  Download,
  CheckCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ContratoItem = {
  id: number;
  plano_nome: string | null;
  servico_nome: string | null;
  valor_negociado: string | number | null;
  valor_final: string | number | null;
  valor_total: string | number | null;
  modalidade: string | null;
  quantidade: number | null;
};

type ContratoNaRua = {
  id: number;
  numero_contrato: string;
  status: string;
  valor_total: string | number | null;
  valor_negociado: string | number | null;
  signature_sent_at: string | null;
  signature_completed_at: string | null;
  comercial_nome: string | null;
  descricao: string | null;
  observacoes: string | null;
  assinafy_document_id: string | null;
  assinafy_status: string | null;
  cliente: {
    nome: string | null;
    cpf_cnpj: string | null;
    tipo_pessoa: string | null;
    email: string | null;
    telefone: string | null;
    email_cobranca: string | null;
    nome_socio: string | null;
  };
  itens: ContratoItem[];
};

function toNum(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

function formatCurrency(value: string | number | null | undefined): string {
  const num = toNum(value);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCurrencyShort(value: number): string {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1).replace(".", ",")}k`;
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCpfCnpj(value: string | null | undefined): string {
  if (!value) return "-";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return value;
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const now = new Date();
  const sent = new Date(dateStr);
  const diffMs = now.getTime() - sent.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "há 1 dia";
  return `há ${diffDays} dias`;
}

function isPendente(status: string) {
  return status === "enviado para assinatura" || status === "enviado_para_assinatura";
}

function getAssinafyLabel(status: string | null): { label: string; color: "amber" | "emerald" | "red" | "zinc" } {
  switch (status) {
    case "pending":
    case "waiting_signatures":
      return { label: "Aguardando", color: "amber" };
    case "signed":
    case "completed":
    case "certificated":
      return { label: "Assinado", color: "emerald" };
    case "declined":
      return { label: "Recusado", color: "red" };
    default:
      return { label: "Enviado", color: "zinc" };
  }
}

function getItemValor(item: ContratoItem): number {
  return toNum(item.valor_negociado) || toNum(item.valor_final) || toNum(item.valor_total);
}

function getContratoValores(contrato: ContratoNaRua) {
  let recorrente = 0;
  let pontual = 0;

  if (contrato.itens.length > 0) {
    for (const item of contrato.itens) {
      const val = getItemValor(item);
      if (item.modalidade === "pontual") {
        pontual += val;
      } else {
        recorrente += val;
      }
    }
  } else {
    // Sem itens detalhados, usa valor_negociado do contrato como recorrente
    recorrente = toNum(contrato.valor_negociado) || toNum(contrato.valor_total);
  }

  return { recorrente, pontual, total: recorrente + pontual };
}

export default function ContratosNaRua() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [simulatingId, setSimulatingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ contratos: ContratoNaRua[] }>({
    queryKey: ["contratos-na-rua"],
    queryFn: async () => {
      const res = await fetch("/api/contratos-na-rua", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar contratos na rua");
      return res.json();
    },
  });

  const allContratos = data?.contratos ?? [];
  const contratos = useMemo(() => allContratos.filter(c => isPendente(c.status)), [allContratos]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contratos;
    const q = search.toLowerCase().trim();
    return contratos.filter(
      (c) =>
        c.cliente?.nome?.toLowerCase().includes(q) ||
        c.cliente?.cpf_cnpj?.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        c.numero_contrato?.toLowerCase().includes(q)
    );
  }, [contratos, search]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) || null,
    [filtered, selectedId]
  );

  // Dashboard stats
  const stats = useMemo(() => {
    let totalRecorrente = 0;
    let totalPontual = 0;
    let totalServicos = 0;

    for (const c of contratos) {
      const vals = getContratoValores(c);
      totalRecorrente += vals.recorrente;
      totalPontual += vals.pontual;
      totalServicos += c.itens.length;
    }

    return {
      numContratos: contratos.length,
      numServicos: totalServicos,
      totalRecorrente,
      totalPontual,
      totalGeral: totalRecorrente + totalPontual,
    };
  }, [contratos]);

  async function handleUpdateStatus(contratoId: number) {
    setUpdatingId(contratoId);
    try {
      const res = await fetch(`/api/contratos/${contratoId}/status-assinatura`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao atualizar status");
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["contratos-na-rua"] });
      toast({
        title: "Status atualizado",
        description: `Status do Assinafy: ${result.assinafyStatus || "consultado"}`,
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSimularAssinatura(contratoId: number) {
    setSimulatingId(contratoId);
    try {
      const res = await fetch(`/api/contratos/${contratoId}/simular-assinatura`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao simular assinatura");
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["contratos-na-rua"] });
      setSelectedId(null);
      toast({
        title: "Assinatura simulada",
        description: result.mensagem || "Contrato marcado como assinado",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível simular a assinatura",
        variant: "destructive",
      });
    } finally {
      setSimulatingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      {/* Dashboard */}
      <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground">Contratos Pendentes de Assinatura</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <div className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Hash className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight">{stats.numContratos}</p>
              <p className="text-[11px] text-muted-foreground">Contratos</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight">{stats.numServicos}</p>
              <p className="text-[11px] text-muted-foreground">Serviços</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Repeat className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight">{formatCurrencyShort(stats.totalRecorrente)}</p>
              <p className="text-[11px] text-muted-foreground">Recorrente</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight">{formatCurrencyShort(stats.totalPontual)}</p>
              <p className="text-[11px] text-muted-foreground">Pontual</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight">{formatCurrencyShort(stats.totalGeral)}</p>
              <p className="text-[11px] text-muted-foreground">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0">
        {/* Lista */}
        <div className={`flex flex-col border-r border-border ${selected ? "w-1/2 xl:w-2/5" : "w-full"} transition-all duration-200`}>
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar nome, CNPJ ou nº contrato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>

          {/* Header da lista */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_28px] gap-2 px-4 py-2 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <span>Cliente</span>
            <span className="w-20 text-right">Recorrente</span>
            <span className="w-20 text-right">Pontual</span>
            <span className="w-20 text-center">Status</span>
            <span className="w-16 text-right">Enviado</span>
            <span />
          </div>

          {/* Lista de contratos */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Nenhum contrato pendente</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((contrato) => {
                  const vals = getContratoValores(contrato);
                  const isSelected = selectedId === contrato.id;
                  const statusInfo = getAssinafyLabel(contrato.assinafy_status);
                  const badgeColors = {
                    amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
                    emerald: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                    red: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
                    zinc: "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
                  };
                  return (
                    <button
                      key={contrato.id}
                      onClick={() => setSelectedId(isSelected ? null : contrato.id)}
                      className={`w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors ${
                        isSelected ? "bg-muted/70 border-l-2 border-l-amber-500" : "border-l-2 border-l-transparent"
                      }`}
                    >
                      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_28px] gap-2 items-center">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {contrato.cliente?.nome || "Cliente não identificado"}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {contrato.numero_contrato || "-"} · {formatCpfCnpj(contrato.cliente?.cpf_cnpj)}
                          </p>
                        </div>
                        <span className="w-20 text-right text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {vals.recorrente > 0 ? formatCurrency(vals.recorrente) : "-"}
                        </span>
                        <span className="w-20 text-right text-sm font-medium text-amber-600 dark:text-amber-400">
                          {vals.pontual > 0 ? formatCurrency(vals.pontual) : "-"}
                        </span>
                        <span className="w-20 flex justify-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${badgeColors[statusInfo.color]}`}>
                            {statusInfo.label}
                          </span>
                        </span>
                        <span className="w-16 text-right text-[11px] text-muted-foreground">
                          {timeAgo(contrato.signature_sent_at)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(contrato.id);
                          }}
                          className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted transition-colors"
                          title="Atualizar status"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${updatingId === contrato.id ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Painel de detalhes */}
        {selected && (
          <div className="flex-1 overflow-y-auto bg-background">
            <DetailPanel
              contrato={selected}
              onClose={() => setSelectedId(null)}
              onUpdateStatus={handleUpdateStatus}
              isUpdating={updatingId === selected.id}
              onSimularAssinatura={handleSimularAssinatura}
              isSimulating={simulatingId === selected.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPanel({
  contrato,
  onClose,
  onUpdateStatus,
  isUpdating,
  onSimularAssinatura,
  isSimulating,
}: {
  contrato: ContratoNaRua;
  onClose: () => void;
  onUpdateStatus: (id: number) => void;
  isUpdating: boolean;
  onSimularAssinatura: (id: number) => void;
  isSimulating: boolean;
}) {
  const vals = getContratoValores(contrato);
  const itensRecorrentes = contrato.itens.filter(i => i.modalidade !== "pontual");
  const itensPontuais = contrato.itens.filter(i => i.modalidade === "pontual");

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {contrato.cliente?.nome || "Cliente não identificado"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Contrato {contrato.numero_contrato || "-"}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
          <Clock className="h-3 w-3" />
          Pendente de assinatura
        </span>
        <span className="text-xs text-muted-foreground">
          Enviado em {formatDate(contrato.signature_sent_at)} ({timeAgo(contrato.signature_sent_at)})
        </span>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Repeat className="h-3.5 w-3.5 text-emerald-500" />
            <p className="text-[11px] text-muted-foreground">Recorrente</p>
          </div>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(vals.recorrente)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-[11px] text-muted-foreground">Pontual</p>
          </div>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(vals.pontual)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-sky-500" />
            <p className="text-[11px] text-muted-foreground">Total</p>
          </div>
          <p className="text-lg font-bold text-foreground">
            {formatCurrency(vals.total)}
          </p>
        </div>
      </div>

      {/* Dados do cliente */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Dados do Cliente</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span>{formatCpfCnpj(contrato.cliente?.cpf_cnpj)}</span>
            </div>
            {contrato.cliente?.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{contrato.cliente.email}</span>
              </div>
            )}
            {contrato.cliente?.telefone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{contrato.cliente.telefone}</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {contrato.cliente?.email_cobranca && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{contrato.cliente.email_cobranca}</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">cobranca</Badge>
              </div>
            )}
            {contrato.cliente?.nome_socio && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span>Socio: {contrato.cliente.nome_socio}</span>
              </div>
            )}
            {contrato.comercial_nome && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span>Comercial: {contrato.comercial_nome}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Serviços Recorrentes */}
      {itensRecorrentes.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Repeat className="h-4 w-4 text-emerald-500" />
            Recorrentes ({itensRecorrentes.length})
          </p>
          <div className="space-y-2">
            {itensRecorrentes.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center justify-between text-sm bg-muted/40 rounded-lg px-3 py-2.5 border border-border/50"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">
                    {item.servico_nome || item.plano_nome || "Servico"}
                  </span>
                  {item.plano_nome && item.servico_nome && (
                    <span className="text-muted-foreground ml-1.5 text-xs">({item.plano_nome})</span>
                  )}
                </div>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-3 whitespace-nowrap">
                  {formatCurrency(getItemValor(item))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Serviços Pontuais */}
      {itensPontuais.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" />
            Pontuais ({itensPontuais.length})
          </p>
          <div className="space-y-2">
            {itensPontuais.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center justify-between text-sm bg-muted/40 rounded-lg px-3 py-2.5 border border-border/50"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">
                    {item.servico_nome || item.plano_nome || "Servico"}
                  </span>
                  {item.plano_nome && item.servico_nome && (
                    <span className="text-muted-foreground ml-1.5 text-xs">({item.plano_nome})</span>
                  )}
                </div>
                <span className="font-semibold text-amber-600 dark:text-amber-400 ml-3 whitespace-nowrap">
                  {formatCurrency(getItemValor(item))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sem itens */}
      {contrato.itens.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground text-center">Sem servicos detalhados neste contrato</p>
        </div>
      )}

      {/* Observações */}
      {contrato.observacoes && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-foreground">Observacoes</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contrato.observacoes}</p>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => window.open(`/api/contratos/${contrato.id}/gerar-pdf`, '_blank')}
        >
          <Download className="h-4 w-4" />
          Ver PDF
        </Button>
        {contrato.assinafy_document_id && (
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => onUpdateStatus(contrato.id)}
            disabled={isUpdating}
          >
            <RefreshCw className={`h-4 w-4 ${isUpdating ? "animate-spin" : ""}`} />
            {isUpdating ? "Atualizando..." : "Verificar Status"}
          </Button>
        )}
      </div>

      {/* Simular assinatura (teste) */}
      <Button
        variant="outline"
        className="w-full gap-2 border-dashed border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
        onClick={() => onSimularAssinatura(contrato.id)}
        disabled={isSimulating}
      >
        <CheckCircle className={`h-4 w-4 ${isSimulating ? "animate-pulse" : ""}`} />
        {isSimulating ? "Simulando..." : "Simular Assinatura (Teste)"}
      </Button>
    </div>
  );
}
