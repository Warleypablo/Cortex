import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Scale,
  Sparkles,
  Loader2,
  User,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Conversa {
  id: number;
  titulo: string;
  created_at: string;
  updated_at: string;
}

interface Mensagem {
  id: number;
  conversa_id: number;
  role: "user" | "assistant";
  conteudo: string;
  created_at: string;
}

const SUGGESTION_CARDS = [
  {
    icon: Scale,
    text: "Quais clientes estao inadimplentes ha mais de 90 dias?",
    color: "text-red-500 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
  },
  {
    icon: MessageSquare,
    text: "Resuma os processos judiciais ativos",
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: Sparkles,
    text: "Quais contratos vencem nos proximos 30 dias?",
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    icon: Scale,
    text: "Qual o procedimento para protesto de titulo?",
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
];

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-1">
      <span
        className="w-2 h-2 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-2 h-2 bg-current rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

export default function AssistenteJuridico() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [activeConversaId, setActiveConversaId] = useState<number | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<
    { role: string; conteudo: string }[]
  >([]);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { data: conversas = [] } = useQuery<Conversa[]>({
    queryKey: ["/api/juridico/assistente/conversas"],
  });

  const { data: mensagens = [] } = useQuery<Mensagem[]>({
    queryKey: [
      `/api/juridico/assistente/conversas/${activeConversaId}/mensagens`,
    ],
    enabled: !!activeConversaId,
  });

  // Combined messages: API messages + optimistic messages
  const allMessages = [
    ...mensagens,
    ...optimisticMessages.map((m, i) => ({
      id: -(i + 1),
      conversa_id: activeConversaId || 0,
      role: m.role as "user" | "assistant",
      conteudo: m.conteudo,
      created_at: new Date().toISOString(),
    })),
  ];

  // Auto-scroll on new messages
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [allMessages.length, scrollToBottom]);

  // Focus input when conversation changes
  useEffect(() => {
    if (activeConversaId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeConversaId]);

  // Create conversation mutation
  const createConversaMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        "/api/juridico/assistente/conversas",
      );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/juridico/assistente/conversas"],
      });
      setActiveConversaId(data.id);
      setOptimisticMessages([]);
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      conversaId,
      message,
    }: {
      conversaId: number;
      message: string;
    }) => {
      const res = await apiRequest(
        "POST",
        "/api/juridico/assistente/chat",
        { conversaId, message },
      );
      return res.json();
    },
    onSuccess: (data) => {
      // Add AI response to optimistic messages temporarily
      setOptimisticMessages((prev) => [
        ...prev,
        { role: "assistant", conteudo: data.response },
      ]);
      // Then refetch the real messages and clear optimistic
      queryClient
        .invalidateQueries({
          queryKey: [
            `/api/juridico/assistente/conversas/${activeConversaId}/mensagens`,
          ],
        })
        .then(() => {
          setOptimisticMessages([]);
        });
      // Also refresh conversation list (title may have updated)
      queryClient.invalidateQueries({
        queryKey: ["/api/juridico/assistente/conversas"],
      });
      setIsLoading(false);
    },
    onError: (error) => {
      setOptimisticMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          conteudo: `Erro ao processar mensagem: ${error.message}`,
        },
      ]);
      setIsLoading(false);
    },
  });

  // Delete conversation mutation
  const deleteConversaMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(
        "DELETE",
        `/api/juridico/assistente/conversas/${id}`,
      );
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/juridico/assistente/conversas"],
      });
      if (activeConversaId === deletedId) {
        setActiveConversaId(null);
        setOptimisticMessages([]);
      }
    },
  });

  // Handle send message
  const handleSend = async (messageText?: string) => {
    const text = messageText || inputMessage.trim();
    if (!text || isLoading) return;

    setInputMessage("");
    setIsLoading(true);

    let conversaId = activeConversaId;

    // If no active conversation, create one first
    if (!conversaId) {
      try {
        const res = await apiRequest(
          "POST",
          "/api/juridico/assistente/conversas",
        );
        const data = await res.json();
        conversaId = data.id;
        setActiveConversaId(data.id);
        queryClient.invalidateQueries({
          queryKey: ["/api/juridico/assistente/conversas"],
        });
      } catch {
        setIsLoading(false);
        return;
      }
    }

    // Add user message optimistically
    setOptimisticMessages((prev) => [
      ...prev,
      { role: "user", conteudo: text },
    ]);

    // Send message
    sendMessageMutation.mutate({ conversaId: conversaId!, message: text });
  };

  // Handle new conversation
  const handleNewConversation = () => {
    setActiveConversaId(null);
    setOptimisticMessages([]);
    setInputMessage("");
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format time
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format date for sidebar
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Hoje";
    if (date.toDateString() === yesterday.toDateString()) return "Ontem";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-zinc-950">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
          <Button
            onClick={handleNewConversation}
            className="w-full gap-2"
            variant="outline"
          >
            <Plus className="w-4 h-4" />
            Nova Conversa
          </Button>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversas.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquare className="w-8 h-8 mx-auto text-gray-400 dark:text-zinc-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-zinc-500">
                  Nenhuma conversa ainda
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">
                  Inicie uma nova conversa ou clique em uma sugestao
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
                      {formatDate(conversa.updated_at || conversa.created_at)}
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

        {/* Sidebar footer */}
        <div className="p-3 border-t border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
              <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">
                Assistente Juridico
              </p>
              <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                Powered by AI
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversaId ? (
          <>
            {/* Messages area */}
            <ScrollArea ref={scrollRef} className="flex-1 p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {allMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 dark:bg-zinc-800"
                      }`}
                    >
                      {msg.role === "user" ? (
                        user?.picture ? (
                          <img
                            src={user.picture}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <User className="w-4 h-4" />
                        )
                      ) : (
                        <Bot className="w-4 h-4 text-gray-600 dark:text-zinc-400" />
                      )}
                    </div>

                    {/* Message bubble */}
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
                        <p className="text-sm whitespace-pre-wrap">
                          {msg.conteudo}
                        </p>
                      )}
                      <p
                        className={`text-[10px] mt-1.5 ${
                          msg.role === "user"
                            ? "text-indigo-200"
                            : "text-gray-400 dark:text-zinc-500"
                        }`}
                      >
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
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

            {/* Input bar */}
            <div className="border-t border-gray-200 dark:border-zinc-800 p-4">
              <div className="max-w-3xl mx-auto flex gap-3 items-end">
                <Textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua pergunta juridica..."
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
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state with suggestion cards */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center mx-auto mb-6">
                <Scale className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Assistente Juridico
              </h2>
              <p className="text-gray-500 dark:text-zinc-400 mb-8 max-w-md mx-auto">
                Faca perguntas sobre inadimplencia, contratos, processos judiciais
                e procedimentos legais da empresa.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {SUGGESTION_CARDS.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSend(card.text)}
                      className={`flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className={`w-4 h-4 ${card.color}`} />
                      </div>
                      <p className="text-sm text-gray-700 dark:text-zinc-300 leading-snug">
                        {card.text}
                      </p>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-8">
                As respostas sao geradas por inteligencia artificial e devem ser
                validadas por um profissional qualificado.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
