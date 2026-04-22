import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Package,
  DollarSign,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Eye,
  RefreshCw,
  Trash2,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CriterioAnalise {
  detectado: boolean;
  severidade: "alta" | "media" | "baixa" | "nenhuma";
  pontos: number;
  justificativa: string;
  trechos: string[];
}

interface SinalSecundario {
  sinal: string;
  pontos: number;
  justificativa: string;
}

interface ComposicaoScore {
  expectativa_irreal: number;
  falta_estrutura: number;
  servico_inadequado: number;
  agravantes_total: number;
  atenuantes_total: number;
  formula: string;
}

interface PontoVendedor {
  aspecto: string;
  justificativa: string;
  trecho: string;
}

interface AvaliacaoVendedor {
  pontos_negativos: PontoVendedor[];
  pontos_positivos: PontoVendedor[];
  nota_geral: "boa" | "regular" | "ruim";
  resumo_vendedor: string;
}

interface AnaliseJson {
  score: "alto" | "medio" | "baixo";
  score_numerico: number;
  composicao_score: ComposicaoScore;
  analise: {
    expectativa_irreal: CriterioAnalise;
    falta_estrutura: CriterioAnalise;
    servico_inadequado: CriterioAnalise;
  };
  agravantes: SinalSecundario[];
  atenuantes: SinalSecundario[];
  avaliacao_vendedor?: AvaliacaoVendedor;
  resumo: string;
  recomendacao: "Aprovar" | "Aprovar com atenção" | "Escalar para gestor" | "Rejeitar - alto risco";
}

interface TriagemAnalise {
  id: number;
  clienteId: string | null;
  clienteNome: string;
  squad: string | null;
  vendedor: string | null;
  produto: string | null;
  valorContrato: string | null;
  transcricaoUrl: string | null;
  transcricaoTexto: string | null;
  score: string | null;
  scoreNumerico: number | null;
  analiseJson: AnaliseJson | null;
  status: string;
  decisaoPor: string | null;
  decisaoObservacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCORE_CONFIG = {
  alto: { label: "Alto Risco", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: ShieldX },
  medio: { label: "Médio Risco", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: ShieldAlert },
  baixo: { label: "Baixo Risco", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: ShieldCheck },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300" },
  aprovado: { label: "Aprovado", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejeitado: { label: "Rejeitado", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  escalado: { label: "Escalado", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

const SEVERIDADE_CONFIG = {
  alta: "text-red-600 dark:text-red-400",
  media: "text-yellow-600 dark:text-yellow-400",
  baixa: "text-blue-600 dark:text-blue-400",
  nenhuma: "text-gray-400 dark:text-zinc-500",
};

function ScoreBadge({ score }: { score: string | null }) {
  const key = (score as keyof typeof SCORE_CONFIG) || "medio";
  const config = SCORE_CONFIG[key] || SCORE_CONFIG.medio;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  const v = value ?? 0;
  const color = v >= 70 ? "bg-red-500" : v >= 40 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${v}%` }} />
    </div>
  );
}

function ScoreCompositionBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 dark:text-zinc-400">{label}</span>
        <span className="font-medium text-gray-700 dark:text-zinc-300">{value}/{max}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── New Analysis Form ────────────────────────────────────────────────────────

interface NovaAnaliseFormProps {
  open: boolean;
  onClose: () => void;
}

function NovaAnaliseForm({ open, onClose }: NovaAnaliseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCliente, setSelectedCliente] = useState("");
  const [transcricaoManual, setTranscricaoManual] = useState("");

  const { data: clientesTriagem = [] } = useQuery<{ nome: string; vendedor: string | null; squad: string | null; servico: string | null }[]>({
    queryKey: ["/api/triagem/clientes"],
    queryFn: async () => {
      const res = await fetch("/api/triagem/clientes");
      if (!res.ok) throw new Error("Erro ao buscar clientes");
      return res.json();
    },
    enabled: open,
  });

  const clienteSelecionado = clientesTriagem.find(c => c.nome === selectedCliente);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/triagem/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNome: selectedCliente,
          vendedor: clienteSelecionado?.vendedor || undefined,
          squad: clienteSelecionado?.squad || undefined,
          produto: clienteSelecionado?.servico || undefined,
          transcricaoManual: transcricaoManual || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao analisar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/triagem"] });
      toast({ title: "Análise criada com sucesso!" });
      onClose();
      setSelectedCliente("");
      setTranscricaoManual("");
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            Nova Análise de Triagem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-gray-700 dark:text-zinc-300">Cliente em Triagem *</Label>
            <Select value={selectedCliente} onValueChange={setSelectedCliente}>
              <SelectTrigger className="mt-1 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                {clientesTriagem.length === 0 ? (
                  <SelectItem value="_empty" disabled className="text-gray-400 dark:text-zinc-500">
                    Nenhum cliente em triagem
                  </SelectItem>
                ) : (
                  clientesTriagem.map(c => (
                    <SelectItem key={c.nome} value={c.nome} className="text-gray-900 dark:text-white">
                      {c.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {clienteSelecionado && (
            <div className="grid grid-cols-3 gap-2">
              {clienteSelecionado.vendedor && (
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 dark:text-zinc-500">Vendedor</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{clienteSelecionado.vendedor}</p>
                </div>
              )}
              {clienteSelecionado.squad && (
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 dark:text-zinc-500">Squad</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{clienteSelecionado.squad}</p>
                </div>
              )}
              {clienteSelecionado.servico && (
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 dark:text-zinc-500">Serviço</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{clienteSelecionado.servico}</p>
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-gray-700 dark:text-zinc-300">
              Transcrição Manual
              <span className="ml-1 text-xs text-gray-400 dark:text-zinc-500">(se não informada, buscará no Google Drive)</span>
            </Label>
            <Textarea
              className="mt-1 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white resize-none"
              placeholder="Cole aqui a transcrição da reunião de venda..."
              rows={6}
              value={transcricaoManual}
              onChange={e => setTranscricaoManual(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!selectedCliente || mutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
          >
            {mutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analisar com IA
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Decision Modal ──────────────────────────────────────────────────────────

interface DecisaoModalProps {
  analise: TriagemAnalise | null;
  onClose: () => void;
}

function DecisaoModal({ analise, onClose }: DecisaoModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [decisao, setDecisao] = useState<"aprovado" | "rejeitado" | "escalado">("aprovado");
  const [observacoes, setObservacoes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!analise) return;
      const res = await fetch(`/api/triagem/${analise.id}/decidir`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: decisao,
          decisaoPor: (user as any)?.nome || (user as any)?.email || "Sistema",
          observacoes: observacoes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Erro ao registrar decisão");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/triagem"] });
      toast({ title: "Decisão registrada!" });
      onClose();
    },
    onError: () => {
      toast({ title: "Erro ao registrar decisão", variant: "destructive" });
    },
  });

  if (!analise) return null;

  return (
    <Dialog open={!!analise} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            Registrar Decisão — {analise.clienteNome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-gray-700 dark:text-zinc-300">Decisão</Label>
            <div className="flex gap-2 mt-2">
              {(["aprovado", "rejeitado", "escalado"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setDecisao(opt)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    decisao === opt
                      ? opt === "aprovado"
                        ? "bg-green-600 text-white border-green-600"
                        : opt === "rejeitado"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-orange-500 text-white border-orange-500"
                      : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700"
                  }`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-gray-700 dark:text-zinc-300">Observações</Label>
            <Textarea
              className="mt-1 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white resize-none"
              placeholder="Justificativa ou comentários adicionais..."
              rows={3}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {mutation.isPending ? "Salvando..." : "Confirmar Decisão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail Sheet ────────────────────────────────────────────────────────────

interface DetailSheetProps {
  analise: TriagemAnalise | null;
  onClose: () => void;
  onDecide: (a: TriagemAnalise) => void;
  onDelete: (a: TriagemAnalise) => void;
}

function DetailSheet({ analise, onClose, onDecide, onDelete }: DetailSheetProps) {
  if (!analise) return null;

  const aj = analise.analiseJson;

  const criterios = aj
    ? [
        { key: "expectativa_irreal", label: "Expectativa Irreal de Resultado", data: aj.analise.expectativa_irreal },
        { key: "falta_estrutura", label: "Falta de Estrutura / Orçamento", data: aj.analise.falta_estrutura },
        { key: "servico_inadequado", label: "Serviço Vendido Inadequado", data: aj.analise.servico_inadequado },
      ]
    : [];

  return (
    <Sheet open={!!analise} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white text-xl">
            {analise.clienteNome}
          </SheetTitle>
          <SheetDescription className="sr-only">Detalhes da análise de triagem</SheetDescription>
          <div className="flex items-center gap-2 flex-wrap">
            <ScoreBadge score={analise.score} />
            <StatusBadge status={analise.status} />
            {analise.produto && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
                <Package className="w-3 h-3" />
                {analise.produto}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Score bar */}
          {analise.scoreNumerico !== null && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-zinc-400">Score de Risco</span>
                <span className="font-semibold text-gray-900 dark:text-white">{analise.scoreNumerico}/100</span>
              </div>
              <ScoreBar value={analise.scoreNumerico} />
            </div>
          )}

          {/* Score Composition */}
          {aj?.composicao_score && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
                Composição do Score
              </h3>
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-3">
                <ScoreCompositionBar
                  label="Expectativa Irreal"
                  value={aj.composicao_score.expectativa_irreal}
                  max={40}
                  color="bg-red-500"
                />
                <ScoreCompositionBar
                  label="Falta de Estrutura"
                  value={aj.composicao_score.falta_estrutura}
                  max={35}
                  color="bg-orange-500"
                />
                <ScoreCompositionBar
                  label="Serviço Inadequado"
                  value={aj.composicao_score.servico_inadequado}
                  max={25}
                  color="bg-yellow-500"
                />
                {aj.composicao_score.agravantes_total > 0 && (
                  <div className="flex justify-between text-xs pt-1 border-t border-gray-200 dark:border-zinc-700">
                    <span className="text-red-600 dark:text-red-400">+ Agravantes</span>
                    <span className="font-medium text-red-600 dark:text-red-400">+{aj.composicao_score.agravantes_total}</span>
                  </div>
                )}
                {aj.composicao_score.atenuantes_total > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600 dark:text-green-400">- Atenuantes</span>
                    <span className="font-medium text-green-600 dark:text-green-400">-{aj.composicao_score.atenuantes_total}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs pt-1 border-t border-gray-200 dark:border-zinc-700">
                  <span className="text-gray-500 dark:text-zinc-500 font-mono">{aj.composicao_score.formula}</span>
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            {analise.squad && (
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-0.5">Squad</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{analise.squad}</p>
              </div>
            )}
            {analise.vendedor && (
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-0.5">Vendedor</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{analise.vendedor}</p>
              </div>
            )}
            {analise.valorContrato && (
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-0.5">Valor do Contrato</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(Number(analise.valorContrato))}
                </p>
              </div>
            )}
            {analise.transcricaoUrl && (
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-0.5">Transcrição</p>
                <a
                  href={analise.transcricaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline"
                >
                  Ver no Drive <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Resumo */}
          {aj?.resumo && (
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-lg p-4">
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1">Resumo da IA</p>
              <p className="text-sm text-gray-700 dark:text-zinc-300">{aj.resumo}</p>
              {aj.recomendacao && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Recomendação</p>
                  <span className={`text-sm font-semibold ${
                    aj.recomendacao === "Aprovar"
                      ? "text-green-600 dark:text-green-400"
                      : aj.recomendacao === "Rejeitar - alto risco"
                      ? "text-red-600 dark:text-red-400"
                      : "text-yellow-600 dark:text-yellow-400"
                  }`}>
                    {aj.recomendacao}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Criteria */}
          {criterios.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
                Critérios Analisados
              </h3>
              {criterios.map(({ label, data }) => (
                <div
                  key={label}
                  className={`rounded-lg border p-4 ${
                    data.detectado
                      ? "border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10"
                      : "border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                    <div className="flex items-center gap-2">
                      {data.detectado ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      <span className={`text-xs font-medium capitalize ${SEVERIDADE_CONFIG[data.severidade]}`}>
                        {data.severidade === "nenhuma" ? "Não detectado" : `Severidade: ${data.severidade}`}
                      </span>
                      {data.pontos > 0 && (
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          +{data.pontos} pts
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-zinc-400">{data.justificativa}</p>
                  {data.trechos.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {data.trechos.map((trecho, i) => (
                        <blockquote
                          key={i}
                          className="text-xs italic text-gray-500 dark:text-zinc-500 border-l-2 border-gray-300 dark:border-zinc-600 pl-2"
                        >
                          "{trecho}"
                        </blockquote>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Agravantes */}
          {aj?.agravantes && aj.agravantes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Sinais Agravantes (+{aj.agravantes.reduce((s, a) => s + a.pontos, 0)} pts)
              </h3>
              <div className="space-y-2">
                {aj.agravantes.map((agr, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{agr.sinal}</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">+{agr.pontos} pts</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">{agr.justificativa}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Atenuantes */}
          {aj?.atenuantes && aj.atenuantes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Sinais Atenuantes (-{aj.atenuantes.reduce((s, a) => s + a.pontos, 0)} pts)
              </h3>
              <div className="space-y-2">
                {aj.atenuantes.map((att, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{att.sinal}</span>
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">-{att.pontos} pts</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">{att.justificativa}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Avaliação do Vendedor */}
          {aj?.avaliacao_vendedor && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Avaliação do Vendedor
                </h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  aj.avaliacao_vendedor.nota_geral === "boa"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : aj.avaliacao_vendedor.nota_geral === "ruim"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}>
                  {aj.avaliacao_vendedor.nota_geral === "boa" ? "Boa" : aj.avaliacao_vendedor.nota_geral === "ruim" ? "Ruim" : "Regular"}
                </span>
              </div>

              <p className="text-sm text-gray-600 dark:text-zinc-400 italic">
                {aj.avaliacao_vendedor.resumo_vendedor}
              </p>

              {aj.avaliacao_vendedor.pontos_negativos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                    <ThumbsDown className="w-3 h-3" /> Pontos Negativos
                  </p>
                  {aj.avaliacao_vendedor.pontos_negativos.map((ponto, i) => (
                    <div key={i} className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 p-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{ponto.aspecto}</p>
                      <p className="text-xs text-gray-600 dark:text-zinc-400">{ponto.justificativa}</p>
                      {ponto.trecho && (
                        <blockquote className="mt-1.5 text-xs italic text-gray-500 dark:text-zinc-500 border-l-2 border-red-300 dark:border-red-700 pl-2">
                          "{ponto.trecho}"
                        </blockquote>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {aj.avaliacao_vendedor.pontos_positivos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> Pontos Positivos
                  </p>
                  {aj.avaliacao_vendedor.pontos_positivos.map((ponto, i) => (
                    <div key={i} className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10 p-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{ponto.aspecto}</p>
                      <p className="text-xs text-gray-600 dark:text-zinc-400">{ponto.justificativa}</p>
                      {ponto.trecho && (
                        <blockquote className="mt-1.5 text-xs italic text-gray-500 dark:text-zinc-500 border-l-2 border-green-300 dark:border-green-700 pl-2">
                          "{ponto.trecho}"
                        </blockquote>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Decision info */}
          {analise.status !== "pendente" && (
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 space-y-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wide mb-2">Decisão Registrada</p>
              <div className="flex items-center gap-2">
                <StatusBadge status={analise.status} />
                {analise.decisaoPor && (
                  <span className="text-sm text-gray-600 dark:text-zinc-400 flex items-center gap-1">
                    <User className="w-3 h-3" /> {analise.decisaoPor}
                  </span>
                )}
              </div>
              {analise.decisaoObservacoes && (
                <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">{analise.decisaoObservacoes}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {analise.status === "pendente" && (
              <Button
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white gap-2"
                onClick={() => { onClose(); onDecide(analise); }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Registrar Decisão
              </Button>
            )}
            <Button
              variant="outline"
              className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 gap-2"
              onClick={() => { onClose(); onDelete(analise); }}
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Card Component ──────────────────────────────────────────────────────────

interface AnaliseCardProps {
  analise: TriagemAnalise;
  onView: (a: TriagemAnalise) => void;
  onDecide: (a: TriagemAnalise) => void;
}

function AnaliseCard({ analise, onView, onDecide }: AnaliseCardProps) {
  const aj = analise.analiseJson;
  const detectedCount = aj
    ? Object.values(aj.analise).filter(c => c.detectado).length + (aj.agravantes?.length || 0)
    : 0;
  const mitigatorCount = aj?.atenuantes?.length || 0;

  return (
    <Card
      className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors cursor-pointer group"
      onClick={() => onView(analise)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{analise.clienteNome}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ScoreBadge score={analise.score} />
              <StatusBadge status={analise.status} />
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-zinc-600 shrink-0 group-hover:text-violet-500 transition-colors mt-1" />
        </div>

        {/* Score bar */}
        {analise.scoreNumerico !== null && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-500">
              <span>Score de risco</span>
              <span className="font-medium text-gray-700 dark:text-zinc-300">{analise.scoreNumerico}/100</span>
            </div>
            <ScoreBar value={analise.scoreNumerico} />
          </div>
        )}

        {/* Meta */}
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-500 flex-wrap">
          {analise.squad && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {analise.squad}
            </span>
          )}
          {analise.produto && (
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" /> {analise.produto}
            </span>
          )}
          {analise.valorContrato && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> {formatCurrency(Number(analise.valorContrato))}
            </span>
          )}
          {detectedCount > 0 && (
            <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
              <AlertTriangle className="w-3 h-3" /> {detectedCount} sinal{detectedCount > 1 ? "is" : ""}
            </span>
          )}
          {mitigatorCount > 0 && (
            <span className="flex items-center gap-1 text-green-500 dark:text-green-400">
              <ShieldCheck className="w-3 h-3" /> {mitigatorCount} atenuante{mitigatorCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Resumo */}
        {aj?.recomendacao && (
          <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500 italic truncate">{aj.recomendacao}</p>
        )}

        {/* Decision button for pending */}
        {analise.status === "pendente" && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-400"
              onClick={(e) => { e.stopPropagation(); onDecide(analise); }}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Decidir
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400"
              onClick={(e) => { e.stopPropagation(); onView(analise); }}
            >
              <Eye className="w-3 h-3 mr-1" />
              Ver Análise
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Triagem() {
  useSetPageInfo("Triagem Inteligente", "Análise de risco pré-onboarding");

  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterScore, setFilterScore] = useState("todos");
  const [search, setSearch] = useState("");
  const [showNovaAnalise, setShowNovaAnalise] = useState(false);
  const [selectedAnalise, setSelectedAnalise] = useState<TriagemAnalise | null>(null);
  const [decisaoAnalise, setDecisaoAnalise] = useState<TriagemAnalise | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/triagem/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir análise");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/triagem"] });
      toast({ title: "Análise excluída com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir análise", variant: "destructive" });
    },
  });

  function handleDelete(analise: TriagemAnalise) {
    if (confirm(`Excluir análise de "${analise.clienteNome}"?`)) {
      deleteMutation.mutate(analise.id);
    }
  }

  const params = new URLSearchParams();
  if (filterStatus !== "todos") params.set("status", filterStatus);
  if (filterScore !== "todos") params.set("score", filterScore);

  const { data: analises = [], isLoading } = useQuery<TriagemAnalise[]>({
    queryKey: ["/api/triagem", filterStatus, filterScore],
    queryFn: async () => {
      const res = await fetch(`/api/triagem?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar análises");
      return res.json();
    },
  });

  const filtered = analises.filter(a =>
    !search || a.clienteNome.toLowerCase().includes(search.toLowerCase()) ||
    (a.squad && a.squad.toLowerCase().includes(search.toLowerCase())) ||
    (a.vendedor && a.vendedor.toLowerCase().includes(search.toLowerCase()))
  );

  // Summary stats
  const total = analises.length;
  const pendentes = analises.filter(a => a.status === "pendente").length;
  const alto = analises.filter(a => a.score === "alto").length;
  const aprovados = analises.filter(a => a.status === "aprovado").length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-violet-500" />
            Triagem Inteligente
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-0.5">
            Análise de risco pré-onboarding com IA
          </p>
        </div>
        <Button
          onClick={() => setShowNovaAnalise(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Análise
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: total, icon: ShieldAlert, color: "text-gray-700 dark:text-zinc-300" },
          { label: "Pendentes", value: pendentes, icon: Clock, color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Alto Risco", value: alto, icon: ShieldX, color: "text-red-600 dark:text-red-400" },
          { label: "Aprovados", value: aprovados, icon: ShieldCheck, color: "text-green-600 dark:text-green-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>
                    {isLoading ? "—" : value}
                  </p>
                </div>
                <Icon className={`w-6 h-6 ${color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <Input
            className="pl-9 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
            placeholder="Buscar por cliente, squad, vendedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectItem value="todos" className="text-gray-900 dark:text-white">Todos</SelectItem>
            <SelectItem value="pendente" className="text-gray-900 dark:text-white">Pendente</SelectItem>
            <SelectItem value="aprovado" className="text-gray-900 dark:text-white">Aprovado</SelectItem>
            <SelectItem value="rejeitado" className="text-gray-900 dark:text-white">Rejeitado</SelectItem>
            <SelectItem value="escalado" className="text-gray-900 dark:text-white">Escalado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterScore} onValueChange={setFilterScore}>
          <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white">
            <SelectValue placeholder="Risco" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectItem value="todos" className="text-gray-900 dark:text-white">Todos</SelectItem>
            <SelectItem value="alto" className="text-gray-900 dark:text-white">Alto Risco</SelectItem>
            <SelectItem value="medio" className="text-gray-900 dark:text-white">Médio Risco</SelectItem>
            <SelectItem value="baixo" className="text-gray-900 dark:text-white">Baixo Risco</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ShieldAlert className="w-12 h-12 text-gray-300 dark:text-zinc-700 mb-3" />
          <p className="text-gray-500 dark:text-zinc-500 font-medium">Nenhuma análise encontrada</p>
          <p className="text-sm text-gray-400 dark:text-zinc-600 mt-1">
            {search || filterStatus !== "todos" || filterScore !== "todos"
              ? "Tente ajustar os filtros"
              : "Crie a primeira análise de triagem"}
          </p>
          {!search && filterStatus === "todos" && filterScore === "todos" && (
            <Button
              className="mt-4 bg-violet-600 hover:bg-violet-700 text-white gap-2"
              onClick={() => setShowNovaAnalise(true)}
            >
              <Plus className="w-4 h-4" />
              Nova Análise
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(analise => (
            <AnaliseCard
              key={analise.id}
              analise={analise}
              onView={setSelectedAnalise}
              onDecide={setDecisaoAnalise}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <NovaAnaliseForm open={showNovaAnalise} onClose={() => setShowNovaAnalise(false)} />
      <DetailSheet
        analise={selectedAnalise}
        onClose={() => setSelectedAnalise(null)}
        onDecide={(a) => { setSelectedAnalise(null); setDecisaoAnalise(a); }}
        onDelete={(a) => { setSelectedAnalise(null); handleDelete(a); }}
      />
      <DecisaoModal
        analise={decisaoAnalise}
        onClose={() => setDecisaoAnalise(null)}
      />
    </div>
  );
}
