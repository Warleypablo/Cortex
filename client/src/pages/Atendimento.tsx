import { useState, useMemo } from "react";
import { Briefcase, Users, DollarSign, Send, Search, MessageCircle, Link2, Unlink, Building2, Phone, User, Layers, X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSetPageInfo } from "@/contexts/PageContext";

type Channel = "operacao" | "cxcs" | "financeiro";

interface Message {
  id: string;
  content: string;
  timestamp: string;
  senderName: string;
  senderPhone: string;
  isFromTeam: boolean;
}

interface LinkedClient {
  id: number;
  nome: string;
  cnpj: string;
  squad: string;
  responsavel: string;
  status: string;
}

interface WhatsAppGroup {
  id: string;
  whatsappGrupoNome: string;
  clienteId: number | null;
  clienteNome: string | null;
  clienteCnpj: string | null;
  squad: string | null;
  responsavel: string | null;
  lastMessage: string;
  lastMessageTimestamp: string;
  unreadCount: number;
  messages: Message[];
}

interface MockClient {
  id: number;
  nome: string;
  cnpj: string;
  squad: string;
  responsavel: string;
  status: string;
}

const mockClients: MockClient[] = [
  { id: 1, nome: "Libanesa Alimentos", cnpj: "01.621.976/0001-25", squad: "Alpha", responsavel: "Mariana Costa", status: "Ativo" },
  { id: 2, nome: "Scardua & Cia", cnpj: "12.345.678/0001-90", squad: "Beta", responsavel: "Lucas Ferreira", status: "Ativo" },
  { id: 3, nome: "TechFlow Solutions", cnpj: "98.765.432/0001-11", squad: "Alpha", responsavel: "Fernanda Lima", status: "Ativo" },
  { id: 4, nome: "Distribuidora Norte", cnpj: "55.444.333/0001-22", squad: "Gamma", responsavel: "Roberto Silva", status: "Ativo" },
  { id: 5, nome: "Construtora Horizonte", cnpj: "77.888.999/0001-33", squad: "Beta", responsavel: "Patricia Souza", status: "Pausado" },
  { id: 6, nome: "Farmácia Popular SP", cnpj: "11.222.333/0001-44", squad: "Alpha", responsavel: "Carlos Mendes", status: "Ativo" },
  { id: 7, nome: "Auto Peças Brasil", cnpj: "33.444.555/0001-66", squad: "Gamma", responsavel: "Ana Paula Reis", status: "Ativo" },
  { id: 8, nome: "Restaurante Sabor & Arte", cnpj: "22.111.000/0001-77", squad: "Beta", responsavel: "José Oliveira", status: "Ativo" },
];

const mockConversations: Record<Channel, WhatsAppGroup[]> = {
  operacao: [
    {
      id: "op1",
      whatsappGrupoNome: "Turbo | Libanesa Alimentos - Operação",
      clienteId: 1,
      clienteNome: "Libanesa Alimentos",
      clienteCnpj: "01.621.976/0001-25",
      squad: "Alpha",
      responsavel: "Mariana Costa",
      lastMessage: "Bom dia! Precisamos revisar a campanha de natal",
      lastMessageTimestamp: "10:45",
      unreadCount: 3,
      messages: [
        { id: "m1", content: "Bom dia pessoal!", timestamp: "10:30", senderName: "João - Libanesa", senderPhone: "+55 11 99999-1111", isFromTeam: false },
        { id: "m2", content: "Bom dia João! Como podemos ajudar?", timestamp: "10:32", senderName: "Mariana Costa", senderPhone: "+55 11 98888-0001", isFromTeam: true },
        { id: "m3", content: "Precisamos revisar a campanha de natal", timestamp: "10:35", senderName: "João - Libanesa", senderPhone: "+55 11 99999-1111", isFromTeam: false },
        { id: "m4", content: "Os resultados estão abaixo do esperado", timestamp: "10:38", senderName: "João - Libanesa", senderPhone: "+55 11 99999-1111", isFromTeam: false },
        { id: "m5", content: "Bom dia! Precisamos revisar a campanha de natal", timestamp: "10:45", senderName: "Maria - Libanesa", senderPhone: "+55 11 99999-1112", isFromTeam: false },
      ],
    },
    {
      id: "op2",
      whatsappGrupoNome: "Turbo | TechFlow Solutions - Operação",
      clienteId: 3,
      clienteNome: "TechFlow Solutions",
      clienteCnpj: "98.765.432/0001-11",
      squad: "Alpha",
      responsavel: "Fernanda Lima",
      lastMessage: "O relatório foi enviado por email",
      lastMessageTimestamp: "09:15",
      unreadCount: 0,
      messages: [
        { id: "m1", content: "Pessoal, quando sai o relatório mensal?", timestamp: "09:00", senderName: "Ricardo - TechFlow", senderPhone: "+55 11 97777-2222", isFromTeam: false },
        { id: "m2", content: "Bom dia Ricardo! Estamos finalizando, sai até 12h", timestamp: "09:05", senderName: "Fernanda Lima", senderPhone: "+55 11 98888-0002", isFromTeam: true },
        { id: "m3", content: "O relatório foi enviado por email", timestamp: "09:15", senderName: "Fernanda Lima", senderPhone: "+55 11 98888-0002", isFromTeam: true },
      ],
    },
    {
      id: "op3",
      whatsappGrupoNome: "Grupo WhatsApp - Cliente Novo",
      clienteId: null,
      clienteNome: null,
      clienteCnpj: null,
      squad: null,
      responsavel: null,
      lastMessage: "Olá, somos da empresa ABC e gostaríamos de saber mais",
      lastMessageTimestamp: "Ontem",
      unreadCount: 5,
      messages: [
        { id: "m1", content: "Olá, boa tarde!", timestamp: "16:30", senderName: "Pedro Santos", senderPhone: "+55 21 99999-3333", isFromTeam: false },
        { id: "m2", content: "Somos da empresa ABC e gostaríamos de saber mais sobre os serviços", timestamp: "16:32", senderName: "Pedro Santos", senderPhone: "+55 21 99999-3333", isFromTeam: false },
        { id: "m3", content: "Olá, somos da empresa ABC e gostaríamos de saber mais", timestamp: "16:35", senderName: "Carla Nunes", senderPhone: "+55 21 99999-4444", isFromTeam: false },
      ],
    },
    {
      id: "op4",
      whatsappGrupoNome: "Turbo | Auto Peças Brasil - Operação",
      clienteId: 7,
      clienteNome: "Auto Peças Brasil",
      clienteCnpj: "33.444.555/0001-66",
      squad: "Gamma",
      responsavel: "Ana Paula Reis",
      lastMessage: "Perfeito, obrigado pelo suporte!",
      lastMessageTimestamp: "08:30",
      unreadCount: 0,
      messages: [
        { id: "m1", content: "Bom dia! Tudo certo com as campanhas?", timestamp: "08:15", senderName: "Ana Paula Reis", senderPhone: "+55 11 98888-0007", isFromTeam: true },
        { id: "m2", content: "Sim, tudo rodando bem!", timestamp: "08:25", senderName: "Marcos - Auto Peças", senderPhone: "+55 11 94444-5555", isFromTeam: false },
        { id: "m3", content: "Perfeito, obrigado pelo suporte!", timestamp: "08:30", senderName: "Marcos - Auto Peças", senderPhone: "+55 11 94444-5555", isFromTeam: false },
      ],
    },
  ],
  cxcs: [
    {
      id: "cx1",
      whatsappGrupoNome: "Turbo | Scardua & Cia - CXCS",
      clienteId: 2,
      clienteNome: "Scardua & Cia",
      clienteCnpj: "12.345.678/0001-90",
      squad: "Beta",
      responsavel: "Lucas Ferreira",
      lastMessage: "Quando podemos agendar nossa reunião de alinhamento?",
      lastMessageTimestamp: "11:20",
      unreadCount: 2,
      messages: [
        { id: "m1", content: "Olá equipe Turbo!", timestamp: "11:00", senderName: "Amanda - Scardua", senderPhone: "+55 11 96666-7777", isFromTeam: false },
        { id: "m2", content: "Olá Amanda! Tudo bem?", timestamp: "11:05", senderName: "Lucas Ferreira", senderPhone: "+55 11 98888-0003", isFromTeam: true },
        { id: "m3", content: "Tudo sim! Quando podemos agendar nossa reunião de alinhamento?", timestamp: "11:20", senderName: "Amanda - Scardua", senderPhone: "+55 11 96666-7777", isFromTeam: false },
      ],
    },
    {
      id: "cx2",
      whatsappGrupoNome: "Turbo | Distribuidora Norte - CXCS",
      clienteId: 4,
      clienteNome: "Distribuidora Norte",
      clienteCnpj: "55.444.333/0001-22",
      squad: "Gamma",
      responsavel: "Roberto Silva",
      lastMessage: "Os materiais ficaram excelentes, parabéns!",
      lastMessageTimestamp: "10:00",
      unreadCount: 0,
      messages: [
        { id: "m1", content: "Equipe, os materiais foram entregues", timestamp: "09:45", senderName: "Roberto Silva", senderPhone: "+55 11 98888-0004", isFromTeam: true },
        { id: "m2", content: "Os materiais ficaram excelentes, parabéns!", timestamp: "10:00", senderName: "Carlos - Dist. Norte", senderPhone: "+55 11 93333-4444", isFromTeam: false },
      ],
    },
    {
      id: "cx3",
      whatsappGrupoNome: "Grupo Prospecção - Empresa XYZ",
      clienteId: null,
      clienteNome: null,
      clienteCnpj: null,
      squad: null,
      responsavel: null,
      lastMessage: "Gostaríamos de agendar uma apresentação",
      lastMessageTimestamp: "Ontem",
      unreadCount: 4,
      messages: [
        { id: "m1", content: "Boa tarde! Recebemos indicação da Turbo", timestamp: "15:00", senderName: "Felipe Andrade", senderPhone: "+55 31 99999-8888", isFromTeam: false },
        { id: "m2", content: "Gostaríamos de agendar uma apresentação", timestamp: "15:05", senderName: "Felipe Andrade", senderPhone: "+55 31 99999-8888", isFromTeam: false },
      ],
    },
    {
      id: "cx4",
      whatsappGrupoNome: "Turbo | Farmácia Popular SP - CXCS",
      clienteId: 6,
      clienteNome: "Farmácia Popular SP",
      clienteCnpj: "11.222.333/0001-44",
      squad: "Alpha",
      responsavel: "Carlos Mendes",
      lastMessage: "Confirmado! Até amanhã então",
      lastMessageTimestamp: "09:30",
      unreadCount: 0,
      messages: [
        { id: "m1", content: "Bom dia! Confirmamos a reunião para amanhã às 14h?", timestamp: "09:15", senderName: "Carlos Mendes", senderPhone: "+55 11 98888-0006", isFromTeam: true },
        { id: "m2", content: "Confirmado! Até amanhã então", timestamp: "09:30", senderName: "Dra. Helena - Farmácia", senderPhone: "+55 11 92222-3333", isFromTeam: false },
      ],
    },
  ],
  financeiro: [
    {
      id: "fin1",
      whatsappGrupoNome: "Turbo | Construtora Horizonte - Financeiro",
      clienteId: 5,
      clienteNome: "Construtora Horizonte",
      clienteCnpj: "77.888.999/0001-33",
      squad: "Beta",
      responsavel: "Patricia Souza",
      lastMessage: "O pagamento foi efetuado hoje pela manhã",
      lastMessageTimestamp: "11:50",
      unreadCount: 1,
      messages: [
        { id: "m1", content: "Bom dia! Segue o boleto atualizado referente ao mês de dezembro", timestamp: "11:30", senderName: "Equipe Financeiro Turbo", senderPhone: "+55 11 98888-9999", isFromTeam: true },
        { id: "m2", content: "O pagamento foi efetuado hoje pela manhã", timestamp: "11:50", senderName: "Sandra - Horizonte", senderPhone: "+55 11 91111-2222", isFromTeam: false },
      ],
    },
    {
      id: "fin2",
      whatsappGrupoNome: "Turbo | Restaurante Sabor & Arte - Financeiro",
      clienteId: 8,
      clienteNome: "Restaurante Sabor & Arte",
      clienteCnpj: "22.111.000/0001-77",
      squad: "Beta",
      responsavel: "José Oliveira",
      lastMessage: "A nota fiscal foi enviada para o email cadastrado",
      lastMessageTimestamp: "10:15",
      unreadCount: 0,
      messages: [
        { id: "m1", content: "Bom dia! Podem enviar a nota fiscal do último pagamento?", timestamp: "10:00", senderName: "Chef Antonio", senderPhone: "+55 11 95555-6666", isFromTeam: false },
        { id: "m2", content: "A nota fiscal foi enviada para o email cadastrado", timestamp: "10:15", senderName: "Equipe Financeiro Turbo", senderPhone: "+55 11 98888-9999", isFromTeam: true },
      ],
    },
    {
      id: "fin3",
      whatsappGrupoNome: "Financeiro - Empresa Pendente",
      clienteId: null,
      clienteNome: null,
      clienteCnpj: null,
      squad: null,
      responsavel: null,
      lastMessage: "Qual o CNPJ para emissão do contrato?",
      lastMessageTimestamp: "Ontem",
      unreadCount: 2,
      messages: [
        { id: "m1", content: "Olá! Fechamos o contrato e precisamos dos dados para faturamento", timestamp: "17:00", senderName: "Equipe Financeiro Turbo", senderPhone: "+55 11 98888-9999", isFromTeam: true },
        { id: "m2", content: "Qual o CNPJ para emissão do contrato?", timestamp: "17:15", senderName: "Equipe Financeiro Turbo", senderPhone: "+55 11 98888-9999", isFromTeam: true },
      ],
    },
    {
      id: "fin4",
      whatsappGrupoNome: "Turbo | Libanesa Alimentos - Financeiro",
      clienteId: 1,
      clienteNome: "Libanesa Alimentos",
      clienteCnpj: "01.621.976/0001-25",
      squad: "Alpha",
      responsavel: "Mariana Costa",
      lastMessage: "Perfeito, comprovante recebido!",
      lastMessageTimestamp: "08:45",
      unreadCount: 0,
      messages: [
        { id: "m1", content: "Bom dia! Segue comprovante de pagamento", timestamp: "08:30", senderName: "Financeiro Libanesa", senderPhone: "+55 11 99999-0000", isFromTeam: false },
        { id: "m2", content: "Perfeito, comprovante recebido!", timestamp: "08:45", senderName: "Equipe Financeiro Turbo", senderPhone: "+55 11 98888-9999", isFromTeam: true },
      ],
    },
  ],
};

const channelConfig: Record<Channel, { label: string; icon: typeof Briefcase; color: string; whatsappNumber: string }> = {
  operacao: { label: "Operação", icon: Briefcase, color: "text-blue-500", whatsappNumber: "+55 11 98888-0001" },
  cxcs: { label: "CXCS", icon: Users, color: "text-green-500", whatsappNumber: "+55 11 98888-0002" },
  financeiro: { label: "Financeiro", icon: DollarSign, color: "text-amber-500", whatsappNumber: "+55 11 98888-9999" },
};

export default function Atendimento() {
  useSetPageInfo("Atendimento", "Gestão de Grupos WhatsApp");
  
  const [activeChannel, setActiveChannel] = useState<Channel>("operacao");
  const [selectedGroup, setSelectedGroup] = useState<WhatsAppGroup | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [conversations, setConversations] = useState(mockConversations);

  const filteredConversations = useMemo(() => {
    return conversations[activeChannel].filter(
      (group) =>
        group.whatsappGrupoNome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (group.clienteNome && group.clienteNome.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (group.clienteCnpj && group.clienteCnpj.includes(searchQuery))
    );
  }, [conversations, activeChannel, searchQuery]);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return mockClients;
    return mockClients.filter(
      (client) =>
        client.nome.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
        client.cnpj.includes(clientSearchQuery)
    );
  }, [clientSearchQuery]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getTotalUnread = (channel: Channel) => {
    return conversations[channel].reduce((sum, group) => sum + group.unreadCount, 0);
  };

  const handleLinkClient = (client: MockClient) => {
    if (!selectedGroup) return;
    
    setConversations(prev => {
      const updated = { ...prev };
      const channelGroups = [...updated[activeChannel]];
      const groupIndex = channelGroups.findIndex(g => g.id === selectedGroup.id);
      
      if (groupIndex !== -1) {
        channelGroups[groupIndex] = {
          ...channelGroups[groupIndex],
          clienteId: client.id,
          clienteNome: client.nome,
          clienteCnpj: client.cnpj,
          squad: client.squad,
          responsavel: client.responsavel,
        };
        updated[activeChannel] = channelGroups;
        
        setSelectedGroup(channelGroups[groupIndex]);
      }
      
      return updated;
    });
    
    setLinkModalOpen(false);
    setClientSearchQuery("");
  };

  const handleUnlinkClient = () => {
    if (!selectedGroup) return;
    
    setConversations(prev => {
      const updated = { ...prev };
      const channelGroups = [...updated[activeChannel]];
      const groupIndex = channelGroups.findIndex(g => g.id === selectedGroup.id);
      
      if (groupIndex !== -1) {
        channelGroups[groupIndex] = {
          ...channelGroups[groupIndex],
          clienteId: null,
          clienteNome: null,
          clienteCnpj: null,
          squad: null,
          responsavel: null,
        };
        updated[activeChannel] = channelGroups;
        
        setSelectedGroup(channelGroups[groupIndex]);
      }
      
      return updated;
    });
  };

  const formatCnpj = (cnpj: string) => {
    if (cnpj.length <= 8) return cnpj;
    return cnpj.substring(0, 8) + "...";
  };

  return (
    <div className="p-4 h-[calc(100vh-4rem)]" data-testid="page-atendimento">
      <div className="flex h-full gap-0 rounded-lg border overflow-hidden">
        <div className="w-[350px] border-r flex flex-col bg-card" data-testid="panel-conversations">
          <Tabs value={activeChannel} onValueChange={(v) => { setActiveChannel(v as Channel); setSelectedGroup(null); }} className="flex flex-col h-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto" data-testid="tabs-channels">
              {(Object.keys(channelConfig) as Channel[]).map((channel) => {
                const config = channelConfig[channel];
                const unread = getTotalUnread(channel);
                return (
                  <TabsTrigger
                    key={channel}
                    value={channel}
                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-2 gap-1"
                    data-testid={`tab-${channel}`}
                  >
                    <config.icon className={`w-4 h-4 ${config.color}`} />
                    <span className="text-xs font-medium">{config.label}</span>
                    {unread > 0 && (
                      <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center">
                        {unread}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Phone className="w-3 h-3" />
                <span data-testid="text-channel-phone">{channelConfig[activeChannel].whatsappNumber}</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar grupo ou cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                  data-testid="input-search-conversations"
                />
              </div>
            </div>

            {(Object.keys(channelConfig) as Channel[]).map((channel) => (
              <TabsContent key={channel} value={channel} className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="divide-y">
                    {filteredConversations.map((group) => (
                      <div
                        key={group.id}
                        className={`p-3 hover-elevate cursor-pointer ${
                          selectedGroup?.id === group.id ? "bg-accent" : ""
                        }`}
                        onClick={() => setSelectedGroup(group)}
                        data-testid={`conversation-${group.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {group.clienteNome ? getInitials(group.clienteNome) : "??"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm truncate" data-testid={`text-group-name-${group.id}`}>
                                {group.whatsappGrupoNome}
                              </span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                {group.lastMessageTimestamp}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {group.clienteId ? (
                                <>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                    {group.clienteNome}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                    {formatCnpj(group.clienteCnpj || "")}
                                  </Badge>
                                </>
                              ) : (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-500 border-amber-500/50">
                                  Sem vínculo
                                </Badge>
                              )}
                            </div>
                            
                            {group.squad && group.responsavel && (
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-0.5">
                                  <Layers className="w-2.5 h-2.5" />
                                  {group.squad}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <User className="w-2.5 h-2.5" />
                                  {group.responsavel}
                                </span>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <p className="text-xs text-muted-foreground truncate">
                                {group.lastMessage}
                              </p>
                              {group.unreadCount > 0 && (
                                <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs flex items-center justify-center shrink-0" data-testid={`badge-unread-${group.id}`}>
                                  {group.unreadCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredConversations.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum grupo encontrado</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="flex-1 flex flex-col bg-background" data-testid="panel-chat">
          {selectedGroup ? (
            <>
              <div className="p-4 border-b bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-lg truncate" data-testid="text-chat-group-name">
                      {selectedGroup.whatsappGrupoNome}
                    </h2>
                    
                    {selectedGroup.clienteId ? (
                      <Card className="mt-3 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {getInitials(selectedGroup.clienteNome || "")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium" data-testid="text-client-name">
                                  {selectedGroup.clienteNome}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {selectedGroup.clienteCnpj}
                                </Badge>
                                <Badge variant="outline" className="text-xs text-green-600 border-green-600/50">
                                  Ativo
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  Squad: {selectedGroup.squad}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {selectedGroup.responsavel}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleUnlinkClient}
                            className="text-muted-foreground shrink-0"
                            data-testid="button-unlink-client"
                          >
                            <Unlink className="w-4 h-4 mr-1" />
                            Desvincular
                          </Button>
                        </div>
                      </Card>
                    ) : (
                      <div className="mt-3 p-4 border border-dashed rounded-lg bg-muted/30 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="w-5 h-5" />
                          <span className="text-sm">Nenhum cliente vinculado a este grupo</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLinkModalOpen(true)}
                          data-testid="button-link-client"
                        >
                          <Link2 className="w-4 h-4 mr-1" />
                          Vincular Cliente
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4 bg-muted/20">
                <div className="space-y-3 max-w-3xl mx-auto">
                  {selectedGroup.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isFromTeam ? "justify-end" : "justify-start"}`}
                      data-testid={`message-${message.id}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 ${
                          message.isFromTeam
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card border rounded-bl-sm"
                        }`}
                      >
                        <div className={`text-xs font-medium mb-1 ${message.isFromTeam ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {message.senderName}
                          <span className="font-normal ml-2">{message.senderPhone}</span>
                        </div>
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-[10px] mt-1 text-right ${message.isFromTeam ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {message.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-card">
                <div className="flex gap-2 items-center">
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
                  <Badge variant="outline" className="text-amber-500 border-amber-500 shrink-0">
                    Em Breve
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2" data-testid="text-integration-pending">
                  Integração com WhatsApp em desenvolvimento
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground" data-testid="placeholder-no-conversation">
              <MessageCircle className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Selecione um grupo</p>
              <p className="text-sm">Escolha um grupo WhatsApp na lista para visualizar as mensagens</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="max-w-lg" data-testid="modal-link-client">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Vincular Cliente
            </DialogTitle>
            <DialogDescription>
              Selecione um cliente para vincular a este grupo WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-clients"
              />
            </div>
            
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="divide-y">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="p-3 hover-elevate cursor-pointer flex items-center justify-between"
                    onClick={() => handleLinkClient(client)}
                    data-testid={`client-option-${client.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(client.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{client.nome}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {client.cnpj}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            {client.squad}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {client.responsavel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0">
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {filteredClients.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum cliente encontrado</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
