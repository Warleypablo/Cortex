import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Send, Bot, User, Loader2, X } from "lucide-react";
import type { AssistantContext } from "@shared/schema";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const CONTEXT_OPTIONS: { value: AssistantContext; label: string }[] = [
  { value: "geral", label: "Geral" },
  { value: "financeiro", label: "Financeiro" },
  { value: "cases", label: "Cases" },
  { value: "clientes", label: "Clientes" },
];

const SUGGESTIONS: Record<AssistantContext, string[]> = {
  geral: [
    "O que é a Turbo Partners?",
    "Quais serviços a agência oferece?",
    "Como funciona o Turbo Cortex?",
  ],
  financeiro: [
    "Qual foi o resultado do último mês?",
    "Quais são as principais despesas?",
    "Como está a margem de lucro?",
  ],
  cases: [
    "Quais foram os melhores cases?",
    "Me conte sobre um case de sucesso",
    "Quais estratégias funcionam melhor?",
  ],
  clientes: [
    "Quantos clientes ativos temos?",
    "Qual o perfil dos nossos clientes?",
    "Como está a retenção de clientes?",
  ],
};

function getInitialContextFromPath(path: string): AssistantContext {
  if (path.includes("financeiro") || path.includes("dfc") || path.includes("fluxo-caixa") || path.includes("inadimplencia")) {
    return "financeiro";
  }
  if (path.includes("cases")) {
    return "cases";
  }
  if (path.includes("cliente") || path.includes("contrato")) {
    return "clientes";
  }
  return "geral";
}

export function AssistantWidget() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [context, setContext] = useState<AssistantContext>(() => getInitialContextFromPath(location));
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setContext(getInitialContextFromPath(location));
    }
  }, [location, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        context,
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

  // Don't show on login or presentation mode
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

  const handleContextChange = (value: AssistantContext) => {
    setContext(value);
    setMessages([]);
  };

  return (
    <>
      <Button
        size="icon"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
        data-testid="button-assistant-widget"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0"
        data-testid="sheet-assistant"
      >
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5 text-primary" />
              GPTurbo
            </SheetTitle>
            <Select value={context} onValueChange={handleContextChange}>
              <SelectTrigger className="w-32" data-testid="select-context">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTEXT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

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
                Selecione um contexto e faça sua pergunta, ou escolha uma sugestão abaixo.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-[280px]">
                {SUGGESTIONS[context].map((suggestion, index) => (
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
                  className={`flex gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
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
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <span
                      className={`text-[10px] mt-1 block ${
                        message.role === "user"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              {sendMessageMutation.isPending && (
                <div className="flex gap-2" data-testid="loading-response">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
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
      </SheetContent>
      </Sheet>
    </>
  );
}
