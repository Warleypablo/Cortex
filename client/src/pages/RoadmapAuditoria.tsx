import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  Users,
  Building2,
  FileText,
  CreditCard,
  ChevronDown,
  X,
  TrendingDown,
} from "lucide-react";

interface AuditoriaRoadmapItem {
  clienteNome: string;
  cnpj: string | null;
  bitrix_encontrado: boolean;
  bitrix_valor_recorrente: number;
  bitrix_valor_pontual: number;
  bitrix_closer: string | null;
  bitrix_data_fechamento: string | null;
  bitrix_company_name: string | null;
  bitrix_match_score: number;
  clickup_encontrado: boolean;
  clickup_valor_total: number;
  clickup_qtd_contratos: number;
  clickup_status: string | null;
  clickup_squad: string | null;
  contaazul_encontrado: boolean;
  contaazul_valor_mes: number;
  contaazul_qtd_parcelas: number;
  divergencia_bitrix_clickup: number;
  divergencia_clickup_contaazul: number;
  status: 'ok' | 'divergencia_valor' | 'faltando_clickup' | 'faltando_contaazul' | 'faltando_ambos';
}

const formatCurrencyNoDecimals = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

const statusConfig = {
  ok: { label: "OK", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/50", icon: CheckCircle2 },
  divergencia_valor: { label: "Divergencia", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800/50", icon: AlertTriangle },
  faltando_clickup: { label: "Sem ClickUp", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800/50", icon: XCircle },
  faltando_contaazul: { label: "Sem Conta Azul", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800/50", icon: XCircle },
  faltando_ambos: { label: "So Bitrix", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800/50", icon: XCircle },
};

export default function RoadmapAuditoria() {
  usePageTitle("Roadmap de Auditoria");
  useSetPageInfo("Roadmap de Auditoria", "Pipeline completo: Bitrix -> ClickUp -> Conta Azul");

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [threshold, setThreshold] = useState(5);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedItem, setSelectedItem] = useState<AuditoriaRoadmapItem | null>(null);

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      opts.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return opts;
  }, []);

  const { data, isLoading } = useQuery<AuditoriaRoadmapItem[]>({
    queryKey: ["/api/auditoria/roadmap-clientes", month, threshold],
    queryFn: async () => {
      const params = new URLSearchParams({ month, threshold: threshold.toString() });
      const res = await fetch(`/api/auditoria/roadmap-clientes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    let items = [...data];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(i =>
        i.clienteNome?.toLowerCase().includes(term) ||
        i.cnpj?.includes(term) ||
        i.bitrix_company_name?.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== "todos") {
      items = items.filter(i => i.status === statusFilter);
    }
    return items;
  }, [data, searchTerm, statusFilter]);

  const metricas = useMemo(() => {
    if (!data) return { total: 0, divergencias: 0, faltando: 0, mrrRisco: 0 };
    const divergencias = data.filter(i => i.status === 'divergencia_valor').length;
    const faltando = data.filter(i => ['faltando_clickup', 'faltando_contaazul', 'faltando_ambos'].includes(i.status)).length;
    const mrrRisco = data
      .filter(i => i.status !== 'ok')
      .reduce((sum, i) => sum + Math.max(i.clickup_valor_total, i.contaazul_valor_mes, i.bitrix_valor_recorrente), 0);
    return { total: data.length, divergencias, faltando, mrrRisco };
  }, [data]);

  const kanbanData = useMemo(() => {
    const bitrix: AuditoriaRoadmapItem[] = [];
    const clickup: AuditoriaRoadmapItem[] = [];
    const contaazul: AuditoriaRoadmapItem[] = [];

    filteredData.forEach(item => {
      if (item.bitrix_encontrado) bitrix.push(item);
      if (item.clickup_encontrado) clickup.push(item);
      if (item.contaazul_encontrado) contaazul.push(item);
    });

    return { bitrix, clickup, contaazul };
  }, [filteredData]);

  const renderClientCard = (item: AuditoriaRoadmapItem, column: 'bitrix' | 'clickup' | 'contaazul', idx: number) => {
    const cfg = statusConfig[item.status];
    const Icon = cfg.icon;

    let valor = 0;
    let subtitle = "";
    if (column === 'bitrix') {
      valor = item.bitrix_valor_recorrente;
      subtitle = item.bitrix_closer ? `Closer: ${item.bitrix_closer}` : "";
    } else if (column === 'clickup') {
      valor = item.clickup_valor_total;
      subtitle = `${item.clickup_qtd_contratos} contrato(s)${item.clickup_squad ? ` · ${item.clickup_squad}` : ''}`;
    } else {
      valor = item.contaazul_valor_mes;
      subtitle = `${item.contaazul_qtd_parcelas} parcela(s)`;
    }

    const displayName = column === 'bitrix' ? (item.bitrix_company_name || item.clienteNome) : item.clienteNome;

    return (
      <div
        key={`${column}-${idx}`}
        onClick={() => setSelectedItem(item)}
        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${cfg.bg} ${cfg.border}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{formatCurrencyNoDecimals(valor)}</p>
          </div>
          <Icon className={`h-4 w-4 flex-shrink-0 mt-1 ${cfg.color}`} />
        </div>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
        {column === 'bitrix' && item.bitrix_encontrado && item.clickup_encontrado && item.divergencia_bitrix_clickup > threshold && (
          <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            <span>{item.divergencia_bitrix_clickup.toFixed(1)}% diff vs ClickUp</span>
          </div>
        )}
        {column === 'bitrix' && item.bitrix_encontrado && !item.clickup_encontrado && (
          <div className="flex items-center gap-1 mt-1 text-[11px] text-red-600 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            <span>Nao encontrado no ClickUp</span>
          </div>
        )}
        {column === 'clickup' && item.clickup_encontrado && item.contaazul_encontrado && item.divergencia_clickup_contaazul > threshold && (
          <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            <span>{item.divergencia_clickup_contaazul.toFixed(1)}% diff vs Conta Azul</span>
          </div>
        )}
        {column === 'clickup' && item.clickup_encontrado && !item.contaazul_encontrado && (
          <div className="flex items-center gap-1 mt-1 text-[11px] text-orange-600 dark:text-orange-400">
            <XCircle className="h-3 w-3" />
            <span>Sem parcelas no Conta Azul</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Mes:</label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Tolerancia:</label>
          <Select value={threshold.toString()} onValueChange={v => setThreshold(parseInt(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5%</SelectItem>
              <SelectItem value="10">10%</SelectItem>
              <SelectItem value="20">20%</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Status:</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="divergencia_valor">Divergencia</SelectItem>
              <SelectItem value="faltando_clickup">Sem ClickUp</SelectItem>
              <SelectItem value="faltando_contaazul">Sem Conta Azul</SelectItem>
              <SelectItem value="faltando_ambos">So Bitrix</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Hero Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">Total Clientes</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : metricas.total}</div>
            <div className="text-xs text-muted-foreground mt-1">no pipeline do mes</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200/50 dark:border-amber-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">Divergencias</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{isLoading ? <Skeleton className="h-8 w-16" /> : metricas.divergencias}</div>
            <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">valores diferentes entre sistemas</div>
          </CardContent>
        </Card>
        <Card className="border-red-200/50 dark:border-red-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Faltando no Pipe</span>
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{isLoading ? <Skeleton className="h-8 w-16" /> : metricas.faltando}</div>
            <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">clientes perdidos entre etapas</div>
          </CardContent>
        </Card>
        <Card className="border-rose-200/50 dark:border-rose-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase">MRR em Risco</span>
              <DollarSign className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{isLoading ? <Skeleton className="h-8 w-16" /> : formatCurrencyNoDecimals(metricas.mrrRisco)}</div>
            <div className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">soma dos clientes com problema</div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Pipeline */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4 space-y-3">
                {[1, 2, 3, 4].map(j => <Skeleton key={j} className="h-20 w-full" />)}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Coluna Bitrix */}
          <Card className="border-purple-200/50 dark:border-purple-800/30 bg-purple-50/30 dark:bg-purple-950/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-purple-500/10"><Building2 className="h-4 w-4 text-purple-500" /></div>
                <div>
                  <h3 className="text-sm font-semibold">Bitrix (CRM)</h3>
                  <p className="text-[11px] text-muted-foreground">Negocios Ganhos</p>
                </div>
                <Badge variant="outline" className="ml-auto text-xs">{kanbanData.bitrix.length}</Badge>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {kanbanData.bitrix.map((item, idx) => renderClientCard(item, 'bitrix', idx))}
                {kanbanData.bitrix.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum negocio ganho no periodo</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Coluna ClickUp */}
          <Card className="border-blue-200/50 dark:border-blue-800/30 bg-blue-50/30 dark:bg-blue-950/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-blue-500/10"><FileText className="h-4 w-4 text-blue-500" /></div>
                <div>
                  <h3 className="text-sm font-semibold">ClickUp (Operacao)</h3>
                  <p className="text-[11px] text-muted-foreground">Contratos Ativos</p>
                </div>
                <Badge variant="outline" className="ml-auto text-xs">{kanbanData.clickup.length}</Badge>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {kanbanData.clickup.map((item, idx) => renderClientCard(item, 'clickup', idx))}
                {kanbanData.clickup.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum contrato ativo</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Coluna Conta Azul */}
          <Card className="border-green-200/50 dark:border-green-800/30 bg-green-50/30 dark:bg-green-950/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-green-500/10"><CreditCard className="h-4 w-4 text-green-500" /></div>
                <div>
                  <h3 className="text-sm font-semibold">Conta Azul (Financeiro)</h3>
                  <p className="text-[11px] text-muted-foreground">Parcelas do Mes</p>
                </div>
                <Badge variant="outline" className="ml-auto text-xs">{kanbanData.contaazul.length}</Badge>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {kanbanData.contaazul.map((item, idx) => renderClientCard(item, 'contaazul', idx))}
                {kanbanData.contaazul.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma parcela no periodo</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Side Panel - Detalhe do Cliente */}
      {selectedItem && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedItem(null)} />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white dark:bg-zinc-900 border-l border-border shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold truncate pr-4">{selectedItem.clienteNome}</h2>
                <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {selectedItem.cnpj && (
                <p className="text-sm text-muted-foreground mb-4">CNPJ: {selectedItem.cnpj}</p>
              )}

              {/* Status badge */}
              {(() => {
                const cfg = statusConfig[selectedItem.status];
                const Icon = cfg.icon;
                return (
                  <div className={`flex items-center gap-2 p-3 rounded-lg mb-6 ${cfg.bg} ${cfg.border} border`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                    <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                );
              })()}

              {/* Pipeline visual */}
              <div className="space-y-4">
                {/* Bitrix */}
                <div className={`p-4 rounded-lg border ${selectedItem.bitrix_encontrado ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/50' : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-700/50 opacity-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-semibold">Bitrix (CRM)</span>
                    {selectedItem.bitrix_encontrado
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                      : <XCircle className="h-4 w-4 text-red-500 ml-auto" />
                    }
                  </div>
                  {selectedItem.bitrix_encontrado ? (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Valor Recorrente</span><span className="font-semibold">{formatCurrency(selectedItem.bitrix_valor_recorrente)}</span></div>
                      {selectedItem.bitrix_valor_pontual > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Valor Pontual</span><span className="font-semibold">{formatCurrency(selectedItem.bitrix_valor_pontual)}</span></div>}
                      {selectedItem.bitrix_closer && <div className="flex justify-between"><span className="text-muted-foreground">Closer</span><span>{selectedItem.bitrix_closer}</span></div>}
                      {selectedItem.bitrix_data_fechamento && <div className="flex justify-between"><span className="text-muted-foreground">Data Fechamento</span><span>{selectedItem.bitrix_data_fechamento}</span></div>}
                      {selectedItem.bitrix_match_score > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Match Score</span><span>{(selectedItem.bitrix_match_score * 100).toFixed(0)}%</span></div>}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Nao encontrado no Bitrix</p>}
                </div>

                <div className="flex justify-center">
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Divergencia Bitrix -> ClickUp */}
                {selectedItem.bitrix_encontrado && selectedItem.clickup_encontrado && selectedItem.divergencia_bitrix_clickup > threshold && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Divergencia de {selectedItem.divergencia_bitrix_clickup.toFixed(1)}% entre Bitrix e ClickUp</span>
                  </div>
                )}

                {/* ClickUp */}
                <div className={`p-4 rounded-lg border ${selectedItem.clickup_encontrado ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50' : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-700/50 opacity-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold">ClickUp (Operacao)</span>
                    {selectedItem.clickup_encontrado
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                      : <XCircle className="h-4 w-4 text-red-500 ml-auto" />
                    }
                  </div>
                  {selectedItem.clickup_encontrado ? (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Valor Total MRR</span><span className="font-semibold">{formatCurrency(selectedItem.clickup_valor_total)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Contratos</span><span>{selectedItem.clickup_qtd_contratos}</span></div>
                      {selectedItem.clickup_squad && <div className="flex justify-between"><span className="text-muted-foreground">Squad</span><span>{selectedItem.clickup_squad}</span></div>}
                      {selectedItem.clickup_status && <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{selectedItem.clickup_status}</span></div>}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Nao encontrado no ClickUp</p>}
                </div>

                <div className="flex justify-center">
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Divergencia ClickUp -> Conta Azul */}
                {selectedItem.clickup_encontrado && selectedItem.contaazul_encontrado && selectedItem.divergencia_clickup_contaazul > threshold && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Divergencia de {selectedItem.divergencia_clickup_contaazul.toFixed(1)}% entre ClickUp e Conta Azul</span>
                  </div>
                )}

                {/* Conta Azul */}
                <div className={`p-4 rounded-lg border ${selectedItem.contaazul_encontrado ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50' : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-700/50 opacity-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-semibold">Conta Azul (Financeiro)</span>
                    {selectedItem.contaazul_encontrado
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                      : <XCircle className="h-4 w-4 text-red-500 ml-auto" />
                    }
                  </div>
                  {selectedItem.contaazul_encontrado ? (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Valor Mes</span><span className="font-semibold">{formatCurrency(selectedItem.contaazul_valor_mes)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Parcelas</span><span>{selectedItem.contaazul_qtd_parcelas}</span></div>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Nao encontrado no Conta Azul</p>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
