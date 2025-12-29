import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  ArrowUp, 
  ChevronDown, 
  Check, 
  Loader2,
  User,
  Bot
} from "lucide-react";
import logoWhite from "@assets/logo-branca_1766805588623.png";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Model {
  id: string;
  name: string;
  description: string;
}

const ThinkingIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 9.72386 2.72386 9.5 3 9.5C3.27614 9.5 3.5 9.72386 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977ZM10 5.5C10.2761 5.5 10.5 5.72386 10.5 6V9.69043L13.2236 11.0527C13.4706 11.1762 13.5708 11.4766 13.4473 11.7236C13.3392 11.9397 13.0957 12.0435 12.8711 11.9834L12.7764 11.9473L9.77637 10.4473C9.60698 10.3626 9.5 10.1894 9.5 10V6C9.5 5.72386 9.72386 5.5 10 5.5ZM3.66211 6.94141C4.0273 6.94159 4.32303 7.23735 4.32324 7.60254C4.32324 7.96791 4.02743 8.26446 3.66211 8.26465C3.29663 8.26465 3 7.96802 3 7.60254C3.00021 7.23723 3.29676 6.94141 3.66211 6.94141ZM4.95605 4.29395C5.32146 4.29404 5.61719 4.59063 5.61719 4.95605C5.6171 5.3214 5.3214 5.61709 4.95605 5.61719C4.59063 5.61719 4.29403 5.32146 4.29395 4.95605C4.29395 4.59057 4.59057 4.29395 4.95605 4.29395ZM7.60254 3C7.96802 3 8.26465 3.29663 8.26465 3.66211C8.26446 4.02743 7.96791 4.32324 7.60254 4.32324C7.23736 4.32302 6.94159 4.0273 6.94141 3.66211C6.94141 3.29676 7.23724 3.00022 7.60254 3Z" />
  </svg>
);

const ModelSelector = ({ 
  models, 
  selectedModel, 
  onSelect 
}: { 
  models: Model[]; 
  selectedModel: string; 
  onSelect: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentModel = models.find(m => m.id === selectedModel) || models[0];

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
        className={`inline-flex items-center justify-center h-8 rounded-xl px-3 gap-1 transition-all duration-200 active:scale-[0.98] text-xs font-medium
          ${isOpen 
            ? 'bg-muted text-foreground' 
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
        data-testid="button-model-selector"
      >
        <span className="whitespace-nowrap">{currentModel.name}</span>
        <ChevronDown className={`w-4 h-4 opacity-75 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-[260px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 p-1.5"
          >
            {models.map(model => (
              <button
                key={model.id}
                onClick={() => {
                  onSelect(model.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl flex items-start justify-between transition-colors hover:bg-muted/50"
                data-testid={`button-model-${model.id}`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-foreground">{model.name}</span>
                  <span className="text-[11px] text-muted-foreground">{model.description}</span>
                </div>
                {selectedModel === model.id && (
                  <Check className="w-4 h-4 text-primary mt-1" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function CasesChat() {
  usePageTitle("Cases Chat");
  useSetPageInfo("GPTurbo");
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4-turbo");
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const models: Model[] = [
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Mais avançado para análises complexas" },
    { id: "gpt-4", name: "GPT-4", description: "Ideal para tarefas do dia a dia" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5", description: "Mais rápido para respostas simples" }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [inputValue]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/cases/chat", { message });
      return response.json();
    },
    onSuccess: (data) => {
      let content = "Sem resposta do servidor.";
      
      if (Array.isArray(data) && data.length > 0) {
        content = data[0].output || data[0].response || data[0].message || data[0].text || content;
      } else if (data.output) {
        content = data.output;
      } else if (data.response) {
        content = data.response;
      } else if (data.message) {
        content = data.message;
      }
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content,
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

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || sendMessageMutation.isPending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMessageMutation.mutate(inputValue.trim());
    setInputValue("");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputValue, sendMessageMutation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  const hasContent = inputValue.trim().length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-background" data-testid="cases-chat-page">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4">
          <AnimatePresence mode="wait">
            {messages.length === 0 ? (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center min-h-[60vh] text-center py-16"
              >
                <motion.div 
                  className="mb-8"
                  animate={{ 
                    scale: [1, 1.02, 1],
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <img 
                    src={logoWhite} 
                    alt="GPTurbo Logo" 
                    className="w-24 h-24 object-contain opacity-90 dark:opacity-90"
                    data-testid="img-logo"
                  />
                </motion.div>
                <h1 className="text-3xl font-bold text-foreground mb-3" data-testid="text-welcome-title">
                  GPTurbo
                </h1>
                <p className="text-muted-foreground max-w-md text-base leading-relaxed" data-testid="text-welcome-description">
                  Analisa cases de sucesso, fornece insights sobre seus dados, clientes, contratos e estratégias utilizadas.
                </p>
                
                <div className="flex flex-wrap justify-center gap-2 mt-8 max-w-lg">
                  {[
                    "Como foi o case da empresa X?",
                    "Quais estratégias funcionaram melhor?",
                    "Analise o contrato do cliente Y",
                    "Resumo de resultados do trimestre"
                  ].map((suggestion, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      onClick={() => setInputValue(suggestion)}
                      className="px-4 py-2 text-sm text-muted-foreground bg-card/60 border border-border/50 rounded-xl hover:bg-muted/60 hover:border-border transition-all duration-200"
                      data-testid={`button-suggestion-${idx}`}
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="messages"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-6 space-y-6"
              >
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index === messages.length - 1 ? 0.1 : 0 }}
                    className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                    data-testid={`message-${message.role}-${message.id}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User className="w-5 h-5" />
                      ) : (
                        <Bot className="w-5 h-5" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border border-border/50"
                      }`}
                    >
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      <span
                        className={`text-xs mt-2 block ${
                          message.role === "user"
                            ? "opacity-70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </motion.div>
                ))}
                
                {sendMessageMutation.isPending && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4"
                    data-testid="loading-response"
                  >
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="bg-card border border-border/50 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Pensando...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-6">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
          >
            <div className={`
              flex flex-col rounded-2xl transition-all duration-200
              bg-card border border-border/50
              shadow-lg
              hover:shadow-xl
              focus-within:shadow-xl
              focus-within:border-border
            `}>
              <div className="px-4 pt-4 pb-2">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Como posso ajudar você hoje?"
                  disabled={sendMessageMutation.isPending}
                  className="w-full bg-transparent border-0 outline-none text-foreground text-[16px] placeholder:text-muted-foreground resize-none overflow-hidden leading-relaxed min-h-[1.5em] max-h-[200px]"
                  rows={1}
                  data-testid="input-message"
                />
              </div>

              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    data-testid="input-file"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors active:scale-95"
                    type="button"
                    data-testid="button-attach"
                  >
                    <Plus className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all active:scale-95 ${
                      isThinkingEnabled
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                    type="button"
                    data-testid="button-thinking"
                    title="Pensamento estendido"
                  >
                    <ThinkingIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <ModelSelector
                    models={models}
                    selectedModel={selectedModel}
                    onSelect={setSelectedModel}
                  />

                  <button
                    onClick={handleSendMessage}
                    disabled={!hasContent || sendMessageMutation.isPending}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all active:scale-95 ${
                      hasContent && !sendMessageMutation.isPending
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                    type="button"
                    data-testid="button-send"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUp className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-3">
              GPTurbo pode cometer erros. Verifique informações importantes.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
