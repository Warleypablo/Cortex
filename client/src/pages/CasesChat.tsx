import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  Sparkles,
  Loader2,
  User,
  ChevronDown,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────

interface Conversa {
  id: number;
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
}

interface Mensagem {
  id: number;
  conversaId: number;
  role: "user" | "assistant";
  conteudo: string;
  modelo: string | null;
  criadoEm: string;
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  icon: string;
  color: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MODELS: ModelOption[] = [
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", icon: "⚡", color: "text-green-500" },
  { id: "claude-sonnet-4-5-20250514", name: "Claude Sonnet", provider: "anthropic", icon: "🟠", color: "text-orange-500" },
  { id: "gemini-2.0-flash", name: "Gemini Flash", provider: "google", icon: "💎", color: "text-blue-500" },
];

const SUGGESTION_CARDS = [
  {
    icon: Sparkles,
    text: "Me ajude a escrever um email profissional",
    color: "text-purple-500 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    icon: MessageSquare,
    text: "Resuma este texto para mim",
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: Sparkles,
    text: "Analise estes dados e me de insights",
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    icon: MessageSquare,
    text: "Crie uma apresentacao sobre este tema",
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
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

function ModelBadge({ modelId }: { modelId: string | null }) {
  if (!modelId) return null;
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500">
      <span>{model.icon}</span>
      <span>{model.name}</span>
    </span>
  );
}

function ModelSelector({
  selectedModel,
  onSelect,
}: {
  selectedModel: string;
  onSelect: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const current = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-center h-8 rounded-xl px-3 gap-1.5 transition-all duration-200 text-xs font-medium
          ${isOpen
            ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white"
            : "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50"
          }`}
      >
        <span>{current.icon}</span>
        <span className="whitespace-nowrap">{current.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 opacity-75 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-[220px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50 p-1"
          >
            {MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onSelect(model.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <span>{model.icon}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{model.name}</span>
                </div>
                {selectedModel === model.id && (
                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CasesChat() {
  usePageTitle("IA Hub");
  useSetPageInfo("GPTurbo");

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeConversaId, setActiveConversaId] = useState<number | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [isLoading, setIsLoading] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<
    { role: string; conteudo: string; modelo: string | null }[]
  >([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { data: conversas = [] } = useQuery<Conversa[]>({
    queryKey: ["/api/ia-hub/conversas"],
  });

  const { data: mensagens = [] } = useQuery<Mensagem[]>({
    queryKey: [`/api/ia-hub/conversas/${activeConversaId}/mensagens`],
    enabled: !!activeConversaId,
  });

  const allMessages: Mensagem[] = [
    ...mensagens,
    ...optimisticMessages.map((m, i) => ({
      id: -(i + 1),
      conversaId: activeConversaId || 0,
      role: m.role as "user" | "assistant",
      conteudo: m.conteudo,
      modelo: m.modelo,
      criadoEm: new Date().toISOString(),
    })),
  ];

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [allMessages.length, scrollToBottom]);
  useEffect(() => {
    if (activeConversaId && inputRef.current) inputRef.current.focus();
  }, [activeConversaId]);

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversaId, message, modelo }: { conversaId: number; message: string; modelo: string }) => {
      const res = await apiRequest("POST", "/api/ia-hub/chat", { conversaId, message, modelo });
      return res.json();
    },
    onSuccess: (data) => {
      setOptimisticMessages((prev) => [
        ...prev,
        { role: "assistant", conteudo: data.conteudo, modelo: data.modelo },
      ]);
      queryClient
        .invalidateQueries({ queryKey: [`/api/ia-hub/conversas/${activeConversaId}/mensagens`] })
        .then(() => setOptimisticMessages([]));
      queryClient.invalidateQueries({ queryKey: ["/api/ia-hub/conversas"] });
      setIsLoading(false);
    },
    onError: (error) => {
      setOptimisticMessages((prev) => [
        ...prev,
        { role: "assistant", conteudo: `Erro: ${error.message}`, modelo: null },
      ]);
      setIsLoading(false);
    },
  });

  const deleteConversaMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ia-hub/conversas/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ia-hub/conversas"] });
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
        const res = await apiRequest("POST", "/api/ia-hub/conversas");
        const data = await res.json();
        conversaId = data.id;
        setActiveConversaId(data.id);
        queryClient.invalidateQueries({ queryKey: ["/api/ia-hub/conversas"] });
      } catch {
        setIsLoading(false);
        return;
      }
    }

    setOptimisticMessages((prev) => [...prev, { role: "user", conteudo: text, modelo: null }]);
    sendMessageMutation.mutate({ conversaId: conversaId!, message: text, modelo: selectedModel });
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
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
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
                  Inicie uma nova conversa com qualquer IA
                </p>
              </div>
            ) : (
              conversas.map((conversa) => (
                <div
                  key={conversa.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    activeConversaId === conversa.id
                      ? "bg-gray-100 dark:bg-zinc-800"
                      : "hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                  }`}
                  onClick={() => {
                    setActiveConversaId(conversa.id);
                    setOptimisticMessages([]);
                  }}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-zinc-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {conversa.titulo || "Nova conversa"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">
                      {formatDate(conversa.atualizadoEm || conversa.criadoEm)}
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
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">IA Hub</p>
              <p className="text-[10px] text-gray-500 dark:text-zinc-500">Multi-model AI</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversaId ? (
          <>
            {/* Header with model selector */}
            <div className="border-b border-gray-200 dark:border-zinc-800 px-4 py-2 flex items-center">
              <ModelSelector selectedModel={selectedModel} onSelect={setSelectedModel} />
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollRef} className="flex-1 p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {allMessages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 dark:bg-zinc-800"
                      }`}
                    >
                      {msg.role === "user" ? (
                        user?.picture ? (
                          <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <User className="w-4 h-4" />
                        )
                      ) : (
                        <Bot className="w-4 h-4 text-gray-600 dark:text-zinc-400" />
                      )}
                    </div>

                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-code:bg-gray-200 dark:prose-code:bg-zinc-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-200 dark:prose-pre:bg-zinc-700 prose-pre:p-3">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.conteudo}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <ModelBadge modelId={msg.modelo} />
                        <p
                          className={`text-[10px] ${
                            msg.role === "user" ? "text-indigo-200" : "text-gray-400 dark:text-zinc-500"
                          }`}
                        >
                          {formatTime(msg.criadoEm)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-gray-600 dark:text-zinc-400" />
                    </div>
                    <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-gray-600 dark:text-zinc-400">
                      <TypingIndicator />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t border-gray-200 dark:border-zinc-800 p-4">
              <div className="max-w-3xl mx-auto flex gap-3 items-end">
                <Textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Envie uma mensagem..."
                  disabled={isLoading}
                  className="flex-1 min-h-[44px] max-h-[160px] resize-none bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                  rows={1}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!inputMessage.trim() || isLoading}
                  size="icon"
                  className="h-11 w-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">IA Hub</h2>
              <p className="text-gray-500 dark:text-zinc-400 mb-4">
                Converse com as melhores IAs do mercado em um so lugar.
              </p>

              <div className="flex justify-center mb-8">
                <ModelSelector selectedModel={selectedModel} onSelect={setSelectedModel} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {SUGGESTION_CARDS.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSend(card.text)}
                      className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
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
                As respostas sao geradas por inteligencia artificial. Verifique informacoes importantes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
