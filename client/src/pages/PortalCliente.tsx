import { useState, useRef, useEffect, lazy, Suspense } from "react";
import type React from "react";
import { useLocation } from "wouter";

const PortalPerformance = lazy(() => import("@/pages/PortalPerformance"));
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClientAuth, ClientAuthProvider } from "@/contexts/ClientAuthContext";
import type { ClientUser } from "@/contexts/ClientAuthContext";
import { Loader2, Building2, Mail, Phone, LogOut, CircleDollarSign, CheckCircle2, AlertCircle, Clock, ExternalLink, BarChart3, Briefcase, Pencil, Check, X, XCircle, TrendingUp, TrendingDown, Receipt, MessageSquare, Send, User, Sun, Moon, Lock, Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

type Module = 'financeiro' | 'relatorios' | 'servicos' | 'atendimento';

interface ChatMensagem {
  id: number;
  clientId: number;
  remetenteTipo: 'cliente' | 'colaborador';
  remetenteNome: string | null;
  mensagem: string;
  lida: boolean;
  criadoEm: string;
}

interface ChatData {
  mensagens: ChatMensagem[];
  responsavel: string | null;
}

interface Fatura {
  id: string | number;
  status: string | null;
  valorBruto: string | null;
  valorPago: string | null;
  descricao: string | null;
  dataVencimento: string | null;
  dataQuitacao: string | null;
  naoPago: string | null;
  categoriaNome: string | null;
  tipoEvento: string | null;
  urlCobranca: string | null;
}

interface ResumoFinanceiro {
  faturas: Fatura[];
  totais: { total: number; pago: number; naoPago: number };
}

interface Servico {
  produto: string | null;
  status: string | null;
  responsavel: string | null;
}

function formatCurrency(value: number | string | null | undefined) {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? '').toUpperCase();
  if (s === 'RECEBIDO' || s === 'PAGO' || s === 'QUITADO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" />
        Pago
      </span>
    );
  }
  if (s === 'ATRASADO' || s === 'VENCIDO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <AlertCircle className="w-3 h-3" />
        Atrasado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Clock className="w-3 h-3" />
      {status ?? 'Pendente'}
    </span>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return 'Hoje';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ── Mensagens especiais do chat ───────────────────────────────────────────────
type SystemMsg =
  | { _type: 'encerramento'; atendimentoId: number; encerradoPor: string }
  | { _type: 'avaliacao_request'; atendimentoId: number }
  | { _type: 'avaliacao_respondida'; atendimentoId: number; nota: number };

function parseSystemMsg(mensagem: string): SystemMsg | null {
  try {
    const p = JSON.parse(mensagem);
    if (p && ['encerramento', 'avaliacao_request', 'avaliacao_respondida', 'cancelamento'].includes(p._type)) return p;
  } catch { /* não é JSON */ }
  return null;
}

function EncerramentoBanner({ msg }: { msg: { _type: 'encerramento'; encerradoPor: string } }) {
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80 border border-white/[0.07]">
        <Check className="w-3 h-3 text-emerald-400/70" />
        <span className="text-[11px] text-white/35">Atendimento encerrado por <span className="text-white/50">{msg.encerradoPor}</span></span>
      </div>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

function AvaliacaoWidget({ atendimentoId }: { atendimentoId: number }) {
  const queryClient = useQueryClient();
  const [nota, setNota] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');

  const avaliarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/portal-cliente/avaliar-atendimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atendimentoId, nota, comentario }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao enviar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal-cliente/chat'] });
    },
  });

  const EMOJIS = ['😡', '😟', '😐', '🙂', '😍'];
  const LABELS = ['Péssimo', 'Ruim', 'Regular', 'Bom', 'Ótimo'];
  const active = hover ?? nota;

  return (
    <div className="rounded-2xl border border-blue-500/15 bg-blue-950/15 overflow-hidden">
      <div className="px-4 py-3 border-b border-blue-500/10">
        <p className="text-sm font-medium text-white/70">Como foi o atendimento?</p>
        <p className="text-[11px] text-white/30 mt-0.5">Sua avaliação nos ajuda a melhorar</p>
      </div>
      <div className="px-4 py-3 space-y-3">
        {/* Estrelas */}
        <div className="flex items-center justify-center gap-2">
          {[1,2,3,4,5].map(i => (
            <button
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setNota(i)}
              className="flex flex-col items-center gap-1 transition-transform hover:scale-110"
            >
              <span className={`text-2xl leading-none transition-all ${active && i <= active ? 'opacity-100' : 'opacity-25'}`}>
                {EMOJIS[i - 1]}
              </span>
              {active === i && (
                <span className="text-[9px] text-white/40">{LABELS[i - 1]}</span>
              )}
            </button>
          ))}
        </div>
        {/* Comentário */}
        {nota && (
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            placeholder="Comentário opcional..."
            rows={2}
            className="w-full bg-zinc-800/60 border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-blue-500/30 resize-none"
          />
        )}
        <button
          onClick={() => avaliarMutation.mutate()}
          disabled={!nota || avaliarMutation.isPending}
          className="w-full py-2 rounded-xl bg-blue-600/25 hover:bg-blue-600/35 border border-blue-500/20 text-sm text-blue-300/80 font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {avaliarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Enviar avaliação'}
        </button>
      </div>
    </div>
  );
}

function AvaliacaoRespondida({ nota }: { nota: number }) {
  const EMOJIS = ['😡', '😟', '😐', '🙂', '😍'];
  const LABELS = ['Péssimo', 'Ruim', 'Regular', 'Bom', 'Ótimo'];
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-800/40 border border-white/[0.06]">
      <span className="text-2xl">{EMOJIS[nota - 1]}</span>
      <div>
        <p className="text-xs font-medium text-white/60">Avaliação enviada</p>
        <p className="text-[11px] text-white/30">{LABELS[nota - 1]} · Obrigado pelo feedback!</p>
      </div>
      <div className="ml-auto flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <span key={i} className={`text-sm ${i <= nota ? 'opacity-100' : 'opacity-15'}`}>⭐</span>
        ))}
      </div>
    </div>
  );
}

function ChatModuloCliente({ clientId }: { clientId: number }) {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<ChatData>({
    queryKey: ['/api/portal-cliente/chat'],
    refetchInterval: 3000,
    staleTime: 0,
  });

  const enviarMutation = useMutation({
    mutationFn: async (mensagem: string) => {
      const res = await fetch('/api/portal-cliente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao enviar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal-cliente/chat'] });
    },
  });

  // Scroll automático para o final das mensagens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.mensagens?.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = inputValue.trim();
    if (!msg) return;
    setInputValue('');
    enviarMutation.mutate(msg);
  }

  const mensagens = data?.mensagens ?? [];
  const responsavel = data?.responsavel ?? null;

  return (
    <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col" style={{ height: '520px' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/20 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-blue-400/70" />
        </div>
        <div>
          <p className="text-sm font-medium text-white/75">Atendimento</p>
          {responsavel && (
            <p className="text-[11px] text-white/30">
              Responsável: <span className="text-white/50">{responsavel}</span>
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
          <span className="text-[11px] text-white/25">Online</span>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-white/20" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/[0.06] flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white/15" />
            </div>
            <div>
              <p className="text-white/30 text-sm font-medium">Nenhuma mensagem ainda</p>
              <p className="text-white/15 text-xs mt-0.5">Envie uma mensagem para iniciar o atendimento</p>
            </div>
          </div>
        ) : (
          <>
            {mensagens.map((msg, idx) => {
              const isCliente = msg.remetenteTipo === 'cliente';
              const prevMsg = idx > 0 ? mensagens[idx - 1] : null;
              const showDayLabel = !prevMsg || formatDayLabel(msg.criadoEm) !== formatDayLabel(prevMsg.criadoEm);
              const sysMsg = parseSystemMsg(msg.mensagem);

              return (
                <div key={msg.id}>
                  {showDayLabel && (
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-white/[0.05]" />
                      <span className="text-[10px] text-white/20 px-2">{formatDayLabel(msg.criadoEm)}</span>
                      <div className="flex-1 h-px bg-white/[0.05]" />
                    </div>
                  )}
                  {sysMsg?._type === 'encerramento' ? (
                    <EncerramentoBanner msg={sysMsg as any} />
                  ) : sysMsg?._type === 'avaliacao_request' ? (
                    <AvaliacaoWidget atendimentoId={(sysMsg as any).atendimentoId} />
                  ) : sysMsg?._type === 'avaliacao_respondida' ? (
                    <AvaliacaoRespondida nota={(sysMsg as any).nota} />
                  ) : sysMsg?._type === 'cancelamento' ? null : (
                    <div className={`flex ${isCliente ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex items-end gap-2 max-w-[80%] ${isCliente ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1 ${
                          isCliente ? 'bg-blue-600/30 border border-blue-500/20' : 'bg-zinc-700 border border-white/[0.08]'
                        }`}>
                          <User className="w-3 h-3 text-white/40" />
                        </div>
                        <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                          isCliente
                            ? 'bg-blue-600/25 border border-blue-500/20 text-white/85 rounded-br-sm'
                            : 'bg-zinc-800 border border-white/[0.07] text-white/70 rounded-bl-sm'
                        }`}>
                          {!isCliente && msg.remetenteNome && (
                            <p className="text-[10px] text-white/30 mb-1 font-medium">{msg.remetenteNome}</p>
                          )}
                          <p>{msg.mensagem}</p>
                          <p className={`text-[10px] mt-1 ${isCliente ? 'text-blue-300/30' : 'text-white/20'} text-right`}>
                            {formatTime(msg.criadoEm)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.05] shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-zinc-800 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/15 transition-colors"
            disabled={enviarMutation.isPending}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || enviarMutation.isPending}
            className="w-10 h-10 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/20 flex items-center justify-center text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {enviarMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatFlutuante({ clientId, onClose }: { clientId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<ChatData>({
    queryKey: ['/api/portal-cliente/chat'],
    refetchInterval: 3000,
    staleTime: 0,
  });

  const enviarMutation = useMutation({
    mutationFn: async (mensagem: string) => {
      const res = await fetch('/api/portal-cliente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao enviar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal-cliente/chat'] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.mensagens?.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = inputValue.trim();
    if (!msg) return;
    setInputValue('');
    enviarMutation.mutate(msg);
  }

  const mensagens = data?.mensagens ?? [];
  const responsavel = data?.responsavel ?? null;

  return (
    <div className="fixed bottom-24 right-5 w-80 rounded-2xl bg-zinc-900 border border-white/[0.10] shadow-2xl shadow-black/50 overflow-hidden flex flex-col z-50"
      style={{ height: '420px' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2.5 shrink-0 bg-zinc-800/60">
        <div className="w-7 h-7 rounded-full bg-blue-600/25 border border-blue-500/20 flex items-center justify-center shrink-0">
          <MessageSquare className="w-3.5 h-3.5 text-blue-400/80" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/75">Atendimento</p>
          {responsavel && (
            <p className="text-[10px] text-white/30 truncate">Com {responsavel}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-4 h-4 animate-spin text-white/20" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <MessageSquare className="w-8 h-8 text-white/10" />
            <p className="text-white/25 text-xs">Envie uma mensagem para iniciar o atendimento</p>
          </div>
        ) : (
          <>
            {mensagens.map((msg, idx) => {
              const isCliente = msg.remetenteTipo === 'cliente';
              const prevMsg = idx > 0 ? mensagens[idx - 1] : null;
              const showDay = !prevMsg || formatDayLabel(msg.criadoEm) !== formatDayLabel(prevMsg.criadoEm);
              const sysMsg = parseSystemMsg(msg.mensagem);
              return (
                <div key={msg.id}>
                  {showDay && (
                    <div className="flex items-center gap-1.5 my-1.5">
                      <div className="flex-1 h-px bg-white/[0.05]" />
                      <span className="text-[9px] text-white/20">{formatDayLabel(msg.criadoEm)}</span>
                      <div className="flex-1 h-px bg-white/[0.05]" />
                    </div>
                  )}
                  {sysMsg?._type === 'encerramento' ? (
                    <EncerramentoBanner msg={sysMsg as any} />
                  ) : sysMsg?._type === 'avaliacao_request' ? (
                    <AvaliacaoWidget atendimentoId={(sysMsg as any).atendimentoId} />
                  ) : sysMsg?._type === 'avaliacao_respondida' ? (
                    <AvaliacaoRespondida nota={(sysMsg as any).nota} />
                  ) : sysMsg?._type === 'cancelamento' ? null : (
                    <div className={`flex ${isCliente ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        isCliente
                          ? 'bg-blue-600/25 border border-blue-500/20 text-white/80 rounded-br-sm'
                          : 'bg-zinc-800 border border-white/[0.07] text-white/65 rounded-bl-sm'
                      }`}>
                        {!isCliente && msg.remetenteNome && (
                          <p className="text-[9px] text-white/30 mb-0.5 font-medium">{msg.remetenteNome}</p>
                        )}
                        <p>{msg.mensagem}</p>
                        <p className={`text-[9px] mt-0.5 text-right ${isCliente ? 'text-blue-300/25' : 'text-white/18'}`}>
                          {formatTime(msg.criadoEm)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-white/[0.05] shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="flex-1 bg-zinc-800 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/75 placeholder:text-white/20 focus:outline-none focus:border-blue-500/35 transition-colors"
            disabled={enviarMutation.isPending}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || enviarMutation.isPending}
            className="w-8 h-8 rounded-lg bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/20 flex items-center justify-center text-blue-400 transition-colors disabled:opacity-30 shrink-0"
          >
            {enviarMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Constantes do formulário de cancelamento ───────────────────────────────

const MOTIVOS_CANCELAMENTO = [
  'Resultado abaixo do esperado',
  'Custo × benefício não justifica',
  'Mudança de estratégia interna',
  'Insatisfação com o atendimento',
  'Crise financeira / corte de custos',
  'Encerramento da empresa',
  'Outro',
];

const PONTOS_MELHORIA = [
  'Comunicação com o time',
  'Frequência das entregas',
  'Qualidade dos materiais',
  'Resultados e métricas apresentados',
  'Suporte e atendimento',
  'Transparência nas estratégias',
  'Relação custo-benefício',
];

const PROXIMO_PASSO_OPCOES = [
  'Farei as ações internamente',
  'Contratarei outro fornecedor',
  'Vou pausar os investimentos',
  'Ainda não decidi',
];

const RETORNO_OPCOES = [
  'Sim, com certeza',
  'Talvez, dependendo das condições',
  'Provavelmente não',
];

const URGENCIAS_CANCELAMENTO = [
  { value: 'imediato', label: 'Imediato' },
  { value: 'fim_periodo', label: 'No final do período contratado' },
  { value: 'a_combinar', label: 'A combinar' },
];

const NOTAS_CONFIG = [
  { value: 1, emoji: '😞', label: 'Péssimo', activeClass: 'bg-red-500/20 border-red-500/40 text-red-300' },
  { value: 2, emoji: '😕', label: 'Ruim',    activeClass: 'bg-orange-500/20 border-orange-500/40 text-orange-300' },
  { value: 3, emoji: '😐', label: 'Regular', activeClass: 'bg-amber-500/15 border-amber-500/35 text-amber-300' },
  { value: 4, emoji: '🙂', label: 'Bom',     activeClass: 'bg-lime-500/15 border-lime-500/35 text-lime-300' },
  { value: 5, emoji: '😊', label: 'Ótimo',   activeClass: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300' },
];

// ── Componente do formulário ────────────────────────────────────────────────

function CancelamentoModal({ servico, onClose }: { servico: Servico; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nota, setNota] = useState<number | null>(null);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [pontosMelhoria, setPontosMelhoria] = useState<string[]>([]);
  const [proximoPasso, setProximoPasso] = useState('');
  const [retorno, setRetorno] = useState('');
  const [urgencia, setUrgencia] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  function toggle(list: string[], set: (v: string[]) => void, item: string) {
    set(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!motivos.length) { setError('Selecione ao menos um motivo.'); return; }
    if (!urgencia) { setError('Informe a urgência do cancelamento.'); return; }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/portal-cliente/solicitacao-cancelamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto: servico.produto,
          nota,
          motivos,
          pontosMelhoria: pontosMelhoria.length > 0 ? pontosMelhoria : null,
          proximoPasso: proximoPasso || null,
          retorno: retorno || null,
          urgencia,
          detalhe: detalhe.trim() || null,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Erro ao enviar'); return; }
      queryClient.invalidateQueries({ queryKey: ['/api/portal-cliente/chat'] });
      setEnviado(true);
    } catch {
      setError('Erro ao conectar');
    } finally {
      setSending(false);
    }
  }

  /* helpers de renderização */
  function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
    return (
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
          checked ? 'bg-red-500/15 border-red-500/40' : 'bg-zinc-800 border-white/[0.12] group-hover:border-white/25'
        }`}>
          {checked && <Check className="w-2.5 h-2.5 text-red-400" />}
        </div>
        <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <span className={`text-sm transition-colors ${checked ? 'text-white/80' : 'text-white/40 group-hover:text-white/60'}`}>{label}</span>
      </label>
    );
  }

  function RadioRow({ value, label, selected, onChange }: { value: string; label: string; selected: boolean; onChange: () => void }) {
    return (
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
          selected ? 'bg-amber-500/15 border-amber-500/40' : 'bg-zinc-800 border-white/[0.12] group-hover:border-white/25'
        }`}>
          {selected && <div className="w-2 h-2 rounded-full bg-amber-400" />}
        </div>
        <input type="radio" className="sr-only" checked={selected} onChange={onChange} />
        <span className={`text-sm transition-colors ${selected ? 'text-white/80' : 'text-white/40 group-hover:text-white/60'}`}>{label}</span>
      </label>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/[0.10] rounded-2xl w-full max-w-lg shadow-2xl shadow-black/50 overflow-hidden">

        {enviado ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <p className="text-white/85 font-semibold">Solicitação enviada!</p>
              <p className="text-white/35 text-sm leading-relaxed max-w-xs">
                Nossa equipe recebeu o pedido de cancelamento e entrará em contato em breve.
              </p>
            </div>
            <button onClick={onClose} className="mt-1 px-6 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white/55 hover:text-white/80 text-sm font-medium transition-colors border border-white/[0.08]">
              Fechar
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-white/90 font-semibold text-sm">Solicitar Cancelamento</p>
                  <p className="text-white/30 text-xs mt-0.5 line-clamp-1">{servico.produto ?? 'Serviço'}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto divide-y divide-white/[0.05]" style={{ maxHeight: 'calc(85vh - 130px)' }}>

              {/* 1 — Satisfação geral */}
              <div className="p-5 space-y-3">
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Satisfação geral com o serviço</p>
                <div className="flex gap-2">
                  {NOTAS_CONFIG.map(({ value, emoji, label, activeClass }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNota(nota === value ? null : value)}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
                        nota === value
                          ? activeClass
                          : 'bg-zinc-800/60 border-white/[0.08] text-white/25 hover:border-white/20 hover:text-white/50'
                      }`}
                    >
                      <span className="text-xl leading-none">{emoji}</span>
                      <span className="text-[10px]">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2 — Motivos */}
              <div className="p-5 space-y-3">
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">
                  Motivo do cancelamento <span className="text-red-400/60">*</span>
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {MOTIVOS_CANCELAMENTO.map(m => (
                    <CheckRow key={m} label={m} checked={motivos.includes(m)} onChange={() => toggle(motivos, setMotivos, m)} />
                  ))}
                </div>
              </div>

              {/* 3 — O que poderia melhorar */}
              <div className="p-5 space-y-3">
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">O que poderia ter sido melhor?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PONTOS_MELHORIA.map(m => (
                    <CheckRow key={m} label={m} checked={pontosMelhoria.includes(m)} onChange={() => toggle(pontosMelhoria, setPontosMelhoria, m)} />
                  ))}
                </div>
              </div>

              {/* 4 — Próximo passo */}
              <div className="p-5 space-y-3">
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Qual será o próximo passo?</p>
                <div className="grid grid-cols-1 gap-2">
                  {PROXIMO_PASSO_OPCOES.map(o => (
                    <RadioRow key={o} value={o} label={o} selected={proximoPasso === o} onChange={() => setProximoPasso(proximoPasso === o ? '' : o)} />
                  ))}
                </div>
              </div>

              {/* 5 — Consideraria voltar */}
              <div className="p-5 space-y-3">
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Consideraria voltar no futuro?</p>
                <div className="grid grid-cols-1 gap-2">
                  {RETORNO_OPCOES.map(o => (
                    <RadioRow key={o} value={o} label={o} selected={retorno === o} onChange={() => setRetorno(retorno === o ? '' : o)} />
                  ))}
                </div>
              </div>

              {/* 6 — Urgência */}
              <div className="p-5 space-y-3">
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">
                  Urgência do cancelamento <span className="text-red-400/60">*</span>
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {URGENCIAS_CANCELAMENTO.map(u => (
                    <RadioRow key={u.value} value={u.value} label={u.label} selected={urgencia === u.value} onChange={() => setUrgencia(u.value)} />
                  ))}
                </div>
              </div>

              {/* 7 — Observações */}
              <div className="p-5 space-y-2.5">
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">
                  Observações <span className="text-white/20 font-normal normal-case">(opcional)</span>
                </p>
                <textarea
                  value={detalhe}
                  onChange={e => setDetalhe(e.target.value)}
                  placeholder="Alguma mensagem final para o nosso time?"
                  rows={3}
                  className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/75 placeholder:text-white/20 focus:outline-none focus:border-red-500/25 resize-none transition-colors"
                />
              </div>

              {/* Footer */}
              <div className="p-5 space-y-3 bg-zinc-900/60">
                {error && <p className="text-red-400/80 text-xs">{error}</p>}
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-zinc-800 hover:bg-zinc-700/80 text-white/40 hover:text-white/60 transition-colors border border-white/[0.07]"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 hover:bg-red-500/18 text-red-400 transition-colors border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {sending ? 'Enviando...' : 'Enviar Solicitação'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function ForcePasswordChange({ onSuccess }: { onSuccess: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (currentPassword === newPassword) {
      setError('A nova senha deve ser diferente da atual');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/client-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Erro ao alterar senha');
        return;
      }
      onSuccess();
    } catch {
      setError('Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-zinc-950' : 'bg-gray-50'}`}>
      <div className={`w-full max-w-sm rounded-2xl p-8 space-y-6 shadow-2xl border ${isDark ? 'bg-zinc-900 border-white/[0.08]' : 'bg-white border-gray-200'}`}>
        <div className="text-center space-y-2">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
            <Lock className={`w-7 h-7 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          </div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Troca de Senha Obrigatória</h2>
          <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
            Por segurança, defina uma nova senha para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
              Senha Atual
            </label>
            <div className="relative">
              <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/30' : 'text-gray-400'}`} />
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
                className={`w-full rounded-xl pl-10 pr-12 py-3 text-sm border focus:outline-none focus:ring-1 ${isDark ? 'bg-zinc-800/60 border-white/[0.1] text-white focus:border-blue-500/50 focus:ring-blue-500/20' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'}`}
                required
                autoFocus
              />
              <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'} transition-colors`}>
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
              Nova Senha
            </label>
            <div className="relative">
              <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/30' : 'text-gray-400'}`} />
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                placeholder="Mínimo 6 caracteres"
                className={`w-full rounded-xl pl-10 pr-12 py-3 text-sm border focus:outline-none focus:ring-1 ${isDark ? 'bg-zinc-800/60 border-white/[0.1] text-white placeholder:text-white/20 focus:border-blue-500/50 focus:ring-blue-500/20' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20'}`}
                required
              />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'} transition-colors`}>
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/30' : 'text-gray-400'}`} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm border focus:outline-none focus:ring-1 ${isDark ? 'bg-zinc-800/60 border-white/[0.1] text-white focus:border-blue-500/50 focus:ring-blue-500/20' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'}`}
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Alterando...</span>
              </>
            ) : (
              <span>Definir Nova Senha</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function PortalClienteContent() {
  const [, setLocation] = useLocation();
  const { client, isLoading, isAuthenticated, mustChangePassword, clearMustChangePassword, logout } = useClientAuth();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [activeModule, setActiveModule] = useState<Module>('relatorios');
  const [chatOpen, setChatOpen] = useState(false);
  const [editField, setEditField] = useState<'email' | 'telefone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [cancelServico, setCancelServico] = useState<Servico | null>(null);

  function startEdit(field: 'email' | 'telefone', current: string) {
    setEditField(field);
    setEditValue(current);
    setEditError('');
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editField) return;
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch('/api/portal-cliente/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editField]: editValue }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.message || 'Erro ao salvar'); return; }
      queryClient.setQueryData<ClientUser>(['/api/auth/client-me'], (old) =>
        old ? { ...old, [editField]: editValue || null } : old
      );
      setEditField(null);
    } catch {
      setEditError('Erro ao conectar');
    } finally {
      setEditSaving(false);
    }
  }

  const { data: servicos, isLoading: isServicosLoading } = useQuery<Servico[]>({
    queryKey: ["/api/portal-cliente/servicos"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: resumo, isLoading: isResumoLoading } = useQuery<ResumoFinanceiro>({
    queryKey: ["/api/portal-cliente/resumo"],
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        <p className="text-white/30 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated || !client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-4 px-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-white font-semibold text-lg">Sessão não encontrada</h2>
          <p className="text-white/40 text-sm">
            Sua sessão expirou ou o login não foi concluído corretamente.
          </p>
          <button
            onClick={() => setLocation("/loginclientes")}
            className="w-full py-3 px-6 bg-white/10 hover:bg-white/15 text-white rounded-full text-sm transition-colors mt-2"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  if (mustChangePassword) {
    return <ForcePasswordChange onSuccess={clearMustChangePassword} />;
  }

  const totais = resumo?.totais ?? { total: 0, pago: 0, naoPago: 0 };
  const faturas = resumo?.faturas ?? [];

  const faturasAtrasadas = faturas.filter(f => ['ATRASADO', 'VENCIDO'].includes((f.status ?? '').toUpperCase()));
  const totalAtrasado = faturasAtrasadas.reduce((sum, f) => sum + parseFloat(f.valorBruto ?? '0'), 0);

  const isAtivo = client.ativo === true || client.ativo === 'true' || client.ativo === '1' || String(client.ativo ?? '').toLowerCase() === 'ativo';

  // Primeiras letras do nome para avatar
  const initials = (client.nome ?? 'C')
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-zinc-950 text-white" : "bg-slate-50 text-slate-900"}`}>
      {/* Header */}
      <header className={`border-b backdrop-blur-md sticky top-0 z-10 transition-colors duration-300 ${isDark ? "border-white/[0.06] bg-zinc-900/80" : "border-slate-200 bg-white/80"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={turboLogo} alt="Turbo Partners" className={`h-6 w-auto transition-all duration-300 ${isDark ? "opacity-90" : "brightness-0 opacity-80"}`} />
            <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
            <span className={`text-xs font-medium tracking-wide ${isDark ? "text-white/40" : "text-slate-500"}`}>Área do Cliente</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`flex items-center justify-center h-8 w-8 rounded-lg transition-colors ${isDark ? "text-white/35 hover:text-white/70 hover:bg-white/5" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
              aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
              title={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={logout}
              className={`flex items-center gap-1.5 transition-colors text-sm px-3 py-1.5 rounded-lg ${isDark ? "text-white/35 hover:text-white/70 hover:bg-white/5" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* ── Hero: saudação ── */}
        <div className={`relative overflow-hidden rounded-2xl border px-6 py-6 transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
          {/* Gradiente decorativo */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/[0.07] via-transparent to-transparent" />
          <div className="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full bg-blue-600/10 blur-3xl" />

          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600/30 to-blue-800/20 border border-blue-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-blue-300/90">{initials}</span>
              </div>
              <div>
                <h1 className={`text-lg sm:text-xl font-bold leading-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  Olá, {client.nome ?? 'Cliente'} 👋
                </h1>
                <p className={`text-xs mt-0.5 ${isDark ? "text-white/35" : "text-slate-500"}`}>
                  Bem-vindo à sua área exclusiva.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isAtivo
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : isDark ? 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30' : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isAtivo ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                {isAtivo ? 'Ativo' : 'Inativo'}
              </span>
              <p className={`text-[11px] font-mono hidden sm:block ${isDark ? "text-white/20" : "text-slate-400"}`}>{client.cnpj ?? ''}</p>
            </div>
          </div>
        </div>

        {/* ── Navegação de módulos ── */}
        <div className={`flex gap-1 p-1 border rounded-xl w-fit transition-colors duration-300 ${isDark ? "bg-zinc-900/60 border-white/[0.07]" : "bg-slate-100 border-slate-200"}`}>
          {([
            { id: 'relatorios',  label: 'Performance',  Icon: BarChart3,        comingSoon: false },
            { id: 'financeiro',  label: 'Financeiro',   Icon: CircleDollarSign, comingSoon: false },
            { id: 'servicos',    label: 'Serviços',     Icon: Briefcase,        comingSoon: false },
            { id: 'atendimento', label: 'Atendimento',  Icon: MessageSquare,    comingSoon: false },
          ] as { id: Module; label: string; Icon: React.ElementType; comingSoon: boolean }[]).map(({ id, label, Icon, comingSoon }) => (
            <button
              key={id}
              onClick={() => setActiveModule(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeModule === id
                  ? isDark ? 'bg-white/[0.09] text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm'
                  : isDark ? 'text-white/30 hover:text-white/55 hover:bg-white/[0.04]' : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${activeModule === id ? 'opacity-80' : 'opacity-40'}`} />
              {label}
              {comingSoon && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? "bg-zinc-700/50 text-white/20" : "bg-slate-200 text-slate-400"}`}>
                  Em breve
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Módulo: Financeiro ── */}
        {activeModule === 'financeiro' && <>

          {/* Cards de resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total */}
            <div className={`relative overflow-hidden border rounded-2xl p-5 transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${isDark ? "from-white/0 via-white/10 to-white/0" : "from-slate-200/0 via-slate-200 to-slate-200/0"}`} />
              <div className="flex items-start justify-between mb-3">
                <p className={`text-[11px] font-medium uppercase tracking-widest ${isDark ? "text-white/35" : "text-slate-400"}`}>Total em Faturas</p>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? "bg-white/[0.06]" : "bg-slate-100"}`}>
                  <Receipt className={`w-3.5 h-3.5 ${isDark ? "text-white/30" : "text-slate-400"}`} />
                </div>
              </div>
              {isResumoLoading ? (
                <div className={`h-7 w-28 rounded-lg animate-pulse ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
              ) : (
                <p className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>{formatCurrency(totais.total)}</p>
              )}
              <p className={`text-[11px] mt-2 ${isDark ? "text-white/20" : "text-slate-400"}`}>{faturas.length} faturas no total</p>
            </div>

            {/* Pago */}
            <div className={`relative overflow-hidden border rounded-2xl p-5 transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500/0 via-emerald-500/30 to-emerald-500/0" />
              <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full bg-emerald-500/[0.04] blur-2xl pointer-events-none" />
              <div className="flex items-start justify-between mb-3">
                <p className={`text-[11px] font-medium uppercase tracking-widest ${isDark ? "text-white/35" : "text-slate-400"}`}>Total Pago</p>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400/70" />
                </div>
              </div>
              {isResumoLoading ? (
                <div className={`h-7 w-28 rounded-lg animate-pulse ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
              ) : (
                <p className={`text-2xl font-bold tracking-tight ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{formatCurrency(totais.pago)}</p>
              )}
              <p className={`text-[11px] mt-2 ${isDark ? "text-emerald-500/30" : "text-emerald-600/50"}`}>
                {totais.total > 0 ? `${Math.round((totais.pago / totais.total) * 100)}% do total` : '—'}
              </p>
            </div>

            {/* Atrasado */}
            <div className={`relative overflow-hidden border rounded-2xl p-5 transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-500/0 via-red-500/25 to-red-500/0" />
              <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full bg-red-500/[0.04] blur-2xl pointer-events-none" />
              <div className="flex items-start justify-between mb-3">
                <p className={`text-[11px] font-medium uppercase tracking-widest ${isDark ? "text-white/35" : "text-slate-400"}`}>Atrasado</p>
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400/70" />
                </div>
              </div>
              {isResumoLoading ? (
                <div className={`h-7 w-28 rounded-lg animate-pulse ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
              ) : (
                <p className={`text-2xl font-bold tracking-tight ${isDark ? "text-red-400" : "text-red-600"}`}>{formatCurrency(totalAtrasado)}</p>
              )}
              <p className={`text-[11px] mt-2 ${isDark ? "text-red-500/30" : "text-red-600/50"}`}>
                {faturasAtrasadas.length > 0 ? `${faturasAtrasadas.length} fatura${faturasAtrasadas.length > 1 ? 's' : ''} atrasada${faturasAtrasadas.length > 1 ? 's' : ''}` : 'Tudo em dia'}
              </p>
            </div>
          </div>

          {/* Dados cadastrais */}
          <div className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? "border-white/[0.05]" : "border-slate-100"}`}>
              <h2 className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-white/35" : "text-slate-400"}`}>Dados Cadastrais</h2>
              <span className={`text-[10px] ${isDark ? "text-white/15" : "text-slate-300"}`}>Empresa e CNPJ são somente leitura</span>
            </div>

            <div className={`divide-y ${isDark ? "divide-white/[0.04]" : "divide-slate-100"}`}>
              {/* Empresa */}
              <div className="px-5 py-3.5 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${isDark ? "bg-zinc-800 border-white/[0.06]" : "bg-slate-100 border-slate-200"}`}>
                  <Building2 className={`w-3.5 h-3.5 ${isDark ? "text-white/25" : "text-slate-400"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] uppercase tracking-wider mb-0.5 ${isDark ? "text-white/25" : "text-slate-400"}`}>Empresa</p>
                  <p className={`text-sm font-medium truncate ${isDark ? "text-white/75" : "text-slate-700"}`}>{client.nome ?? '—'}</p>
                </div>
              </div>

              {/* CNPJ */}
              <div className="px-5 py-3.5 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${isDark ? "bg-zinc-800 border-white/[0.06]" : "bg-slate-100 border-slate-200"}`}>
                  <Building2 className={`w-3.5 h-3.5 ${isDark ? "text-white/25" : "text-slate-400"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] uppercase tracking-wider mb-0.5 ${isDark ? "text-white/25" : "text-slate-400"}`}>CNPJ</p>
                  <p className={`text-sm font-mono ${isDark ? "text-white/60" : "text-slate-500"}`}>{client.cnpj ?? '—'}</p>
                </div>
              </div>

              {/* E-mail — editável */}
              <div className="px-5 py-3.5 flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${isDark ? "bg-zinc-800 border-white/[0.06]" : "bg-slate-100 border-slate-200"}`}>
                  <Mail className={`w-3.5 h-3.5 ${isDark ? "text-white/25" : "text-slate-400"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] uppercase tracking-wider mb-1 ${isDark ? "text-white/25" : "text-slate-400"}`}>E-mail</p>
                  {editField === 'email' ? (
                    <form onSubmit={handleSaveEdit} className="flex items-center gap-2">
                      <input
                        type="email"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="seu@email.com"
                        className={`flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 ${isDark ? "bg-zinc-800 border-white/[0.12] text-white/80 placeholder:text-white/20" : "bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-300"}`}
                        autoFocus
                      />
                      <button type="submit" disabled={editSaving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/20 transition-colors disabled:opacity-50">
                        {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {!editSaving && 'Salvar'}
                      </button>
                      <button type="button" onClick={() => setEditField(null)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-white/25 hover:text-white/55 hover:bg-white/5" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${client.email ? (isDark ? 'text-white/65' : 'text-slate-600') : (isDark ? 'text-white/20 italic' : 'text-slate-300 italic')}`}>
                        {client.email ?? 'Não informado'}
                      </span>
                      <button onClick={() => startEdit('email', client.email ?? '')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors shrink-0 ${isDark ? "text-white/25 hover:text-white/60 hover:bg-white/5" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}>
                        <Pencil className="w-3 h-3" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                    </div>
                  )}
                  {editField === 'email' && editError && (
                    <p className="text-xs text-red-400 mt-1">{editError}</p>
                  )}
                </div>
              </div>

              {/* Telefone — editável */}
              <div className="px-5 py-3.5 flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${isDark ? "bg-zinc-800 border-white/[0.06]" : "bg-slate-100 border-slate-200"}`}>
                  <Phone className={`w-3.5 h-3.5 ${isDark ? "text-white/25" : "text-slate-400"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] uppercase tracking-wider mb-1 ${isDark ? "text-white/25" : "text-slate-400"}`}>Telefone</p>
                  {editField === 'telefone' ? (
                    <form onSubmit={handleSaveEdit} className="flex items-center gap-2">
                      <input
                        type="tel"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className={`flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 ${isDark ? "bg-zinc-800 border-white/[0.12] text-white/80 placeholder:text-white/20" : "bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-300"}`}
                        autoFocus
                      />
                      <button type="submit" disabled={editSaving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/20 transition-colors disabled:opacity-50">
                        {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {!editSaving && 'Salvar'}
                      </button>
                      <button type="button" onClick={() => setEditField(null)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-white/25 hover:text-white/55 hover:bg-white/5" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${client.telefone ? (isDark ? 'text-white/65' : 'text-slate-600') : (isDark ? 'text-white/20 italic' : 'text-slate-300 italic')}`}>
                        {client.telefone ?? 'Não informado'}
                      </span>
                      <button onClick={() => startEdit('telefone', client.telefone ?? '')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors shrink-0 ${isDark ? "text-white/25 hover:text-white/60 hover:bg-white/5" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}>
                        <Pencil className="w-3 h-3" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                    </div>
                  )}
                  {editField === 'telefone' && editError && (
                    <p className="text-xs text-red-400 mt-1">{editError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de faturas */}
          <div className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
            {/* Cabeçalho da seção */}
            <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? "border-white/[0.05]" : "border-slate-100"}`}>
              <div className="flex items-center gap-2.5">
                <Receipt className={`w-4 h-4 ${isDark ? "text-white/25" : "text-slate-400"}`} />
                <h2 className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-white/35" : "text-slate-400"}`}>Faturas</h2>
                {!isResumoLoading && faturas.length > 0 && (
                  <span className={`text-xs border px-2 py-0.5 rounded-full tabular-nums ${isDark ? "bg-zinc-800 border-white/[0.06] text-white/25" : "bg-slate-100 border-slate-200 text-slate-400"}`}>
                    {faturas.length}
                  </span>
                )}
              </div>
            </div>

            {isResumoLoading ? (
              <div className="p-5 space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-12 rounded-xl animate-pulse ${isDark ? "bg-white/[0.04]" : "bg-slate-100"}`} />
                ))}
              </div>
            ) : faturas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${isDark ? "bg-zinc-800 border-white/[0.06]" : "bg-slate-100 border-slate-200"}`}>
                  <Receipt className={`w-5 h-5 ${isDark ? "text-white/15" : "text-slate-300"}`} />
                </div>
                <p className={`text-sm ${isDark ? "text-white/25" : "text-slate-400"}`}>Nenhuma fatura encontrada</p>
              </div>
            ) : (
              <>
                {/* Header de colunas */}
                <div
                  className={`hidden sm:grid px-5 py-2.5 border-b ${isDark ? "bg-zinc-800/40 border-white/[0.04]" : "bg-slate-50 border-slate-100"}`}
                  style={{ gridTemplateColumns: '1fr 100px 110px 96px 110px 80px' }}
                >
                  {['Descrição', 'Vencimento', 'Pagamento', 'Status', 'Valor', 'Link'].map((col, i) => (
                    <span key={col} className={`text-[10px] font-semibold uppercase tracking-widest ${i >= 4 ? 'text-right' : ''} ${isDark ? "text-white/20" : "text-slate-400"}`}>
                      {col}
                    </span>
                  ))}
                </div>

                {/* Linhas */}
                <div className={`divide-y ${isDark ? "divide-white/[0.03]" : "divide-slate-100"}`}>
                  {faturas.map((fatura) => {
                    const s = (fatura.status ?? '').toUpperCase();
                    const isPago = s === 'QUITADO' || s === 'PAGO' || s === 'RECEBIDO';
                    const isAtrasadoRow = s === 'ATRASADO' || s === 'VENCIDO';

                    return (
                      <div
                        key={fatura.id}
                        className={`relative sm:grid items-center px-5 py-3.5 transition-colors group border-l-[3px] flex flex-col sm:flex-row gap-2 sm:gap-0 ${
                          isDark ? "hover:bg-white/[0.015]" : "hover:bg-slate-50"
                        } ${
                          isAtrasadoRow
                            ? 'border-l-red-500/50'
                            : isPago
                            ? 'border-l-emerald-500/20'
                            : 'border-l-amber-500/35'
                        }`}
                        style={{ gridTemplateColumns: '1fr 100px 110px 96px 110px 80px' }}
                      >
                        {/* Descrição */}
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isDark ? "text-white/80" : "text-slate-700"}`}>
                            {fatura.descricao || fatura.categoriaNome || 'Fatura'}
                          </p>
                          {fatura.descricao && fatura.categoriaNome && (
                            <p className={`text-[11px] truncate mt-0.5 ${isDark ? "text-white/20" : "text-slate-400"}`}>{fatura.categoriaNome}</p>
                          )}
                        </div>

                        {/* Vencimento */}
                        <p className={`text-sm tabular-nums ${isDark ? "text-white/45" : "text-slate-500"}`}>
                          <span className={`sm:hidden text-xs mr-1 ${isDark ? "text-white/20" : "text-slate-400"}`}>Venc.</span>
                          {formatDate(fatura.dataVencimento)}
                        </p>

                        {/* Pagamento */}
                        <p className={`text-sm tabular-nums ${fatura.dataQuitacao ? (isDark ? 'text-emerald-400/60' : 'text-emerald-600/70') : (isDark ? 'text-white/15' : 'text-slate-300')}`}>
                          <span className={`sm:hidden text-xs mr-1 ${isDark ? "text-white/20" : "text-slate-400"}`}>Pago em</span>
                          {formatDate(fatura.dataQuitacao)}
                        </p>

                        {/* Status */}
                        <div>
                          <StatusBadge status={fatura.status} />
                        </div>

                        {/* Valor */}
                        <p className={`text-sm font-semibold tabular-nums sm:text-right ${
                          isAtrasadoRow ? (isDark ? 'text-red-400' : 'text-red-600') : isPago ? (isDark ? 'text-white/75' : 'text-slate-700') : (isDark ? 'text-amber-300/80' : 'text-amber-600')
                        }`}>
                          {formatCurrency(fatura.valorBruto)}
                        </p>

                        {/* Boleto */}
                        <div className="flex sm:justify-end">
                          {fatura.urlCobranca ? (
                            <a
                              href={fatura.urlCobranca}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${isDark ? "bg-blue-600/15 hover:bg-blue-600/25 text-blue-400/80 border-blue-500/15" : "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"}`}
                            >
                              <ExternalLink className="w-3 h-3" />
                              Boleto
                            </a>
                          ) : (
                            <span />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        </>}

        {/* ── Módulo: Performance ── */}
        {activeModule === 'relatorios' && (
          <Suspense fallback={
            <div className={`flex items-center justify-center py-16 gap-2 ${isDark ? "text-white/30" : "text-slate-400"}`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          }>
            <PortalPerformance />
          </Suspense>
        )}

        {/* ── Módulo: Serviços ── */}
        {activeModule === 'servicos' && (
          <div className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
            {/* Header */}
            <div className={`flex items-center gap-3 px-5 py-4 border-b ${isDark ? "border-white/[0.07]" : "border-slate-100"}`}>
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${isDark ? "bg-zinc-800 border-white/[0.07]" : "bg-slate-100 border-slate-200"}`}>
                <Briefcase className={`w-4 h-4 ${isDark ? "text-white/40" : "text-slate-400"}`} />
              </div>
              <div>
                <p className={`font-semibold text-sm ${isDark ? "text-white/80" : "text-slate-700"}`}>Serviços Contratados</p>
                <p className={`text-xs ${isDark ? "text-white/30" : "text-slate-400"}`}>Produtos e responsáveis ativos na sua conta</p>
              </div>
            </div>

            {isServicosLoading ? (
              <div className={`flex items-center justify-center py-16 gap-2 ${isDark ? "text-white/30" : "text-slate-400"}`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : !servicos || servicos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <Briefcase className={`w-8 h-8 ${isDark ? "text-white/10" : "text-slate-200"}`} />
                <p className={`text-sm ${isDark ? "text-white/30" : "text-slate-400"}`}>Nenhum serviço encontrado para esta conta.</p>
              </div>
            ) : (
              <div className={`divide-y ${isDark ? "divide-white/[0.05]" : "divide-slate-100"}`}>
                {servicos.map((s, i) => {
                  const st = (s.status ?? '').toLowerCase();
                  const isAtivo = st.includes('ativo') || st.includes('anda') || st.includes('progr');
                  const isConcluido = st.includes('conclui') || st.includes('finaliz') || st.includes('encerr');
                  const isPausado = st.includes('paus') || st.includes('suspen');
                  const badgeClass = isAtivo
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : isConcluido
                    ? isDark ? 'bg-zinc-700/60 text-white/40 border-white/[0.07]' : 'bg-slate-100 text-slate-400 border-slate-200'
                    : isPausado
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

                  return (
                    <div key={i} className="flex items-center justify-between px-5 py-4 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isDark ? "text-white/80" : "text-slate-700"}`}>
                          {s.produto ?? '—'}
                        </p>
                        {s.responsavel && (
                          <p className={`text-xs mt-0.5 truncate ${isDark ? "text-white/30" : "text-slate-400"}`}>
                            Responsável: {s.responsavel}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.status && (
                          <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium ${badgeClass}`}>
                            {s.status}
                          </span>
                        )}
                        {!isConcluido && (
                          <button
                            onClick={() => setCancelServico(s)}
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium bg-transparent hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors ${isDark ? "text-white/20 border-white/[0.07]" : "text-slate-300 border-slate-200"}`}
                          >
                            <XCircle className="w-3 h-3" />
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Módulo: Atendimento ── */}
        {activeModule === 'atendimento' && (
          <ChatModuloCliente clientId={(client as any).id} />
        )}

        <p className={`text-center text-[11px] pb-4 ${isDark ? "text-white/15" : "text-slate-300"}`}>
          Turbo Partners · Área do Cliente · Dados protegidos
        </p>
      </main>

      {/* ── Modal: Cancelamento de serviço ── */}
      {cancelServico && (
        <CancelamentoModal servico={cancelServico} onClose={() => setCancelServico(null)} />
      )}

      {/* ── FAB: balão de chat flutuante ── */}
      {chatOpen && (
        <ChatFlutuante clientId={(client as any).id} onClose={() => setChatOpen(false)} />
      )}
      <button
        onClick={() => setChatOpen(o => !o)}
        className={`fixed bottom-5 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all z-50 ${
          chatOpen
            ? isDark ? 'bg-zinc-700 hover:bg-zinc-600 border border-white/[0.10] shadow-black/40' : 'bg-slate-200 hover:bg-slate-300 border border-slate-300 shadow-slate-300/30'
            : 'bg-blue-600 hover:bg-blue-500 border border-blue-400/20 shadow-blue-600/30'
        }`}
        title="Atendimento"
      >
        {chatOpen
          ? <X className={`w-5 h-5 ${isDark ? "text-white/70" : "text-slate-500"}`} />
          : <MessageSquare className="w-5 h-5 text-white" />
        }
      </button>
    </div>
  );
}

export default function PortalCliente() {
  return (
    <ClientAuthProvider>
      <PortalClienteContent />
    </ClientAuthProvider>
  );
}
