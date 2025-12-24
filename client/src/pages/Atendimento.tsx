import { useState } from "react";
import { Briefcase, Users, DollarSign, Send, Phone, MoreVertical, Search, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSetPageInfo } from "@/contexts/PageContext";

type Channel = "operacao" | "cxcs" | "financeiro";

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isFromClient: boolean;
}

interface Conversation {
  id: string;
  clientName: string;
  clientPhone: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  messages: Message[];
}

const mockConversations: Record<Channel, Conversation[]> = {
  operacao: [
    {
      id: "op1",
      clientName: "João Silva",
      clientPhone: "+55 11 99999-1111",
      lastMessage: "Preciso de ajuda com minha campanha",
      timestamp: "10:30",
      unreadCount: 2,
      messages: [
        { id: "m1", content: "Olá, bom dia!", timestamp: "10:25", isFromClient: true },
        { id: "m2", content: "Bom dia João! Como posso ajudar?", timestamp: "10:26", isFromClient: false },
        { id: "m3", content: "Preciso de ajuda com minha campanha", timestamp: "10:30", isFromClient: true },
      ],
    },
    {
      id: "op2",
      clientName: "Maria Santos",
      clientPhone: "+55 11 99999-2222",
      lastMessage: "Qual o status do meu relatório?",
      timestamp: "09:45",
      unreadCount: 0,
      messages: [
        { id: "m1", content: "Boa tarde! Qual o status do meu relatório?", timestamp: "09:45", isFromClient: true },
      ],
    },
    {
      id: "op3",
      clientName: "Pedro Oliveira",
      clientPhone: "+55 11 99999-3333",
      lastMessage: "Obrigado pelo atendimento!",
      timestamp: "Ontem",
      unreadCount: 0,
      messages: [
        { id: "m1", content: "Muito obrigado pelo atendimento!", timestamp: "18:30", isFromClient: true },
        { id: "m2", content: "Disponha! Qualquer coisa estamos aqui.", timestamp: "18:32", isFromClient: false },
      ],
    },
  ],
  cxcs: [
    {
      id: "cx1",
      clientName: "Ana Rodrigues",
      clientPhone: "+55 11 99999-4444",
      lastMessage: "Quando posso agendar nossa reunião?",
      timestamp: "11:15",
      unreadCount: 1,
      messages: [
        { id: "m1", content: "Olá! Quando posso agendar nossa reunião?", timestamp: "11:15", isFromClient: true },
      ],
    },
    {
      id: "cx2",
      clientName: "Carlos Mendes",
      clientPhone: "+55 11 99999-5555",
      lastMessage: "Recebi os materiais, obrigado",
      timestamp: "10:00",
      unreadCount: 0,
      messages: [
        { id: "m1", content: "Os materiais foram enviados por email", timestamp: "09:55", isFromClient: false },
        { id: "m2", content: "Recebi os materiais, obrigado", timestamp: "10:00", isFromClient: true },
      ],
    },
    {
      id: "cx3",
      clientName: "Lucia Ferreira",
      clientPhone: "+55 11 99999-6666",
      lastMessage: "Preciso remarcar nosso call",
      timestamp: "Ontem",
      unreadCount: 3,
      messages: [
        { id: "m1", content: "Oi, tudo bem? Preciso remarcar nosso call", timestamp: "16:20", isFromClient: true },
        { id: "m2", content: "Pode ser amanhã às 14h?", timestamp: "16:21", isFromClient: true },
        { id: "m3", content: "Me avise quando puder", timestamp: "16:25", isFromClient: true },
      ],
    },
  ],
  financeiro: [
    {
      id: "fin1",
      clientName: "Roberto Costa",
      clientPhone: "+55 11 99999-7777",
      lastMessage: "Já efetuei o pagamento",
      timestamp: "11:45",
      unreadCount: 1,
      messages: [
        { id: "m1", content: "Bom dia! Segue o boleto atualizado", timestamp: "11:30", isFromClient: false },
        { id: "m2", content: "Já efetuei o pagamento", timestamp: "11:45", isFromClient: true },
      ],
    },
    {
      id: "fin2",
      clientName: "Fernanda Lima",
      clientPhone: "+55 11 99999-8888",
      lastMessage: "Pode enviar a nota fiscal?",
      timestamp: "09:30",
      unreadCount: 0,
      messages: [
        { id: "m1", content: "Pode enviar a nota fiscal?", timestamp: "09:30", isFromClient: true },
        { id: "m2", content: "Claro! Enviando agora por email", timestamp: "09:35", isFromClient: false },
      ],
    },
    {
      id: "fin3",
      clientName: "Marcos Almeida",
      clientPhone: "+55 11 99999-9999",
      lastMessage: "Qual a data de vencimento?",
      timestamp: "Ontem",
      unreadCount: 2,
      messages: [
        { id: "m1", content: "Olá! Qual a data de vencimento da próxima fatura?", timestamp: "15:00", isFromClient: true },
        { id: "m2", content: "E posso parcelar?", timestamp: "15:05", isFromClient: true },
      ],
    },
  ],
};

const channelConfig = {
  operacao: { label: "Operação", icon: Briefcase, color: "text-blue-500" },
  cxcs: { label: "CXCS", icon: Users, color: "text-green-500" },
  financeiro: { label: "Financeiro", icon: DollarSign, color: "text-yellow-500" },
};

export default function Atendimento() {
  useSetPageInfo("Atendimento", "Central de atendimento via WhatsApp");
  
  const [activeChannel, setActiveChannel] = useState<Channel>("operacao");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = mockConversations[activeChannel].filter(
    (conv) =>
      conv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.clientPhone.includes(searchQuery)
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getTotalUnread = (channel: Channel) => {
    return mockConversations[channel].reduce((sum, conv) => sum + conv.unreadCount, 0);
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)]" data-testid="page-atendimento">
      <Card className="h-full border-2 border-dashed" data-testid="card-atendimento-container">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle data-testid="text-atendimento-title">Atendimento</CardTitle>
                <p className="text-sm text-muted-foreground" data-testid="text-atendimento-subtitle">
                  Central de atendimento via WhatsApp
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-amber-500 border-amber-500" data-testid="badge-coming-soon">
              Em Breve
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100%-5rem)]">
          <div className="flex h-full gap-4 rounded-lg border bg-muted/30">
            <div className="w-80 border-r flex flex-col" data-testid="panel-conversations">
              <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as Channel)} className="flex flex-col h-full">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0" data-testid="tabs-channels">
                  {(Object.keys(channelConfig) as Channel[]).map((channel) => {
                    const config = channelConfig[channel];
                    const unread = getTotalUnread(channel);
                    return (
                      <TabsTrigger
                        key={channel}
                        value={channel}
                        className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
                        data-testid={`tab-${channel}`}
                      >
                        <config.icon className={`w-4 h-4 mr-1 ${config.color}`} />
                        <span className="text-xs">{config.label}</span>
                        {unread > 0 && (
                          <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                            {unread}
                          </Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar conversa..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-conversations"
                    />
                  </div>
                </div>

                {(Object.keys(channelConfig) as Channel[]).map((channel) => (
                  <TabsContent key={channel} value={channel} className="flex-1 m-0 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="divide-y">
                        {filteredConversations.map((conversation) => (
                          <div
                            key={conversation.id}
                            className={`p-3 hover-elevate cursor-pointer ${
                              selectedConversation?.id === conversation.id ? "bg-accent" : ""
                            }`}
                            onClick={() => setSelectedConversation(conversation)}
                            data-testid={`conversation-${conversation.id}`}
                          >
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {getInitials(conversation.clientName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-sm truncate" data-testid={`text-client-name-${conversation.id}`}>
                                    {conversation.clientName}
                                  </span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {conversation.timestamp}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <p className="text-xs text-muted-foreground truncate">
                                    {conversation.lastMessage}
                                  </p>
                                  {conversation.unreadCount > 0 && (
                                    <Badge variant="destructive" className="h-5 w-5 p-0 text-xs flex items-center justify-center" data-testid={`badge-unread-${conversation.id}`}>
                                      {conversation.unreadCount}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <div className="flex-1 flex flex-col" data-testid="panel-chat">
              {selectedConversation ? (
                <>
                  <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(selectedConversation.clientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium" data-testid="text-chat-client-name">{selectedConversation.clientName}</p>
                        <p className="text-xs text-muted-foreground" data-testid="text-chat-client-phone">{selectedConversation.clientPhone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" data-testid="button-call">
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" data-testid="button-more">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {selectedConversation.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.isFromClient ? "justify-start" : "justify-end"}`}
                          data-testid={`message-${message.id}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              message.isFromClient
                                ? "bg-muted"
                                : "bg-primary text-primary-foreground"
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <p className={`text-xs mt-1 ${message.isFromClient ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                              {message.timestamp}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite sua mensagem..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        className="flex-1"
                        disabled
                        data-testid="input-message"
                      />
                      <Button disabled data-testid="button-send">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2" data-testid="text-integration-pending">
                      Integração com WhatsApp em desenvolvimento
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground" data-testid="placeholder-no-conversation">
                  <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">Selecione uma conversa</p>
                  <p className="text-sm">Escolha uma conversa na lista para visualizar as mensagens</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
