import { useState, useRef, useEffect } from "react";
import type React from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClientAuth, ClientAuthProvider } from "@/contexts/ClientAuthContext";
import type { ClientUser } from "@/contexts/ClientAuthContext";
import { Loader2, Building2, Mail, Phone, LogOut, CircleDollarSign, CheckCircle2, AlertCircle, Clock, ExternalLink, BarChart3, Briefcase, Pencil, Check, X, XCircle, TrendingUp, TrendingDown, Receipt, MessageSquare, Send, User } from "lucide-react";
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

              return (
                <div key={msg.id}>
                  {showDayLabel && (
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-white/[0.05]" />
                      <span className="text-[10px] text-white/20 px-2">{formatDayLabel(msg.criadoEm)}</span>
                      <div className="flex-1 h-px bg-white/[0.05]" />
                    </div>
                  )}
                  <div className={`flex ${isCliente ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-end gap-2 max-w-[80%] ${isCliente ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar */}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1 ${
                        isCliente ? 'bg-blue-600/30 border border-blue-500/20' : 'bg-zinc-700 border border-white/[0.08]'
                      }`}>
                        <User className="w-3 h-3 text-white/40" />
                      </div>
                      {/* Bolha */}
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
              return (
                <div key={msg.id}>
                  {showDay && (
                    <div className="flex items-center gap-1.5 my-1.5">
                      <div className="flex-1 h-px bg-white/[0.05]" />
                      <span className="text-[9px] text-white/20">{formatDayLabel(msg.criadoEm)}</span>
                      <div className="flex-1 h-px bg-white/[0.05]" />
                    </div>
                  )}
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

function PortalClienteContent() {
  const [, setLocation] = useLocation();
  const { client, isLoading, isAuthenticated, logout } = useClientAuth();
  const queryClient = useQueryClient();
  const [activeModule, setActiveModule] = useState<Module>('financeiro');
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
            onClick={() => setLocation("/login")}
            className="w-full py-3 px-6 bg-white/10 hover:bg-white/15 text-white rounded-full text-sm transition-colors mt-2"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={turboLogo} alt="Turbo Partners" className="h-6 w-auto opacity-90" />
            <div className="w-px h-4 bg-white/10" />
            <span className="text-white/40 text-xs font-medium tracking-wide">Área do Cliente</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-white/35 hover:text-white/70 transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* ── Hero: saudação ── */}
        <div className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-white/[0.07] px-6 py-6">
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
                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">
                  Olá, {client.nome ?? 'Cliente'} 👋
                </h1>
                <p className="text-white/35 text-xs mt-0.5">
                  Bem-vindo à sua área exclusiva.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isAtivo
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isAtivo ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                {isAtivo ? 'Ativo' : 'Inativo'}
              </span>
              <p className="text-[11px] text-white/20 font-mono hidden sm:block">{client.cnpj ?? ''}</p>
            </div>
          </div>
        </div>

        {/* ── Navegação de módulos ── */}
        <div className="flex gap-1 p-1 bg-zinc-900/60 border border-white/[0.07] rounded-xl w-fit">
          {([
            { id: 'financeiro',  label: 'Financeiro',   Icon: CircleDollarSign, comingSoon: false },
            { id: 'relatorios',  label: 'Relatórios',   Icon: BarChart3,        comingSoon: true },
            { id: 'servicos',    label: 'Serviços',     Icon: Briefcase,        comingSoon: false },
            { id: 'atendimento', label: 'Atendimento',  Icon: MessageSquare,    comingSoon: false },
          ] as { id: Module; label: string; Icon: React.ElementType; comingSoon: boolean }[]).map(({ id, label, Icon, comingSoon }) => (
            <button
              key={id}
              onClick={() => setActiveModule(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeModule === id
                  ? 'bg-white/[0.09] text-white shadow-sm'
                  : 'text-white/30 hover:text-white/55 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`w-4 h-4 ${activeModule === id ? 'opacity-80' : 'opacity-40'}`} />
              {label}
              {comingSoon && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-white/20 font-medium">
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
            <div className="relative overflow-hidden bg-zinc-900 border border-white/[0.07] rounded-2xl p-5">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-medium text-white/35 uppercase tracking-widest">Total em Faturas</p>
                <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Receipt className="w-3.5 h-3.5 text-white/30" />
                </div>
              </div>
              {isResumoLoading ? (
                <div className="h-7 w-28 bg-white/10 rounded-lg animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-white tracking-tight">{formatCurrency(totais.total)}</p>
              )}
              <p className="text-[11px] text-white/20 mt-2">{faturas.length} faturas no total</p>
            </div>

            {/* Pago */}
            <div className="relative overflow-hidden bg-zinc-900 border border-white/[0.07] rounded-2xl p-5">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500/0 via-emerald-500/30 to-emerald-500/0" />
              <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full bg-emerald-500/[0.04] blur-2xl pointer-events-none" />
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-medium text-white/35 uppercase tracking-widest">Total Pago</p>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400/70" />
                </div>
              </div>
              {isResumoLoading ? (
                <div className="h-7 w-28 bg-white/10 rounded-lg animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-emerald-400 tracking-tight">{formatCurrency(totais.pago)}</p>
              )}
              <p className="text-[11px] text-emerald-500/30 mt-2">
                {totais.total > 0 ? `${Math.round((totais.pago / totais.total) * 100)}% do total` : '—'}
              </p>
            </div>

            {/* Atrasado */}
            <div className="relative overflow-hidden bg-zinc-900 border border-white/[0.07] rounded-2xl p-5">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-500/0 via-red-500/25 to-red-500/0" />
              <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full bg-red-500/[0.04] blur-2xl pointer-events-none" />
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-medium text-white/35 uppercase tracking-widest">Atrasado</p>
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400/70" />
                </div>
              </div>
              {isResumoLoading ? (
                <div className="h-7 w-28 bg-white/10 rounded-lg animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-red-400 tracking-tight">{formatCurrency(totalAtrasado)}</p>
              )}
              <p className="text-[11px] text-red-500/30 mt-2">
                {faturasAtrasadas.length > 0 ? `${faturasAtrasadas.length} fatura${faturasAtrasadas.length > 1 ? 's' : ''} atrasada${faturasAtrasadas.length > 1 ? 's' : ''}` : 'Tudo em dia'}
              </p>
            </div>
          </div>

          {/* Dados cadastrais */}
          <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
              <h2 className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Dados Cadastrais</h2>
              <span className="text-[10px] text-white/15">Empresa e CNPJ são somente leitura</span>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {/* Empresa */}
              <div className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/[0.06] flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-white/25" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-0.5">Empresa</p>
                  <p className="text-sm text-white/75 font-medium truncate">{client.nome ?? '—'}</p>
                </div>
              </div>

              {/* CNPJ */}
              <div className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/[0.06] flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-white/25" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-0.5">CNPJ</p>
                  <p className="text-sm text-white/60 font-mono">{client.cnpj ?? '—'}</p>
                </div>
              </div>

              {/* E-mail — editável */}
              <div className="px-5 py-3.5 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-white/25" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">E-mail</p>
                  {editField === 'email' ? (
                    <form onSubmit={handleSaveEdit} className="flex items-center gap-2">
                      <input
                        type="email"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="seu@email.com"
                        className="flex-1 text-sm bg-zinc-800 border border-white/[0.12] rounded-lg px-3 py-1.5 text-white/80 placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                        autoFocus
                      />
                      <button type="submit" disabled={editSaving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/20 transition-colors disabled:opacity-50">
                        {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {!editSaving && 'Salvar'}
                      </button>
                      <button type="button" onClick={() => setEditField(null)}
                        className="p-1.5 rounded-lg text-white/25 hover:text-white/55 hover:bg-white/5 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${client.email ? 'text-white/65' : 'text-white/20 italic'}`}>
                        {client.email ?? 'Não informado'}
                      </span>
                      <button onClick={() => startEdit('email', client.email ?? '')}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-white/25 hover:text-white/60 hover:bg-white/5 text-xs transition-colors shrink-0">
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
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-white/25" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Telefone</p>
                  {editField === 'telefone' ? (
                    <form onSubmit={handleSaveEdit} className="flex items-center gap-2">
                      <input
                        type="tel"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="flex-1 text-sm bg-zinc-800 border border-white/[0.12] rounded-lg px-3 py-1.5 text-white/80 placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                        autoFocus
                      />
                      <button type="submit" disabled={editSaving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/20 transition-colors disabled:opacity-50">
                        {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {!editSaving && 'Salvar'}
                      </button>
                      <button type="button" onClick={() => setEditField(null)}
                        className="p-1.5 rounded-lg text-white/25 hover:text-white/55 hover:bg-white/5 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${client.telefone ? 'text-white/65' : 'text-white/20 italic'}`}>
                        {client.telefone ?? 'Não informado'}
                      </span>
                      <button onClick={() => startEdit('telefone', client.telefone ?? '')}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-white/25 hover:text-white/60 hover:bg-white/5 text-xs transition-colors shrink-0">
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
          <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Cabeçalho da seção */}
            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-4 h-4 text-white/25" />
                <h2 className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Faturas</h2>
                {!isResumoLoading && faturas.length > 0 && (
                  <span className="text-xs bg-zinc-800 border border-white/[0.06] text-white/25 px-2 py-0.5 rounded-full tabular-nums">
                    {faturas.length}
                  </span>
                )}
              </div>
            </div>

            {isResumoLoading ? (
              <div className="p-5 space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : faturas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/[0.06] flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-white/15" />
                </div>
                <p className="text-white/25 text-sm">Nenhuma fatura encontrada</p>
              </div>
            ) : (
              <>
                {/* Header de colunas */}
                <div
                  className="hidden sm:grid px-5 py-2.5 bg-zinc-800/40 border-b border-white/[0.04]"
                  style={{ gridTemplateColumns: '1fr 100px 110px 96px 110px 80px' }}
                >
                  {['Descrição', 'Vencimento', 'Pagamento', 'Status', 'Valor', 'Link'].map((col, i) => (
                    <span key={col} className={`text-[10px] font-semibold text-white/20 uppercase tracking-widest ${i >= 4 ? 'text-right' : ''}`}>
                      {col}
                    </span>
                  ))}
                </div>

                {/* Linhas */}
                <div className="divide-y divide-white/[0.03]">
                  {faturas.map((fatura) => {
                    const s = (fatura.status ?? '').toUpperCase();
                    const isPago = s === 'QUITADO' || s === 'PAGO' || s === 'RECEBIDO';
                    const isAtrasadoRow = s === 'ATRASADO' || s === 'VENCIDO';

                    return (
                      <div
                        key={fatura.id}
                        className={`relative sm:grid items-center px-5 py-3.5 hover:bg-white/[0.015] transition-colors group border-l-[3px] flex flex-col sm:flex-row gap-2 sm:gap-0 ${
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
                          <p className="text-sm text-white/80 font-medium truncate">
                            {fatura.descricao || fatura.categoriaNome || 'Fatura'}
                          </p>
                          {fatura.descricao && fatura.categoriaNome && (
                            <p className="text-[11px] text-white/20 truncate mt-0.5">{fatura.categoriaNome}</p>
                          )}
                        </div>

                        {/* Vencimento */}
                        <p className="text-sm text-white/45 tabular-nums">
                          <span className="sm:hidden text-white/20 text-xs mr-1">Venc.</span>
                          {formatDate(fatura.dataVencimento)}
                        </p>

                        {/* Pagamento */}
                        <p className={`text-sm tabular-nums ${fatura.dataQuitacao ? 'text-emerald-400/60' : 'text-white/15'}`}>
                          <span className="sm:hidden text-white/20 text-xs mr-1">Pago em</span>
                          {formatDate(fatura.dataQuitacao)}
                        </p>

                        {/* Status */}
                        <div>
                          <StatusBadge status={fatura.status} />
                        </div>

                        {/* Valor */}
                        <p className={`text-sm font-semibold tabular-nums sm:text-right ${
                          isAtrasadoRow ? 'text-red-400' : isPago ? 'text-white/75' : 'text-amber-300/80'
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-400/80 text-xs font-medium transition-colors border border-blue-500/15"
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

        {/* ── Módulo: Relatórios ── */}
        {activeModule === 'relatorios' && (
          <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex flex-col items-center justify-center py-24 gap-5 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-white/[0.07] flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white/15" />
              </div>
              <div className="space-y-1.5">
                <p className="text-white/50 font-semibold">Relatórios</p>
                <p className="text-white/20 text-sm max-w-xs leading-relaxed">
                  Visualize relatórios detalhados de performance, histórico de pagamentos e evolução financeira da sua conta.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-500/8 text-blue-400/50 border border-blue-500/15 font-medium">
                <Clock className="w-3 h-3" />
                Em breve
              </span>
            </div>
          </div>
        )}

        {/* ── Módulo: Serviços ── */}
        {activeModule === 'servicos' && (
          <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.07]">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/[0.07] flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white/40" />
              </div>
              <div>
                <p className="text-white/80 font-semibold text-sm">Serviços Contratados</p>
                <p className="text-white/30 text-xs">Produtos e responsáveis ativos na sua conta</p>
              </div>
            </div>

            {isServicosLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-white/30">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : !servicos || servicos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <Briefcase className="w-8 h-8 text-white/10" />
                <p className="text-white/30 text-sm">Nenhum serviço encontrado para esta conta.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {servicos.map((s, i) => {
                  const st = (s.status ?? '').toLowerCase();
                  const isAtivo = st.includes('ativo') || st.includes('anda') || st.includes('progr');
                  const isConcluido = st.includes('conclui') || st.includes('finaliz') || st.includes('encerr');
                  const isPausado = st.includes('paus') || st.includes('suspen');
                  const badgeClass = isAtivo
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : isConcluido
                    ? 'bg-zinc-700/60 text-white/40 border-white/[0.07]'
                    : isPausado
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

                  return (
                    <div key={i} className="flex items-center justify-between px-5 py-4 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-white/80 text-sm font-medium truncate">
                          {s.produto ?? '—'}
                        </p>
                        {s.responsavel && (
                          <p className="text-white/30 text-xs mt-0.5 truncate">
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
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium bg-transparent hover:bg-red-500/10 text-white/20 hover:text-red-400 border-white/[0.07] hover:border-red-500/20 transition-colors"
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

        <p className="text-center text-[11px] text-white/15 pb-4">
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
        className={`fixed bottom-5 right-5 w-14 h-14 rounded-full shadow-lg shadow-black/40 flex items-center justify-center transition-all z-50 ${
          chatOpen
            ? 'bg-zinc-700 hover:bg-zinc-600 border border-white/[0.10]'
            : 'bg-blue-600 hover:bg-blue-500 border border-blue-400/20'
        }`}
        title="Atendimento"
      >
        {chatOpen
          ? <X className="w-5 h-5 text-white/70" />
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
