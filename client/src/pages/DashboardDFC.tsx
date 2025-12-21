import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSetPageInfo } from "@/contexts/PageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Loader2, TrendingUp, TrendingDown, DollarSign, Calendar, ChevronRight, ChevronDown,
  Wallet, ArrowUpCircle, ArrowDownCircle, BarChart3, Receipt,
  CircleDollarSign, LineChart, Target, Activity, Percent,
  Sparkles, BrainCircuit, Send, MessageCircle, Bot, User, Minus, LayoutGrid, Table2,
  RotateCcw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, ComposedChart, Line, Cell, ReferenceLine
} from "recharts";
import type { DfcHierarchicalResponse, DfcNode, DfcParcela } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface DfcChatResponse {
  resposta: string;
  dadosReferenciados?: {
    categorias?: string[];
    meses?: string[];
    valores?: string[];
  };
}

type VisibleItem = 
  | { type: 'node'; node: DfcNode }
  | { type: 'parcela'; parcela: DfcParcela; parentNode: DfcNode };

export default function DashboardDFC() {
  useSetPageInfo("DFC - Demonstração de Fluxo de Caixa", "Análise hierárquica de receitas e despesas");
  
  const [filterDataInicio, setFilterDataInicio] = useState<string>("2025-01-01");
  const [filterDataFim, setFilterDataFim] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['RECEITAS', 'DESPESAS']));
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const { toast } = useToast();

  const chatMutation = useMutation({
    mutationFn: async ({ pergunta, currentHistory }: { pergunta: string; currentHistory: ChatMessage[] }) => {
      const historico = currentHistory.map(m => ({ role: m.role, content: m.content }));
      const response = await apiRequest("POST", "/api/dfc/chat", {
        pergunta,
        historico,
        dataInicio: filterDataInicio || undefined,
        dataFim: filterDataFim || undefined,
      });
      return response.json();
    },
    onSuccess: (data: DfcChatResponse) => {
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: data.resposta,
        timestamp: new Date()
      }]);
    },
    onError: () => {
      toast({
        title: "Erro ao processar",
        description: "Não foi possível processar sua pergunta. Por favor, tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!chatInput.trim() || chatMutation.isPending) return;
    
    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date()
    };
    
    const updatedHistory = [...chatMessages, userMessage];
    setChatMessages(updatedHistory);
    chatMutation.mutate({ pergunta: chatInput.trim(), currentHistory: updatedHistory });
    setChatInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedQuestions = [
    "Qual foi o mês com melhor resultado?",
    "Quais categorias tiveram maior crescimento?",
    "Explique as principais despesas do período",
    "Compare receitas e despesas dos últimos meses",
  ];

  const { data: dfcData, isLoading } = useQuery<DfcHierarchicalResponse>({
    queryKey: ["/api/dfc", filterDataInicio, filterDataFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterDataInicio) params.append("dataInicio", filterDataInicio);
      if (filterDataFim) params.append("dataFim", filterDataFim);
      
      const res = await fetch(`/api/dfc?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch DFC data");
      return res.json();
    },
  });

  const toggleExpand = (nodeId: string) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const visibleItems = useMemo(() => {
    if (!dfcData || !dfcData.nodes || dfcData.nodes.length === 0 || !dfcData.rootIds) return [];

    const nodeMap = new Map(dfcData.nodes.map(n => [n.categoriaId, n]));
    const result: VisibleItem[] = [];

    const addNode = (id: string) => {
      const node = nodeMap.get(id);
      if (!node) return;
      
      result.push({ type: 'node', node });
      
      if (expanded.has(id)) {
        if (node.children && node.children.length > 0) {
          node.children.forEach(childId => addNode(childId));
        } else if (node.isLeaf && node.parcelas && node.parcelas.length > 0) {
          node.parcelas.forEach(parcela => {
            result.push({ type: 'parcela', parcela, parentNode: node });
          });
        }
      }
    };

    dfcData.rootIds.forEach(id => addNode(id));
    return result;
  }, [dfcData, expanded]);

  const kpis = useMemo(() => {
    if (!dfcData || !dfcData.nodes || dfcData.nodes.length === 0) {
      return {
        totalCategorias: 0,
        totalMeses: 0,
        totalReceitas: 0,
        totalDespesas: 0,
        saldoLiquido: 0,
        margemMedia: 0,
      };
    }

    const totalCategorias = dfcData.nodes.filter(n => n.isLeaf).length;
    const totalMeses = dfcData.meses.length;
    
    const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
    const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');
    
    let totalReceitas = 0;
    let totalDespesas = 0;
    
    dfcData.meses.forEach(mes => {
      totalReceitas += (receitasNode?.valuesByMonth[mes] || 0);
      totalDespesas += Math.abs(despesasNode?.valuesByMonth[mes] || 0);
    });

    const saldoLiquido = totalReceitas - totalDespesas;
    const margemMedia = totalReceitas > 0 ? (saldoLiquido / totalReceitas) * 100 : 0;

    return { 
      totalCategorias, 
      totalMeses, 
      totalReceitas,
      totalDespesas,
      saldoLiquido,
      margemMedia,
    };
  }, [dfcData]);

  const resultadoByMonth = useMemo(() => {
    if (!dfcData || !dfcData.nodes || dfcData.nodes.length === 0) return {};
    
    const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
    const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');
    
    const resultado: Record<string, number> = {};
    dfcData.meses.forEach(mes => {
      const receita = receitasNode?.valuesByMonth[mes] || 0;
      const despesa = Math.abs(despesasNode?.valuesByMonth[mes] || 0);
      resultado[mes] = receita - despesa;
    });
    
    return resultado;
  }, [dfcData]);

  const margemByMonth = useMemo(() => {
    if (!dfcData || !dfcData.nodes || dfcData.nodes.length === 0) return {};
    
    const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
    const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');
    
    const margem: Record<string, number> = {};
    dfcData.meses.forEach(mes => {
      const receita = receitasNode?.valuesByMonth[mes] || 0;
      const despesa = Math.abs(despesasNode?.valuesByMonth[mes] || 0);
      const resultado = receita - despesa;
      
      if (receita > 0) {
        margem[mes] = (resultado / receita) * 100;
      } else {
        margem[mes] = 0;
      }
    });
    
    return margem;
  }, [dfcData]);

  const chartData = useMemo(() => {
    if (!dfcData || !dfcData.nodes || dfcData.nodes.length === 0) return [];
    
    const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
    const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');
    
    return dfcData.meses.map(mes => {
      const [ano, mesNum] = mes.split('-');
      const data = new Date(parseInt(ano), parseInt(mesNum) - 1);
      const mesLabel = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      const receitas = receitasNode?.valuesByMonth[mes] || 0;
      const despesas = Math.abs(despesasNode?.valuesByMonth[mes] || 0);
      const saldo = receitas - despesas;
      const margem = receitas > 0 ? ((saldo / receitas) * 100) : 0;
      
      return {
        mes: mesLabel,
        mesKey: mes,
        receitas,
        despesas,
        saldo,
        margem,
      };
    });
  }, [dfcData]);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyCompact = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return `R$ ${value.toFixed(0)}`;
  };

  const isReceita = (categoriaId: string) => {
    if (categoriaId === 'RECEITAS') return true;
    const twoDigitPrefix = categoriaId.substring(0, 2);
    return twoDigitPrefix === '03' || twoDigitPrefix === '04';
  };

  const getMaxValue = () => {
    if (!dfcData?.nodes) return 0;
    let max = 0;
    dfcData.nodes.forEach(node => {
      if (node.isLeaf) {
        dfcData.meses.forEach(mes => {
          const val = Math.abs(node.valuesByMonth[mes] || 0);
          if (val > max) max = val;
        });
      }
    });
    return max;
  };

  const maxValue = useMemo(() => getMaxValue(), [dfcData]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1" data-testid="toggle-view-mode">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-8"
                data-testid="button-view-table"
              >
                <Table2 className="w-4 h-4 mr-1" />
                Tabela
              </Button>
              <Button
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("cards")}
                className="h-8"
                data-testid="button-view-cards"
              >
                <LayoutGrid className="w-4 h-4 mr-1" />
                Cards
              </Button>
            </div>
            <Button
              onClick={() => setChatOpen(true)}
              disabled={isLoading || !dfcData?.nodes?.length}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25"
              data-testid="button-chat-ia"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Assistente IA
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-2xl h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <BrainCircuit className="w-5 h-5 text-violet-600" />
              </div>
              Assistente DFC
            </DialogTitle>
            <DialogDescription>
              Faça perguntas sobre o fluxo de caixa ({filterDataInicio || "início"} até {filterDataFim || "hoje"})
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="p-4 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-4">
                  <Bot className="w-10 h-10 text-violet-600" />
                </div>
                <h3 className="text-lg font-medium mb-2">Como posso ajudar?</h3>
                <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                  Pergunte sobre receitas, despesas, tendências ou qualquer aspecto do seu fluxo de caixa.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {suggestedQuestions.map((question, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2 px-3 text-xs"
                      onClick={() => {
                        setChatInput(question);
                      }}
                      data-testid={`button-suggestion-${idx}`}
                    >
                      <Sparkles className="w-3 h-3 mr-2 flex-shrink-0 text-violet-500" />
                      <span className="line-clamp-2">{question}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-violet-600" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-violet-600 text-white"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.role === "user" ? "text-violet-200" : "text-muted-foreground"}`}>
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                        <span className="text-sm text-muted-foreground">Analisando...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="px-6 py-4 border-t bg-background">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Digite sua pergunta sobre o DFC..."
                className="flex-1"
                disabled={chatMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || chatMutation.isPending}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                data-testid="button-send-message"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 bg-muted/30">
        <div className="max-w-[1800px] mx-auto space-y-6">
          
          {/* KPI Cards - Modern Design */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Entradas */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 overflow-hidden">
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Entradas</span>
                      <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                      {formatCurrencyCompact(kpis.totalReceitas)}
                    </p>
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                      Total no período
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Saídas */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/40 dark:to-rose-900/20 overflow-hidden">
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Saídas</span>
                      <ArrowDownCircle className="w-4 h-4 text-rose-500" />
                    </div>
                    <p className="text-xl font-bold text-rose-700 dark:text-rose-300">
                      {formatCurrencyCompact(kpis.totalDespesas)}
                    </p>
                    <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">
                      Total no período
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Saldo */}
            <Card className={`border-0 shadow-sm overflow-hidden ${
              kpis.saldoLiquido >= 0 
                ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20'
                : 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/40 dark:to-orange-900/20'
            }`}>
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium ${kpis.saldoLiquido >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        Saldo
                      </span>
                      <Wallet className={`w-4 h-4 ${kpis.saldoLiquido >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
                    </div>
                    <p className={`text-xl font-bold ${kpis.saldoLiquido >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                      {kpis.saldoLiquido >= 0 ? '+' : ''}{formatCurrencyCompact(kpis.saldoLiquido)}
                    </p>
                    <p className={`text-xs mt-1 ${kpis.saldoLiquido >= 0 ? 'text-blue-600/70 dark:text-blue-400/70' : 'text-orange-600/70 dark:text-orange-400/70'}`}>
                      Entradas - Saídas
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Margem */}
            <Card className={`border-0 shadow-sm overflow-hidden ${
              kpis.margemMedia >= 20 
                ? 'bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20'
                : kpis.margemMedia >= 0
                ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20'
                : 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20'
            }`}>
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium ${
                        kpis.margemMedia >= 20 ? 'text-violet-600 dark:text-violet-400' : 
                        kpis.margemMedia >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                      }`}>Margem Média</span>
                      <Percent className={`w-4 h-4 ${
                        kpis.margemMedia >= 20 ? 'text-violet-500' : 
                        kpis.margemMedia >= 0 ? 'text-amber-500' : 'text-red-500'
                      }`} />
                    </div>
                    <p className={`text-xl font-bold ${
                      kpis.margemMedia >= 20 ? 'text-violet-700 dark:text-violet-300' : 
                      kpis.margemMedia >= 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'
                    }`}>
                      {kpis.margemMedia.toFixed(1)}%
                    </p>
                    <p className={`text-xs mt-1 ${
                      kpis.margemMedia >= 20 ? 'text-violet-600/70 dark:text-violet-400/70' : 
                      kpis.margemMedia >= 0 ? 'text-amber-600/70 dark:text-amber-400/70' : 'text-red-600/70 dark:text-red-400/70'
                    }`}>
                      Resultado/Receita
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Meses */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/40 dark:to-slate-700/20 overflow-hidden">
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Período</span>
                      <Calendar className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
                      {kpis.totalMeses} meses
                    </p>
                    <p className="text-xs text-slate-600/70 dark:text-slate-400/70 mt-1">
                      Analisados
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Categorias */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/40 dark:to-cyan-900/20 overflow-hidden">
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">Categorias</span>
                      <Receipt className="w-4 h-4 text-cyan-500" />
                    </div>
                    <p className="text-xl font-bold text-cyan-700 dark:text-cyan-300">
                      {kpis.totalCategorias}
                    </p>
                    <p className="text-xs text-cyan-600/70 dark:text-cyan-400/70 mt-1">
                      Ativas no período
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Evolução do Fluxo */}
              <Card className="shadow-sm border-0">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <LineChart className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">Evolução Mensal</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Comparativo de entradas e saídas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                      <XAxis dataKey="mes" tick={{ fill: 'currentColor', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'currentColor', fontSize: 10 }} tickFormatter={formatCurrencyCompact} width={60} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [formatCurrency(value), name === 'receitas' ? 'Entradas' : 'Saídas']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceitas)" />
                      <Area type="monotone" dataKey="despesas" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorDespesas)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Resultado Mensal */}
              <Card className="shadow-sm border-0">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">Resultado Mensal</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Saldo e margem por mês</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                      <XAxis dataKey="mes" tick={{ fill: 'currentColor', fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fill: 'currentColor', fontSize: 10 }} tickFormatter={formatCurrencyCompact} width={60} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: 'currentColor', fontSize: 10 }} tickFormatter={(v) => `${v}%`} width={40} />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          if (name === 'saldo') return [formatCurrency(value), 'Resultado'];
                          return [`${value.toFixed(1)}%`, 'Margem'];
                        }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <Bar yAxisId="left" dataKey="saldo" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.saldo >= 0 ? '#10b981' : '#f43f5e'} />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="margem" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters and DFC Table */}
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Demonstrativo de Fluxo de Caixa</CardTitle>
                      <CardDescription className="text-xs">
                        Clique nas categorias para expandir detalhes
                      </CardDescription>
                    </div>
                  </div>
                </div>
                
                {/* Premium Date Selector */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Preset Buttons */}
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Período Rápido
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: "Ano Atual", inicio: `${new Date().getFullYear()}-01-01`, fim: "" },
                          { label: "Último Trimestre", inicio: (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().split('T')[0]; })(), fim: "" },
                          { label: "Últimos 6 Meses", inicio: (() => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().split('T')[0]; })(), fim: "" },
                          { label: "Último Ano", inicio: (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]; })(), fim: "" },
                          { label: "Tudo", inicio: "", fim: "" },
                        ].map((preset) => {
                          const isActive = filterDataInicio === preset.inicio && filterDataFim === preset.fim;
                          return (
                            <Button
                              key={preset.label}
                              variant={isActive ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setFilterDataInicio(preset.inicio);
                                setFilterDataFim(preset.fim);
                              }}
                              className={`h-8 text-xs font-medium transition-all ${
                                isActive 
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 border-0' 
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                              }`}
                              data-testid={`btn-preset-${preset.label.toLowerCase().replace(/\s/g, '-')}`}
                            >
                              {preset.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Custom Date Range */}
                    <div className="flex items-end gap-3 pl-0 lg:pl-4 lg:border-l border-slate-200 dark:border-slate-700">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          De
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={filterDataInicio}
                            onChange={(e) => setFilterDataInicio(e.target.value)}
                            className="h-10 w-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-medium shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer hover:border-emerald-400"
                            data-testid="input-data-inicio"
                          />
                        </div>
                      </div>
                      <div className="flex items-center h-10 px-2">
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          Até
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={filterDataFim}
                            onChange={(e) => setFilterDataFim(e.target.value)}
                            className="h-10 w-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-medium shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer hover:border-emerald-400"
                            data-testid="input-data-fim"
                          />
                        </div>
                      </div>
                      {(filterDataInicio || filterDataFim) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFilterDataInicio("");
                            setFilterDataFim("");
                          }}
                          className="h-10 px-4 border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:border-rose-800 dark:hover:text-rose-400 transition-all"
                          data-testid="button-clear-dates"
                        >
                          <RotateCcw className="w-4 h-4 mr-1.5" />
                          Limpar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4" data-testid="loading-dfc">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-primary/20 rounded-full"></div>
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                  </div>
                  <p className="text-sm text-muted-foreground">Carregando dados...</p>
                </div>
              ) : !dfcData || visibleItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
                  <DollarSign className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Nenhum dado disponível para o período selecionado.</p>
                </div>
              ) : viewMode === "cards" ? (
                /* Cards View */
                <div className="space-y-4">
                  {dfcData.nodes.filter(n => n.categoriaId === 'RECEITAS' || n.categoriaId === 'DESPESAS').map(rootNode => (
                    <div key={rootNode.categoriaId} className="space-y-3">
                      <div className={`p-4 rounded-xl ${
                        rootNode.categoriaId === 'RECEITAS' 
                          ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30'
                          : 'bg-gradient-to-r from-rose-50 to-rose-100/50 dark:from-rose-950/30 dark:to-rose-900/20 border border-rose-200/50 dark:border-rose-800/30'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {rootNode.categoriaId === 'RECEITAS' ? (
                              <ArrowUpCircle className="w-6 h-6 text-emerald-600" />
                            ) : (
                              <ArrowDownCircle className="w-6 h-6 text-rose-600" />
                            )}
                            <span className={`text-lg font-bold ${
                              rootNode.categoriaId === 'RECEITAS' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                            }`}>
                              {rootNode.categoriaNome}
                            </span>
                          </div>
                          <span className={`text-lg font-bold ${
                            rootNode.categoriaId === 'RECEITAS' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                          }`}>
                            {formatCurrency(Math.abs(Object.values(rootNode.valuesByMonth).reduce((a, b) => a + b, 0)))}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-4">
                        {dfcData.nodes
                          .filter(n => n.isLeaf && (
                            rootNode.categoriaId === 'RECEITAS' ? isReceita(n.categoriaId) : !isReceita(n.categoriaId)
                          ))
                          .sort((a, b) => {
                            const totalA = Math.abs(Object.values(a.valuesByMonth).reduce((s, v) => s + v, 0));
                            const totalB = Math.abs(Object.values(b.valuesByMonth).reduce((s, v) => s + v, 0));
                            return totalB - totalA;
                          })
                          .slice(0, 9)
                          .map(node => {
                            const total = Math.abs(Object.values(node.valuesByMonth).reduce((a, b) => a + b, 0));
                            const isReceitaNode = isReceita(node.categoriaId);
                            return (
                              <div
                                key={node.categoriaId}
                                className="p-3 rounded-lg bg-background border hover:shadow-md transition-all cursor-pointer"
                                onClick={() => toggleExpand(node.categoriaId)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{node.categoriaNome}</p>
                                    <p className={`text-lg font-bold ${isReceitaNode ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {formatCurrency(total)}
                                    </p>
                                  </div>
                                  <div className={`w-2 h-2 rounded-full mt-2 ${isReceitaNode ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                </div>
                                {/* Mini bar showing relative size */}
                                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${isReceitaNode ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                    style={{ width: `${Math.min((total / maxValue) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Table View */
                <div className="relative rounded-xl border overflow-hidden bg-background">
                  <div 
                    className="overflow-auto max-h-[60vh]"
                    style={{ 
                      display: 'grid',
                      gridTemplateColumns: `minmax(280px, 320px) repeat(${dfcData.meses.length}, minmax(100px, 120px))`,
                    }}
                  >
                    {/* Header Row */}
                    <div className="sticky top-0 left-0 z-30 bg-muted font-semibold p-3 border-b border-r text-sm flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-muted-foreground" />
                      Categoria
                    </div>
                    {dfcData.meses.map(mes => {
                      const [ano, mesNum] = mes.split('-');
                      const data = new Date(parseInt(ano), parseInt(mesNum) - 1);
                      const mesFormatado = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                      return (
                        <div 
                          key={`header-${mes}`} 
                          className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm font-semibold p-3 border-b text-center text-sm capitalize"
                        >
                          {mesFormatado}
                        </div>
                      );
                    })}
                    
                    {/* Body Rows */}
                    {visibleItems.map((item, idx) => {
                      if (item.type === 'node') {
                        const node = item.node;
                        const hasParcelas = node.isLeaf && node.parcelas && node.parcelas.length > 0;
                        const isReceitaNode = isReceita(node.categoriaId);
                        const isRootNode = node.categoriaId === 'RECEITAS' || node.categoriaId === 'DESPESAS';
                        
                        return (
                          <>
                            {/* Category Cell */}
                            <div 
                              key={`cat-${node.categoriaId}`}
                              className={`sticky left-0 z-10 p-3 border-b border-r transition-colors ${
                                isRootNode 
                                  ? (isReceitaNode 
                                    ? 'bg-emerald-50 dark:bg-emerald-950' 
                                    : 'bg-rose-50 dark:bg-rose-950')
                                  : 'bg-background hover:bg-muted'
                              }`}
                              style={{ paddingLeft: `${node.nivel * 20 + 12}px` }}
                              data-testid={`dfc-row-${node.categoriaId}`}
                            >
                              <div className="flex items-center gap-2">
                                {!node.isLeaf || hasParcelas ? (
                                  <button
                                    onClick={() => toggleExpand(node.categoriaId)}
                                    className={`p-1 rounded-md transition-colors ${
                                      expanded.has(node.categoriaId) 
                                        ? 'bg-primary/10 text-primary' 
                                        : 'hover:bg-muted text-muted-foreground'
                                    }`}
                                    data-testid={`button-toggle-${node.categoriaId}`}
                                  >
                                    {expanded.has(node.categoriaId) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>
                                ) : (
                                  <div className="w-6 flex justify-center">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isReceitaNode ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  </div>
                                )}
                                <span className={`text-sm ${
                                  isRootNode 
                                    ? 'font-bold' 
                                    : !node.isLeaf 
                                    ? 'font-semibold' 
                                    : 'font-medium'
                                } ${
                                  isRootNode 
                                    ? (isReceitaNode ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')
                                    : ''
                                }`}>
                                  {isRootNode && (isReceitaNode 
                                    ? <ArrowUpCircle className="w-4 h-4 inline mr-1.5 text-emerald-500" />
                                    : <ArrowDownCircle className="w-4 h-4 inline mr-1.5 text-rose-500" />
                                  )}
                                  {node.categoriaNome}
                                </span>
                              </div>
                            </div>
                            {/* Value Cells */}
                            {dfcData.meses.map(mes => {
                              const valor = node.valuesByMonth[mes] || 0;
                              const absValor = Math.abs(valor);
                              return (
                                <div 
                                  key={`val-${node.categoriaId}-${mes}`}
                                  className={`p-3 border-b text-right transition-colors ${
                                    isRootNode 
                                      ? (isReceitaNode 
                                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20' 
                                        : 'bg-rose-50/50 dark:bg-rose-950/20')
                                      : 'bg-background'
                                  }`}
                                  data-testid={`dfc-cell-${node.categoriaId}-${mes}`}
                                >
                                  {absValor > 0 ? (
                                    <div className="flex flex-col items-end gap-1">
                                      <span className={`text-sm tabular-nums ${
                                        isRootNode ? 'font-bold' : !node.isLeaf ? 'font-semibold' : 'font-medium'
                                      } ${isRootNode ? (isReceitaNode ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400') : ''}`}>
                                        {formatCurrency(absValor)}
                                      </span>
                                      {node.isLeaf && maxValue > 0 && (
                                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full rounded-full transition-all ${isReceitaNode ? 'bg-emerald-400' : 'bg-rose-400'}`}
                                            style={{ width: `${(absValor / maxValue) * 100}%` }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/30">
                                      <Minus className="w-3 h-3 inline" />
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        );
                      } else {
                        const parcela = item.parcela;
                        const parentNode = item.parentNode;
                        const isReceitaParcela = isReceita(parentNode.categoriaId);
                        
                        return (
                          <>
                            {/* Parcela Cell */}
                            <div 
                              key={`parcela-cat-${parcela.id}-${idx}`}
                              className={`sticky left-0 z-10 p-2 border-b border-r text-xs ${
                                isReceitaParcela 
                                  ? 'bg-emerald-50 dark:bg-emerald-950' 
                                  : 'bg-rose-50 dark:bg-rose-950'
                              }`}
                              style={{ paddingLeft: `${(parentNode.nivel + 1) * 20 + 16}px` }}
                              data-testid={`dfc-row-parcela-${parcela.id}-${parentNode.categoriaId}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-1 h-1 rounded-full ${isReceitaParcela ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                <span className="text-muted-foreground truncate max-w-[200px]">
                                  {parcela.descricao || `#${parcela.id}`}
                                </span>
                              </div>
                            </div>
                            {/* Parcela Value Cells */}
                            {dfcData.meses.map(mes => {
                              const valor = parcela.mes === mes ? parcela.valorBruto : 0;
                              return (
                                <div 
                                  key={`parcela-val-${parcela.id}-${mes}-${idx}`}
                                  className={`p-2 border-b text-right text-xs ${
                                    isReceitaParcela 
                                      ? 'bg-emerald-50/20 dark:bg-emerald-950/5' 
                                      : 'bg-rose-50/20 dark:bg-rose-950/5'
                                  }`}
                                  data-testid={`dfc-cell-parcela-${parcela.id}-${mes}`}
                                >
                                  {valor !== 0 ? (
                                    <span className="text-muted-foreground tabular-nums">
                                      {formatCurrency(Math.abs(valor))}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/20">
                                      <Minus className="w-2 h-2 inline" />
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        );
                      }
                    })}
                    
                    {/* Result Row */}
                    <div 
                      className="sticky left-0 z-10 p-3 border-t-2 border-b border-r bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950"
                      data-testid="dfc-row-resultado"
                    >
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-sm text-blue-700 dark:text-blue-400">
                          RESULTADO
                        </span>
                      </div>
                    </div>
                    {dfcData.meses.map(mes => {
                      const resultado = resultadoByMonth[mes] || 0;
                      const isPositivo = resultado >= 0;
                      return (
                        <div 
                          key={`resultado-${mes}`}
                          className={`p-3 border-t-2 border-b text-right ${
                            isPositivo 
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/30' 
                              : 'bg-rose-50/50 dark:bg-rose-950/30'
                          }`}
                          data-testid={`dfc-cell-resultado-${mes}`}
                        >
                          <span className={`font-bold text-sm tabular-nums ${
                            isPositivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {isPositivo ? '+' : ''}{formatCurrency(resultado)}
                          </span>
                        </div>
                      );
                    })}
                    
                    {/* Margin Row */}
                    <div 
                      className="sticky left-0 z-10 p-3 border-b border-r bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950"
                      data-testid="dfc-row-margem"
                    >
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-violet-600" />
                        <span className="font-bold text-sm text-violet-700 dark:text-violet-400">
                          MARGEM
                        </span>
                      </div>
                    </div>
                    {dfcData.meses.map(mes => {
                      const margem = margemByMonth[mes] || 0;
                      let colorClass = '';
                      let bgClass = '';
                      
                      if (margem < 0) {
                        colorClass = 'text-rose-600 dark:text-rose-400';
                        bgClass = 'bg-rose-50/50 dark:bg-rose-950/30';
                      } else if (margem < 20) {
                        colorClass = 'text-amber-600 dark:text-amber-400';
                        bgClass = 'bg-amber-50/50 dark:bg-amber-950/30';
                      } else {
                        colorClass = 'text-emerald-600 dark:text-emerald-400';
                        bgClass = 'bg-emerald-50/50 dark:bg-emerald-950/30';
                      }
                      
                      return (
                        <div 
                          key={`margem-${mes}`}
                          className={`p-3 border-b text-right ${bgClass}`}
                          data-testid={`dfc-cell-margem-${mes}`}
                        >
                          <span className={`font-bold text-sm tabular-nums ${colorClass}`}>
                            {margem.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
