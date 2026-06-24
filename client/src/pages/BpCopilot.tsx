import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  User,
  ArrowLeft,
  TrendingDown,
  Target,
  AlertTriangle,
  LineChart,
  Wallet,
  Layers,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Types ────────────────────────────────────────────────────────────────────

interface Conversa {
  id: number;
  titulo: string;
  criado_em: string;
  atualizado_em: string;
}

interface Mensagem {
  id: number;
  conversa_id: number;
  role: "user" | "assistant";
  conteudo: string;
  tool_calls: unknown;
  criado_em: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SUGGESTION_CARDS = [
  {
    icon: LineChart,
    text: "Como o ano provavelmente fecha no ritmo atual?",
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: Target,
    text: "Qual é o maior gargalo do negócio agora?",
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    icon: TrendingDown,
    text: "E se o churn subir 2pp no 2º semestre?",
    color: "text-red-500 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
  },
  {
    icon: Wallet,
    text: "Onde estou queimando caixa acima do orçado?",
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    icon: Layers,
    text: "Compare o atingimento por produto no Revenue",
    color: "text-purple-500 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    icon: AlertTriangle,
    text: "Quais linhas estão mais fora da meta no YTD?",
    color: "text-cyan-500 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
  },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-1">
      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function BpCopilot() {
  usePageTitle("BP Copilot");
  useSetPageInfo("BP Copilot", "Copiloto de decisão do Business Plan");

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeConversaId, setActiveConversaId] = useState<number | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<{ role: string; conteudo: string }[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { data: conversas = [] } = useQuery<Conversa[]>({
    queryKey: ["/api/bp-copilot/conversas"],
    queryFn: async () => {
      const res = await fetch("/api/bp-copilot/conversas", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar conversas");
      return res.json();
    },
  });

  const { data: mensagens = [] } = useQuery<Mensagem[]>({
    queryKey: [`/api/bp-copilot/conversas/${activeConversaId}/mensagens`],
    enabled: !!activeConversaId,
    queryFn: async () => {
      const res = await fetch(`/api/bp-copilot/conversas/${activeConversaId}/mensagens`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar mensagens");
      return res.json();
    },
  });

  // Combine DB messages with optimistic ones, filtering out duplicates
  const allMessages: Mensagem[] = [
    ...mensagens,
    ...optimisticMessages
      .filter((om) => !mensagens.some((m) => m.role === om.role && m.conteudo === om.conteudo))
      .map((m, i) => ({
        id: -(i + 1),
        conversa_id: activeConversaId || 0,
        role: m.role as "user" | "assistant",
        conteudo: m.conteudo,
        tool_calls: null,
        criado_em: new Date().toISOString(),
      })),
  ];

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [allMessages.length, scrollToBottom]);

  useEffect(() => {
    // Foca o input ao abrir uma conversa E ao voltar p/ nova conversa (estado vazio).
    inputRef.current?.focus();
  }, [activeConversaId]);

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversaId, message }: { conversaId: number; message: string }) => {
      const res = await fetch("/api/bp-copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversaId, message }),
      });
      if (!res.ok) throw new Error("Erro ao enviar mensagem");
      return res.json();
    },
    onSuccess: (data) => {
      setOptimisticMessages((prev) => [...prev, { role: "assistant", conteudo: data.conteudo }]);
      queryClient
        .invalidateQueries({ queryKey: [`/api/bp-copilot/conversas/${activeConversaId}/mensagens`] })
        .then(() => setOptimisticMessages([]));
      queryClient.invalidateQueries({ queryKey: ["/api/bp-copilot/conversas"] });
      setIsLoading(false);
    },
    onError: (error) => {
      setOptimisticMessages((prev) => [...prev, { role: "assistant", conteudo: `Erro: ${error.message}` }]);
      setIsLoading(false);
    },
  });

  const deleteConversaMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/bp-copilot/conversas/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Erro ao deletar conversa");
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bp-copilot/conversas"] });
      if (activeConversaId === deletedId) {
        setActiveConversaId(null);
        setOptimisticMessages([]);
      }
    },
  });

  // Handlers
  const handleSend = async (messageText?: string) => {
    const text = messageText || inputMessage.trim();
    if (!text || isLoading) return;

    setInputMessage("");
    setIsLoading(true);

    let conversaId = activeConversaId;

    if (!conversaId) {
      try {
        const res = await fetch("/api/bp-copilot/conversas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!res.ok) throw new Error("Erro ao criar conversa");
        const data = await res.json();
        conversaId = data.id;
        setActiveConversaId(data.id);
        queryClient.invalidateQueries({ queryKey: ["/api/bp-copilot/conversas"] });
      } catch {
        setIsLoading(false);
        return;
      }
    }

    setOptimisticMessages((prev) => [...prev, { role: "user", conteudo: text }]);
    sendMessageMutation.mutate({ conversaId: conversaId!, message: text });
  };

  const handleNewConversation = () => {
    setActiveConversaId(null);
    setOptimisticMessages([]);
    setInputMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Hoje";
    if (date.toDateString() === yesterday.toDateString()) return "Ontem";
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-zinc-950">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 space-y-2">
          <Link href="/bp-2026">
            <Button variant="ghost" className="w-full justify-start gap-2 text-gray-500 dark:text-zinc-400 h-8">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao BP 2026
            </Button>
          </Link>
          <Button onClick={handleNewConversation} className="w-full gap-2" variant="outline">
            <Plus className="w-4 h-4" />
            Nova Conversa
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversas.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquare className="w-8 h-8 mx-auto text-gray-400 dark:text-zinc-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-zinc-500">Nenhuma conversa ainda</p>
                <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">
                  Inicie uma nova conversa com o BP Copilot
                </p>
              </div>
            ) : (
              conversas.map((conversa) => (
                <div
                  key={conversa.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    activeConversaId === conversa.id
                      ? "bg-blue-50 dark:bg-blue-950/30"
                      : "hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                  }`}
                  onClick={() => {
                    setActiveConversaId(conversa.id);
                    setOptimisticMessages([]);
                  }}
                >
                  <MessageSquare
                    className={`w-4 h-4 flex-shrink-0 ${
                      activeConversaId === conversa.id
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-zinc-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {conversa.titulo || "Nova conversa"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">
                      {formatDate(conversa.atualizado_em || conversa.criado_em)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversaMutation.mutate(conversa.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">BP Copilot</p>
              <p className="text-[10px] text-gray-500 dark:text-zinc-500">Claude Opus 4.8</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversaId && allMessages.length > 0 ? (
          <>
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-zinc-800 px-4 py-2 flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">BP Copilot</span>
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                Copiloto de decisão do Business Plan
              </span>
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollRef} className="flex-1 p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {allMessages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-zinc-800"
                      }`}
                    >
                      {msg.role === "user" ? (
                        user?.picture ? (
                          <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <User className="w-4 h-4" />
                        )
                      ) : (
                        <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>

                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-code:bg-gray-200 dark:prose-code:bg-zinc-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-200 dark:prose-pre:bg-zinc-700 prose-pre:p-3 prose-table:text-sm prose-th:px-3 prose-th:py-1 prose-td:px-3 prose-td:py-1">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.conteudo}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                      )}
                      <p
                        className={`text-[10px] mt-1.5 text-right ${
                          msg.role === "user" ? "text-blue-200" : "text-gray-400 dark:text-zinc-500"
                        }`}
                      >
                        {formatTime(msg.criado_em)}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-blue-600 dark:text-blue-400">
                      <TypingIndicator />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          /* Empty state with suggestion cards */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center mx-auto mb-6">
                <Bot className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">BP Copilot</h2>
              <p className="text-gray-500 dark:text-zinc-400 mb-8">
                Copiloto de decisão do Business Plan. Pergunte sobre orçado × realizado, churn,
                geração de caixa, gargalos e projeções de cenário.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl mx-auto">
                {SUGGESTION_CARDS.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSend(card.text)}
                      className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 bg-white dark:bg-zinc-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${card.color}`} />
                      </div>
                      <p className="text-sm text-gray-700 dark:text-zinc-300 leading-snug">{card.text}</p>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-8">
                Respostas geradas por IA com acesso aos dados do BP. Projeções são cenários — confira as premissas.
              </p>
            </div>
          </div>
        )}

        {/* Input — sempre visível (inclusive em nova conversa / estado vazio) */}
        <div className="border-t border-gray-200 dark:border-zinc-800 p-4">
          <div className="max-w-3xl mx-auto flex gap-3 items-end">
            <Textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre o BP — orçado, churn, caixa, projeções..."
              disabled={isLoading}
              className="flex-1 min-h-[44px] max-h-[160px] resize-none bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
              rows={1}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!inputMessage.trim() || isLoading}
              size="icon"
              className="h-11 w-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
