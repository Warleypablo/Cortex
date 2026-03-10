import { useState, useRef, useEffect } from "react";
import type React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/components/ThemeProvider";
import {
  Loader2,
  MessageSquare,
  Send,
  User,
  X,
  Check,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMensagem {
  id: number;
  clientId: number;
  remetenteTipo: "cliente" | "colaborador";
  remetenteNome: string | null;
  mensagem: string;
  lida: boolean;
  criadoEm: string;
}

interface ChatData {
  mensagens: ChatMensagem[];
  responsavel: string | null;
}

type SystemMsg =
  | { _type: "encerramento"; atendimentoId: number; encerradoPor: string }
  | { _type: "avaliacao_request"; atendimentoId: number }
  | { _type: "avaliacao_respondida"; atendimentoId: number; nota: number }
  | { _type: "cancelamento" };

// ── Props ──────────────────────────────────────────────────────────────────────

export interface PortalChatProps {
  clientId: number;
  variant: "page" | "floating";
  onClose?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Hoje";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function parseSystemMsg(mensagem: string): SystemMsg | null {
  try {
    const p = JSON.parse(mensagem);
    if (
      p &&
      [
        "encerramento",
        "avaliacao_request",
        "avaliacao_respondida",
        "cancelamento",
      ].includes(p._type)
    )
      return p;
  } catch {
    /* não é JSON */
  }
  return null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EncerramentoBanner({
  msg,
  isDark,
}: {
  msg: { _type: "encerramento"; encerradoPor: string };
  isDark: boolean;
}) {
  return (
    <div className="flex items-center gap-2 my-3">
      <div
        className={`flex-1 h-px ${isDark ? "bg-white/[0.06]" : "bg-black/[0.06]"}`}
      />
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
          isDark
            ? "bg-zinc-800/80 border-white/[0.07]"
            : "bg-gray-100/80 border-black/[0.07]"
        }`}
      >
        <Check className="w-3 h-3 text-emerald-400/70" />
        <span
          className={`text-[11px] ${isDark ? "text-white/35" : "text-gray-500"}`}
        >
          Atendimento encerrado por{" "}
          <span className={isDark ? "text-white/50" : "text-gray-700"}>
            {msg.encerradoPor}
          </span>
        </span>
      </div>
      <div
        className={`flex-1 h-px ${isDark ? "bg-white/[0.06]" : "bg-black/[0.06]"}`}
      />
    </div>
  );
}

function AvaliacaoWidget({
  atendimentoId,
  isDark,
}: {
  atendimentoId: number;
  isDark: boolean;
}) {
  const queryClient = useQueryClient();
  const [nota, setNota] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");

  const avaliarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal-cliente/avaliar-atendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atendimentoId, nota, comentario }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao enviar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-cliente/chat"] });
    },
  });

  const EMOJIS = ["😡", "😟", "😐", "🙂", "😍"];
  const LABELS = ["Péssimo", "Ruim", "Regular", "Bom", "Ótimo"];
  const active = hover ?? nota;

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        isDark
          ? "border-blue-500/15 bg-blue-950/15"
          : "border-blue-400/25 bg-blue-50/60"
      }`}
    >
      <div
        className={`px-4 py-3 border-b ${
          isDark ? "border-blue-500/10" : "border-blue-400/15"
        }`}
      >
        <p
          className={`text-sm font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}
        >
          Como foi o atendimento?
        </p>
        <p
          className={`text-[11px] mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}
        >
          Sua avaliação nos ajuda a melhorar
        </p>
      </div>
      <div className="px-4 py-3 space-y-3">
        {/* Emojis */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setNota(i)}
              className="flex flex-col items-center gap-1 transition-transform hover:scale-110"
            >
              <span
                className={`text-2xl leading-none transition-all ${
                  active && i <= active ? "opacity-100" : "opacity-25"
                }`}
              >
                {EMOJIS[i - 1]}
              </span>
              {active === i && (
                <span
                  className={`text-[9px] ${isDark ? "text-white/40" : "text-gray-400"}`}
                >
                  {LABELS[i - 1]}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Comentário */}
        {nota && (
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Comentário opcional..."
            rows={2}
            className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/30 resize-none transition-colors ${
              isDark
                ? "bg-zinc-800/60 border-white/[0.07] text-white/70 placeholder:text-white/20"
                : "bg-white border-gray-200 text-gray-700 placeholder:text-gray-300"
            }`}
          />
        )}
        <button
          onClick={() => avaliarMutation.mutate()}
          disabled={!nota || avaliarMutation.isPending}
          className={`w-full py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            isDark
              ? "bg-blue-600/25 hover:bg-blue-600/35 border-blue-500/20 text-blue-300/80"
              : "bg-blue-100 hover:bg-blue-200 border-blue-300/50 text-blue-700"
          }`}
        >
          {avaliarMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            "Enviar avaliação"
          )}
        </button>
      </div>
    </div>
  );
}

function AvaliacaoRespondida({
  nota,
  isDark,
}: {
  nota: number;
  isDark: boolean;
}) {
  const EMOJIS = ["😡", "😟", "😐", "🙂", "😍"];
  const LABELS = ["Péssimo", "Ruim", "Regular", "Bom", "Ótimo"];
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
        isDark
          ? "bg-zinc-800/40 border-white/[0.06]"
          : "bg-gray-100/60 border-gray-200"
      }`}
    >
      <span className="text-2xl">{EMOJIS[nota - 1]}</span>
      <div>
        <p
          className={`text-xs font-medium ${isDark ? "text-white/60" : "text-gray-600"}`}
        >
          Avaliação enviada
        </p>
        <p
          className={`text-[11px] ${isDark ? "text-white/30" : "text-gray-400"}`}
        >
          {LABELS[nota - 1]} · Obrigado pelo feedback!
        </p>
      </div>
      <div className="ml-auto flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`text-sm ${i <= nota ? "opacity-100" : "opacity-15"}`}
          >
            ⭐
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PortalChat({
  clientId,
  variant,
  onClose,
  onUnreadCountChange,
}: PortalChatProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isFloating = variant === "floating";

  const { data, isLoading } = useQuery<ChatData>({
    queryKey: ["/api/portal-cliente/chat"],
    refetchInterval: 3000,
    staleTime: 0,
  });

  const enviarMutation = useMutation({
    mutationFn: async (mensagem: string) => {
      const res = await fetch("/api/portal-cliente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao enviar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/portal-cliente/chat"],
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.mensagens?.length]);

  // Notify parent of unread count (messages from colaborador not yet read)
  useEffect(() => {
    if (!onUnreadCountChange) return;
    const unread = (data?.mensagens ?? []).filter(
      (m) => m.remetenteTipo === "colaborador" && m.lida === false
    ).length;
    onUnreadCountChange(unread);
  }, [data?.mensagens, onUnreadCountChange]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = inputValue.trim();
    if (!msg) return;
    setInputValue("");
    enviarMutation.mutate(msg);
  }

  const mensagens = data?.mensagens ?? [];
  const responsavel = data?.responsavel ?? null;

  // ── Container classes ────────────────────────────────────────────────────────

  const containerClass = isFloating
    ? `fixed bottom-24 right-5 w-80 rounded-2xl overflow-hidden flex flex-col z-50 shadow-2xl shadow-black/50 border ${
        isDark
          ? "bg-zinc-900 border-white/[0.10]"
          : "bg-white border-gray-200"
      }`
    : `rounded-2xl overflow-hidden flex flex-col border ${
        isDark
          ? "bg-zinc-900 border-white/[0.07]"
          : "bg-white border-gray-200"
      }`;

  const containerHeight = isFloating ? "420px" : "520px";

  // ── Header classes ───────────────────────────────────────────────────────────

  const headerClass = isFloating
    ? `px-4 py-3 border-b flex items-center shrink-0 ${
        isDark
          ? "border-white/[0.06] bg-zinc-800/60"
          : "border-gray-100 bg-gray-50"
      }`
    : `px-5 py-4 border-b flex items-center gap-3 shrink-0 ${
        isDark ? "border-white/[0.05]" : "border-gray-100"
      }`;

  // ── Message list classes ─────────────────────────────────────────────────────

  const msgListClass = isFloating
    ? "flex-1 overflow-y-auto px-3.5 py-3 space-y-2"
    : "flex-1 overflow-y-auto px-5 py-4 space-y-3";

  // ── Input area classes ───────────────────────────────────────────────────────

  const inputAreaClass = isFloating
    ? `px-3 py-2.5 border-t shrink-0 ${isDark ? "border-white/[0.05]" : "border-gray-100"}`
    : `px-4 py-3 border-t shrink-0 ${isDark ? "border-white/[0.05]" : "border-gray-100"}`;

  return (
    <div className={containerClass} style={{ height: containerHeight }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={headerClass}>
        {/* Icon */}
        <div
          className={`rounded-full flex items-center justify-center shrink-0 ${
            isFloating
              ? "w-7 h-7 border border-blue-500/20 bg-blue-600/25"
              : "w-8 h-8 border border-blue-500/20 bg-blue-600/20"
          }`}
        >
          <MessageSquare
            className={`text-blue-400/70 ${isFloating ? "w-3.5 h-3.5" : "w-4 h-4"}`}
          />
        </div>

        {/* Title / responsible */}
        <div
          className={`${isFloating ? "flex-1 min-w-0 ml-2.5" : "ml-0 flex-none"}`}
        >
          <p
            className={`font-medium ${
              isFloating
                ? `text-xs font-semibold ${isDark ? "text-white/75" : "text-gray-700"}`
                : `text-sm ${isDark ? "text-white/75" : "text-gray-700"}`
            }`}
          >
            Atendimento
          </p>
          {responsavel && (
            <p
              className={`${
                isFloating
                  ? `text-[10px] truncate ${isDark ? "text-white/30" : "text-gray-400"}`
                  : `text-[11px] ${isDark ? "text-white/30" : "text-gray-400"}`
              }`}
            >
              {isFloating ? `Com ${responsavel}` : `Responsável: `}
              {!isFloating && (
                <span className={isDark ? "text-white/50" : "text-gray-600"}>
                  {responsavel}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Online indicator (page only) or Close button (floating only) */}
        {isFloating ? (
          <button
            onClick={onClose}
            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ml-auto ${
              isDark
                ? "text-white/25 hover:text-white/60 hover:bg-white/5"
                : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
            <span
              className={`text-[11px] ${isDark ? "text-white/25" : "text-gray-400"}`}
            >
              Online
            </span>
          </div>
        )}
      </div>

      {/* ── Message list ────────────────────────────────────────────────────── */}
      <div className={msgListClass}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2
              className={`animate-spin ${
                isFloating
                  ? `w-4 h-4 ${isDark ? "text-white/20" : "text-gray-300"}`
                  : `w-5 h-5 ${isDark ? "text-white/20" : "text-gray-300"}`
              }`}
            />
          </div>
        ) : mensagens.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center h-full text-center ${
              isFloating ? "gap-2" : "gap-3"
            }`}
          >
            {isFloating ? (
              <>
                <MessageSquare
                  className={`w-8 h-8 ${isDark ? "text-white/10" : "text-gray-200"}`}
                />
                <p
                  className={`text-xs ${isDark ? "text-white/25" : "text-gray-400"}`}
                >
                  Envie uma mensagem para iniciar o atendimento
                </p>
              </>
            ) : (
              <>
                <div
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
                    isDark
                      ? "bg-zinc-800 border-white/[0.06]"
                      : "bg-gray-100 border-gray-200"
                  }`}
                >
                  <MessageSquare
                    className={`w-5 h-5 ${isDark ? "text-white/15" : "text-gray-300"}`}
                  />
                </div>
                <div>
                  <p
                    className={`text-sm font-medium ${isDark ? "text-white/30" : "text-gray-400"}`}
                  >
                    Nenhuma mensagem ainda
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${isDark ? "text-white/15" : "text-gray-300"}`}
                  >
                    Envie uma mensagem para iniciar o atendimento
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {mensagens.map((msg, idx) => {
              const isCliente = msg.remetenteTipo === "cliente";
              const prevMsg = idx > 0 ? mensagens[idx - 1] : null;
              const showDayLabel =
                !prevMsg ||
                formatDayLabel(msg.criadoEm) !==
                  formatDayLabel(prevMsg.criadoEm);
              const sysMsg = parseSystemMsg(msg.mensagem);

              return (
                <div key={msg.id}>
                  {/* Day separator */}
                  {showDayLabel && (
                    <div
                      className={`flex items-center ${isFloating ? "gap-1.5 my-1.5" : "gap-2 my-2"}`}
                    >
                      <div
                        className={`flex-1 h-px ${isDark ? "bg-white/[0.05]" : "bg-black/[0.05]"}`}
                      />
                      <span
                        className={`${
                          isFloating
                            ? `text-[9px] ${isDark ? "text-white/20" : "text-gray-300"}`
                            : `text-[10px] px-2 ${isDark ? "text-white/20" : "text-gray-300"}`
                        }`}
                      >
                        {formatDayLabel(msg.criadoEm)}
                      </span>
                      <div
                        className={`flex-1 h-px ${isDark ? "bg-white/[0.05]" : "bg-black/[0.05]"}`}
                      />
                    </div>
                  )}

                  {/* System messages */}
                  {sysMsg?._type === "encerramento" ? (
                    <EncerramentoBanner
                      msg={sysMsg as { _type: "encerramento"; encerradoPor: string }}
                      isDark={isDark}
                    />
                  ) : sysMsg?._type === "avaliacao_request" ? (
                    <AvaliacaoWidget
                      atendimentoId={(sysMsg as { _type: "avaliacao_request"; atendimentoId: number }).atendimentoId}
                      isDark={isDark}
                    />
                  ) : sysMsg?._type === "avaliacao_respondida" ? (
                    <AvaliacaoRespondida
                      nota={(sysMsg as { _type: "avaliacao_respondida"; nota: number }).nota}
                      isDark={isDark}
                    />
                  ) : sysMsg?._type === "cancelamento" ? null : (
                    /* Regular message bubble */
                    <div
                      className={`flex ${isCliente ? "justify-end" : "justify-start"}`}
                    >
                      {isFloating ? (
                        /* Floating: compact bubble without avatar */
                        <div
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                            isCliente
                              ? `rounded-br-sm ${
                                  isDark
                                    ? "bg-blue-600/25 border border-blue-500/20 text-white/80"
                                    : "bg-blue-500 text-white border border-blue-400"
                                }`
                              : `rounded-bl-sm ${
                                  isDark
                                    ? "bg-zinc-800 border border-white/[0.07] text-white/65"
                                    : "bg-gray-100 border border-gray-200 text-gray-700"
                                }`
                          }`}
                        >
                          {!isCliente && msg.remetenteNome && (
                            <p
                              className={`text-[9px] mb-0.5 font-medium ${
                                isDark ? "text-white/30" : "text-gray-400"
                              }`}
                            >
                              {msg.remetenteNome}
                            </p>
                          )}
                          <p>{msg.mensagem}</p>
                          <p
                            className={`text-[9px] mt-0.5 text-right ${
                              isCliente
                                ? isDark
                                  ? "text-blue-300/25"
                                  : "text-white/50"
                                : isDark
                                  ? "text-white/18"
                                  : "text-gray-400"
                            }`}
                          >
                            {formatTime(msg.criadoEm)}
                          </p>
                        </div>
                      ) : (
                        /* Page: bubble with avatar */
                        <div
                          className={`flex items-end gap-2 max-w-[80%] ${
                            isCliente ? "flex-row-reverse" : "flex-row"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1 border ${
                              isCliente
                                ? isDark
                                  ? "bg-blue-600/30 border-blue-500/20"
                                  : "bg-blue-100 border-blue-300/40"
                                : isDark
                                  ? "bg-zinc-700 border-white/[0.08]"
                                  : "bg-gray-200 border-gray-300/40"
                            }`}
                          >
                            <User
                              className={`w-3 h-3 ${isDark ? "text-white/40" : "text-gray-500"}`}
                            />
                          </div>
                          <div
                            className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                              isCliente
                                ? `rounded-br-sm ${
                                    isDark
                                      ? "bg-blue-600/25 border border-blue-500/20 text-white/85"
                                      : "bg-blue-500 border border-blue-400 text-white"
                                  }`
                                : `rounded-bl-sm ${
                                    isDark
                                      ? "bg-zinc-800 border border-white/[0.07] text-white/70"
                                      : "bg-gray-100 border border-gray-200 text-gray-700"
                                  }`
                            }`}
                          >
                            {!isCliente && msg.remetenteNome && (
                              <p
                                className={`text-[10px] mb-1 font-medium ${
                                  isDark ? "text-white/30" : "text-gray-400"
                                }`}
                              >
                                {msg.remetenteNome}
                              </p>
                            )}
                            <p>{msg.mensagem}</p>
                            <p
                              className={`text-[10px] mt-1 text-right ${
                                isCliente
                                  ? isDark
                                    ? "text-blue-300/30"
                                    : "text-white/50"
                                  : isDark
                                    ? "text-white/20"
                                    : "text-gray-400"
                              }`}
                            >
                              {formatTime(msg.criadoEm)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div className={inputAreaClass}>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isFloating ? "Digite uma mensagem..." : "Digite sua mensagem..."
            }
            disabled={enviarMutation.isPending}
            className={`flex-1 border transition-colors focus:outline-none ${
              isFloating
                ? `rounded-lg px-3 py-2 text-xs ${
                    isDark
                      ? "bg-zinc-800 border-white/[0.08] text-white/75 placeholder:text-white/20 focus:border-blue-500/35"
                      : "bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-300 focus:border-blue-400/60"
                  }`
                : `rounded-xl px-4 py-2.5 text-sm focus:ring-1 ${
                    isDark
                      ? "bg-zinc-800 border-white/[0.08] text-white/80 placeholder:text-white/20 focus:border-blue-500/40 focus:ring-blue-500/15"
                      : "bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-300 focus:border-blue-400/60 focus:ring-blue-400/10"
                  }`
            }`}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || enviarMutation.isPending}
            className={`flex items-center justify-center border border-blue-500/20 text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-blue-600/25 hover:bg-blue-600/40 shrink-0 ${
              isFloating ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl"
            } ${
              !isDark ? "bg-blue-100 hover:bg-blue-200 border-blue-300/50 text-blue-600" : ""
            }`}
          >
            {enviarMutation.isPending ? (
              <Loader2
                className={`animate-spin ${isFloating ? "w-3.5 h-3.5" : "w-4 h-4"}`}
              />
            ) : (
              <Send className={isFloating ? "w-3.5 h-3.5" : "w-4 h-4"} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PortalChat;
