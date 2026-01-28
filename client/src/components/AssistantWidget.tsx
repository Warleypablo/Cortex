import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bot, User, Loader2, Sparkles, Send, Trash2, Copy, Check, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AssistantContext } from "@shared/schema";

const LOCALSTORAGE_KEY = "gpturbo-messages";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  detectedContext?: AssistantContext;
}

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  detectedContext?: AssistantContext;
}

const CONTEXT_LABELS: Record<string, string> = {
  geral: "Geral",
  financeiro: "Financeiro",
  cases: "Cases",
  clientes: "Clientes",
};

const DEFAULT_SUGGESTIONS = [
  "Qual foi o resultado financeiro deste mês?",
  "Quantos clientes ativos temos?",
  "Me conte sobre um case de sucesso",
  "Quais serviços a agência oferece?",
];

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/dashboard/financeiro": [
    "Qual é o resultado financeiro atual?",
    "Como está o fluxo de caixa?",
    "Quais são as principais despesas?",
    "Qual é a previsão para o próximo mês?",
  ],
  "/dashboard/clientes": [
    "Quantos clientes ativos temos?",
    "Qual é a taxa de churn atual?",
    "Quais clientes precisam de atenção?",
    "Como está a satisfação dos clientes?",
  ],
  "/dashboard/comercial": [
    "Qual é o pipeline atual de vendas?",
    "Quantas propostas foram enviadas?",
    "Qual é a taxa de conversão?",
    "Quais são os principais leads?",
  ],
  "/clientes": [
    "Quantos clientes ativos temos?",
    "Qual cliente tem maior faturamento?",
    "Liste os clientes mais recentes",
    "Quais clientes estão inativos?",
  ],
  "/cases": [
    "Me conte sobre um case de sucesso",
    "Qual foi o melhor resultado de case?",
    "Quantos cases ativos temos?",
    "Quais são os cases mais recentes?",
  ],
  "/dashboard/growth": [
    "Qual é o crescimento atual?",
    "Como está o CAC?",
    "Qual é o LTV médio?",
    "Quais são as métricas de crescimento?",
  ],
  "/dashboard/inadimplencia": [
    "Qual é a taxa de inadimplência atual?",
    "Quais clientes estão inadimplentes?",
    "Qual é o valor total em atraso?",
    "Como está a evolução da inadimplência?",
  ],
  "/dashboard/dfc": [
    "Como está o fluxo de caixa?",
    "Quais são as projeções de caixa?",
    "Qual é o saldo atual?",
    "Quais são os principais pagamentos pendentes?",
  ],
};

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-1">
      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background/50"
          data-testid="button-copy-message"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3 text-muted-foreground" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{copied ? "Copiado!" : "Copiar"}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function getContextualSuggestions(location: string): string[] {
  for (const [path, suggestions] of Object.entries(PAGE_SUGGESTIONS)) {
    if (location.startsWith(path)) {
      return suggestions;
    }
  }
  return DEFAULT_SUGGESTIONS;
}

export function AssistantWidget() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = getContextualSuggestions(location);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALSTORAGE_KEY);
      if (stored) {
        const parsed: StoredMessage[] = JSON.parse(stored);
        const restored: Message[] = parsed.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(restored);
      }
    } catch (e) {
      console.error("Failed to restore messages from localStorage:", e);
    }
  }, []);

  useEffect(() => {
    try {
      const toStore: StoredMessage[] = messages.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      }));
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
      console.error("Failed to save messages to localStorage:", e);
    }
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const historico = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await apiRequest("POST", "/api/assistants/chat", {
        message,
        context: "auto",
        historico,
        metadata: {
          pageContext: location,
        },
      });
      return response.json();
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.resposta || "Sem resposta do servidor.",
        timestamp: new Date(),
        detectedContext: data.context,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Erro ao processar mensagem: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  if (location === "/login" || location === "/dashboard/comercial/apresentacao") {
    return null;
  }

  const handleSendMessage = (messageText?: string) => {
    const text = messageText || inputValue;
    if (!text.trim() || sendMessageMutation.isPending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMessageMutation.mutate(text.trim());
    setInputValue("");
    inputRef.current?.focus();
  };

  const handleClearConversation = () => {
    setMessages([]);
    localStorage.removeItem(LOCALSTORAGE_KEY);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleMaximize = () => {
    setIsMaximized((prev) => !prev);
  };

  const headerContent = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-base font-semibold">
        <Bot className="h-5 w-5 text-primary" />
        GPTurbo
      </div>
      <div className="flex items-center gap-1">
        {messages.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleClearConversation}
                data-testid="button-clear-conversation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Limpar conversa</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleMaximize}
              data-testid="button-toggle-maximize"
            >
              {isMaximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{isMaximized ? "Minimizar" : "Maximizar"}</p>
          </TooltipContent>
        </Tooltip>
        <Badge variant="outline" className="flex items-center gap-1 text-xs ml-1">
          <Sparkles className="h-3 w-3" />
          Auto
        </Badge>
      </div>
    </div>
  );

  const chatContent = (
    <>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-2" data-testid="text-empty-state">
              Olá! Como posso ajudar?
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
              Pergunte o que quiser - eu identifico automaticamente o melhor contexto para responder.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Pressione <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">Ctrl+G</kbd> para abrir/fechar
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[280px]">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-left justify-start h-auto py-2 px-3 text-xs"
                  onClick={() => handleSendMessage(suggestion)}
                  data-testid={`button-suggestion-${index}`}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`group flex gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                data-testid={`message-${message.role}-${message.id}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="w-3.5 h-3.5" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-code:bg-background/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-background/50 prose-pre:p-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] ${
                        message.role === "user"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </span>
                    {message.role === "assistant" && message.detectedContext && message.detectedContext !== "auto" && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 bg-background/50">
                        {CONTEXT_LABELS[message.detectedContext] || message.detectedContext}
                      </Badge>
                    )}
                    {message.role === "assistant" && (
                      <CopyButton text={message.content} />
                    )}
                  </div>
                </div>
              </div>
            ))}
            {sendMessageMutation.isPending && (
              <div className="flex gap-2" data-testid="loading-response">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={sendMessageMutation.isPending}
            className="flex-1"
            data-testid="input-message"
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || sendMessageMutation.isPending}
            size="icon"
            data-testid="button-send"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        data-testid="button-assistant-widget"
        style={{ position: 'fixed', bottom: '24px', right: '24px' }}
      >
        <Bot className="h-7 w-7" />
      </button>

      {isMaximized ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent
            className="max-w-3xl h-[90vh] flex flex-col p-0"
            data-testid="dialog-assistant"
            aria-describedby={undefined}
          >
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle asChild>
                {headerContent}
              </DialogTitle>
            </DialogHeader>
            {chatContent}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-md flex flex-col p-0"
            data-testid="sheet-assistant"
          >
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle asChild>
                {headerContent}
              </SheetTitle>
            </SheetHeader>
            {chatContent}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
