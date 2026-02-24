import { useState, useRef, useEffect } from "react";
import type React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Loader2, User, Search, CheckCheck, AlertTriangle, Star, PhoneOff, Clock } from "lucide-react";

interface Conversa {
  client_id: number;
  client_nome: string;
  cnpj: string;
  responsavel: string | null;
  last_message: string | null;
  last_at: string | null;
  unread_count: number;
  ativo: boolean;
  ultimo_encerramento: string | null;
}

interface ChatMensagem {
  id: number;
  clientId: number;
  remetenteTipo: 'cliente' | 'colaborador';
  remetenteNome: string | null;
  mensagem: string;
  lida: boolean;
  criadoEm: string;
}

interface UltimoAtendimento {
  id: number;
  iniciadoEm: string;
  encerradoEm: string;
  encerradoPor: string | null;
  duracaoMinutos: string | null;
}

interface ConversaDetalhe {
  mensagens: ChatMensagem[];
  clientNome: string;
  cnpj: string;
  responsavel: string | null;
  ativo: boolean;
  ultimoAtendimento: UltimoAtendimento | null;
}

interface CancelamentoPayload {
  _type: 'cancelamento';
  _id: number;
  produto: string;
  nota: number | null;
  motivos: string[];
  urgencia: string;
}

type SystemMsg =
  | { _type: 'encerramento'; atendimentoId: number; encerradoPor: string }
  | { _type: 'avaliacao_request'; atendimentoId: number }
  | { _type: 'avaliacao_respondida'; atendimentoId: number; nota: number };

function parseSystemMsg(mensagem: string): SystemMsg | null {
  try {
    const p = JSON.parse(mensagem);
    if (p && ['encerramento', 'avaliacao_request', 'avaliacao_respondida'].includes(p._type)) return p;
  } catch { /* não é JSON */ }
  return null;
}

function parseCancelamento(mensagem: string): CancelamentoPayload | null {
  try {
    const parsed = JSON.parse(mensagem);
    if (parsed && parsed._type === 'cancelamento') return parsed as CancelamentoPayload;
  } catch { /* not JSON */ }
  return null;
}

const URGENCIA_LABELS: Record<string, { label: string; color: string }> = {
  imediato:    { label: 'Imediato',                        color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  fim_periodo: { label: 'No final do período contratado',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  a_combinar:  { label: 'A combinar',                      color: 'text-zinc-300 bg-zinc-700/40 border-zinc-600/30' },
};

const NOTA_EMOJIS: Record<number, string> = { 1: '😡', 2: '😟', 3: '😐', 4: '🙂', 5: '😍' };
const NOTA_LABELS: Record<number, string> = { 1: 'Péssimo', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Ótimo' };

function CancelamentoCard({ payload, criadoEm }: { payload: CancelamentoPayload; criadoEm: string }) {
  const urgencia = URGENCIA_LABELS[payload.urgencia] ?? { label: payload.urgencia, color: 'text-zinc-300 bg-zinc-700/40 border-zinc-600/30' };

  return (
    <div className="w-full max-w-sm rounded-xl border border-red-500/25 bg-red-950/20 overflow-hidden shadow-lg shadow-red-900/10">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-500/10 border-b border-red-500/20">
        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">Solicitação de Cancelamento</span>
        <span className="ml-auto text-[10px] text-red-400/50 font-mono">#{payload._id}</span>
      </div>

      {/* Body */}
      <div className="px-3.5 py-3 space-y-2.5">
        {/* Produto */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Serviço</p>
          <p className="text-sm font-medium text-white/80">{payload.produto}</p>
        </div>

        {/* Nota */}
        {payload.nota && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Satisfação</span>
            <span className="text-base leading-none">{NOTA_EMOJIS[payload.nota]}</span>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className={`w-2.5 h-2.5 ${i <= payload.nota! ? 'text-amber-400 fill-amber-400' : 'text-white/10 fill-white/10'}`} />
              ))}
            </div>
            <span className="text-[11px] text-white/40">{NOTA_LABELS[payload.nota]}</span>
          </div>
        )}

        {/* Motivos */}
        {payload.motivos?.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Motivos</p>
            <div className="flex flex-wrap gap-1">
              {payload.motivos.map((m, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-700/50 border border-white/[0.06] text-white/55">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Urgência */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 uppercase tracking-widest">Urgência</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${urgencia.color}`}>
            {urgencia.label}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3.5 py-2 border-t border-red-500/10 flex justify-between items-center">
        <span className="text-[10px] text-white/20">
          {new Date(criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-[10px] text-red-400/50">Ver detalhes completos no registro #{payload._id}</span>
      </div>
    </div>
  );
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return 'Hoje';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function ChatAtendimento() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [confirmEncerrar, setConfirmEncerrar] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Lista de conversas
  const { data: conversas = [], isLoading: isLoadingConversas } = useQuery<Conversa[]>({
    queryKey: ['/api/chat/conversas'],
    refetchInterval: 5000,
    staleTime: 0,
  });

  // Conversa selecionada
  const { data: conversa, isLoading: isLoadingConversa } = useQuery<ConversaDetalhe>({
    queryKey: ['/api/chat/conversa', selectedId],
    enabled: selectedId !== null,
    refetchInterval: 3000,
    staleTime: 0,
  });

  const encerrarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/chat/encerrar/${selectedId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao encerrar');
      return res.json();
    },
    onSuccess: () => {
      setConfirmEncerrar(false);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversa', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversas'] });
    },
  });

  const enviarMutation = useMutation({
    mutationFn: async (mensagem: string) => {
      const res = await fetch(`/api/chat/conversa/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao enviar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversa', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversas'] });
    },
  });

  // Scroll automático para o final
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversa?.mensagens?.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = inputValue.trim();
    if (!msg || selectedId === null) return;
    setInputValue('');
    enviarMutation.mutate(msg);
  }

  const conversasFiltradas = conversas.filter(c =>
    !search || c.client_nome?.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = conversas.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-zinc-950 text-white overflow-hidden">

      {/* ── Sidebar: lista de conversas ── */}
      <div className="w-80 shrink-0 border-r border-white/[0.06] flex flex-col bg-zinc-900/50">

        {/* Header sidebar */}
        <div className="px-4 pt-5 pb-3 border-b border-white/[0.05]">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-white/40" />
            <h1 className="text-sm font-semibold text-white/70">Atendimento</h1>
            {totalUnread > 0 && (
              <span className="ml-auto text-[11px] bg-red-500/20 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-medium">
                {totalUnread}
              </span>
            )}
          </div>
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full bg-zinc-800/60 border border-white/[0.06] rounded-lg pl-8 pr-3 py-2 text-xs text-white/60 placeholder:text-white/20 focus:outline-none focus:border-blue-500/30"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
          {isLoadingConversas ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-white/20" />
            </div>
          ) : conversasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-white/10" />
              <p className="text-white/25 text-xs">
                {search ? 'Nenhum resultado' : 'Nenhuma conversa ainda'}
              </p>
            </div>
          ) : (
            conversasFiltradas.map((c) => (
              <button
                key={c.client_id}
                onClick={() => { setSelectedId(c.client_id); setConfirmEncerrar(false); }}
                className={`w-full text-left px-4 py-3.5 hover:bg-white/[0.03] transition-colors ${
                  selectedId === c.client_id ? 'bg-white/[0.05]' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar com indicador de status */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-full bg-zinc-700 border border-white/[0.08] flex items-center justify-center">
                      <span className="text-xs font-semibold text-white/50">
                        {(c.client_nome ?? 'C').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    {/* Dot de status */}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${
                      c.ativo ? 'bg-emerald-400' : 'bg-zinc-600'
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-medium text-white/70 truncate">{c.client_nome}</p>
                      <span className="text-[10px] text-white/20 shrink-0">{formatTime(c.last_at)}</span>
                    </div>
                    <p className="text-[11px] text-white/30 truncate leading-relaxed">
                      {c.last_message ?? 'Sem mensagens'}
                    </p>
                  </div>
                  {c.unread_count > 0 && (
                    <span className="w-4.5 h-4.5 min-w-[18px] rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-1">
                      {c.unread_count > 9 ? '9+' : c.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Painel principal: conversa ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedId === null ? (
          /* Placeholder vazio */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/[0.07] flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-white/10" />
            </div>
            <div>
              <p className="text-white/30 font-medium">Selecione uma conversa</p>
              <p className="text-white/15 text-sm mt-1">Escolha um cliente na lista para ver as mensagens</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header da conversa */}
            <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center gap-3 bg-zinc-900/30 shrink-0">
              {isLoadingConversa ? (
                <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-zinc-700 border border-white/[0.08] flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-white/30" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/70">{conversa?.clientNome}</p>
                    <p className="text-[11px] text-white/25 font-mono">{conversa?.cnpj}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    {conversa?.responsavel && (
                      <span className="text-[11px] text-white/25">
                        CX: <span className="text-white/40">{conversa.responsavel}</span>
                      </span>
                    )}

                    {/* Badge de status do atendimento */}
                    {conversa?.ativo ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-emerald-400/70 bg-emerald-500/8 border border-emerald-500/15 px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Em atendimento
                      </span>
                    ) : conversa?.ultimoAtendimento ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-white/25 bg-zinc-800/50 border border-white/[0.05] px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" />
                        Encerrado · {conversa.ultimoAtendimento.duracaoMinutos
                          ? `${Math.round(parseFloat(conversa.ultimoAtendimento.duracaoMinutos))}min`
                          : '—'}
                      </span>
                    ) : null}

                    {/* Botão encerrar */}
                    {conversa?.ativo && !confirmEncerrar && (
                      <button
                        onClick={() => setConfirmEncerrar(true)}
                        className="flex items-center gap-1.5 text-[11px] text-red-400/70 hover:text-red-400 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 hover:border-red-500/25 px-2.5 py-1 rounded-full transition-colors"
                      >
                        <PhoneOff className="w-3 h-3" />
                        Encerrar
                      </button>
                    )}

                    {/* Confirmação de encerramento */}
                    {confirmEncerrar && (
                      <div className="flex items-center gap-2 bg-zinc-900 border border-white/[0.08] rounded-xl px-3 py-1.5 shadow-xl">
                        <span className="text-[11px] text-white/50">Encerrar atendimento?</span>
                        <button
                          onClick={() => encerrarMutation.mutate()}
                          disabled={encerrarMutation.isPending}
                          className="text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                          {encerrarMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
                        </button>
                        <span className="text-white/20">·</span>
                        <button
                          onClick={() => setConfirmEncerrar(false)}
                          className="text-[11px] text-white/30 hover:text-white/50 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {isLoadingConversa ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-white/20" />
                </div>
              ) : (conversa?.mensagens?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <p className="text-white/25 text-sm">Nenhuma mensagem ainda</p>
                </div>
              ) : (
                <>
                  {(conversa?.mensagens ?? []).map((msg, idx) => {
                    const isCliente = msg.remetenteTipo === 'cliente';
                    const prevMsg = idx > 0 ? conversa!.mensagens[idx - 1] : null;
                    const showDayLabel = !prevMsg || formatDayLabel(msg.criadoEm) !== formatDayLabel(prevMsg.criadoEm);

                    const cancelamento = parseCancelamento(msg.mensagem);
                    const sysMsg = !cancelamento ? parseSystemMsg(msg.mensagem) : null;

                    return (
                      <div key={msg.id}>
                        {showDayLabel && (
                          <div className="flex items-center gap-2 my-2">
                            <div className="flex-1 h-px bg-white/[0.04]" />
                            <span className="text-[10px] text-white/20 px-2">{formatDayLabel(msg.criadoEm)}</span>
                            <div className="flex-1 h-px bg-white/[0.04]" />
                          </div>
                        )}

                        {sysMsg?._type === 'encerramento' ? (
                          /* Divider de encerramento */
                          <div className="flex items-center gap-2 my-3">
                            <div className="flex-1 h-px bg-white/[0.05]" />
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800/60 border border-white/[0.07]">
                              <PhoneOff className="w-2.5 h-2.5 text-white/30" />
                              <span className="text-[10px] text-white/30">
                                Encerrado por <span className="text-white/45">{sysMsg.encerradoPor}</span>
                              </span>
                            </div>
                            <div className="flex-1 h-px bg-white/[0.05]" />
                          </div>
                        ) : sysMsg?._type === 'avaliacao_respondida' ? (
                          /* Badge de avaliação recebida */
                          <div className="flex items-center gap-2 my-2 px-2">
                            <div className="flex-1 h-px bg-white/[0.04]" />
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/8 border border-amber-500/15">
                              <span className="text-[11px]">⭐</span>
                              <span className="text-[10px] text-amber-400/60">
                                Cliente avaliou com nota {sysMsg.nota}/5
                              </span>
                            </div>
                            <div className="flex-1 h-px bg-white/[0.04]" />
                          </div>
                        ) : sysMsg?._type === 'avaliacao_request' ? null : cancelamento ? (
                          /* Card visual de cancelamento */
                          <div className="flex justify-start">
                            <div className="flex items-start gap-2 max-w-[85%]">
                              <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/25 flex items-center justify-center shrink-0 mt-1">
                                <AlertTriangle className="w-3 h-3 text-red-400" />
                              </div>
                              <div className="flex flex-col gap-1">
                                {msg.remetenteNome && (
                                  <p className="text-[10px] text-white/30 font-medium px-0.5">{msg.remetenteNome}</p>
                                )}
                                <CancelamentoCard payload={cancelamento} criadoEm={msg.criadoEm} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={`flex ${isCliente ? 'justify-start' : 'justify-end'}`}>
                            <div className={`flex items-end gap-2 max-w-[75%] ${isCliente ? 'flex-row' : 'flex-row-reverse'}`}>
                              {/* Avatar */}
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1 ${
                                isCliente ? 'bg-zinc-700 border border-white/[0.08]' : 'bg-blue-600/25 border border-blue-500/20'
                              }`}>
                                <User className="w-3 h-3 text-white/40" />
                              </div>
                              {/* Bolha */}
                              <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                isCliente
                                  ? 'bg-zinc-800 border border-white/[0.07] text-white/70 rounded-bl-sm'
                                  : 'bg-blue-600/20 border border-blue-500/20 text-white/80 rounded-br-sm'
                              }`}>
                                {isCliente && msg.remetenteNome && (
                                  <p className="text-[10px] text-white/30 mb-1 font-medium">{msg.remetenteNome}</p>
                                )}
                                <p>{msg.mensagem}</p>
                                <div className={`flex items-center justify-end gap-1 mt-1`}>
                                  <span className={`text-[10px] ${isCliente ? 'text-white/20' : 'text-blue-300/30'}`}>
                                    {new Date(msg.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {!isCliente && (
                                    <CheckCheck className={`w-3 h-3 ${msg.lida ? 'text-blue-400/50' : 'text-white/15'}`} />
                                  )}
                                </div>
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
            <div className="px-4 py-3 border-t border-white/[0.05] bg-zinc-900/30 shrink-0">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Digite sua resposta..."
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
          </>
        )}
      </div>
    </div>
  );
}
