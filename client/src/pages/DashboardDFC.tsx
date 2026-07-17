import { useState, useMemo, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDecimal, formatPercent, formatCurrencyNoDecimals, formatCurrencyCompact, cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { HeroMetric } from "@/components/HeroMetric";
import { StatsCardV2 } from "@/components/StatsCardV2";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, TrendingUp, TrendingDown, DollarSign, ChevronRight, ChevronDown,
  ArrowUpCircle, ArrowDownCircle, Receipt,
  Target, Percent,
  Sparkles, BrainCircuit, Send, MessageCircle, Bot, User, Minus, LayoutGrid, Table2,
  RotateCcw
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { format, startOfYear } from "date-fns";
import { Input } from "@/components/ui/input";
import { Tooltip as TooltipUI, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

type FornecedorRow = {
  fornecedor: string;
  descricao: string;
  valuesByMonth: Record<string, number>;
  parcelaIds: number[];
};

type VisibleItem =
  | { type: 'node'; node: DfcNode }
  | { type: 'parcela'; parcela: DfcParcela; parentNode: DfcNode }
  | { type: 'fornecedor'; fornecedorRow: FornecedorRow; parentNode: DfcNode };

export default function DashboardDFC() {
  usePageTitle("DFC");
  useSetPageInfo("DFC - Demonstração de Fluxo de Caixa", "Análise hierárquica de receitas e despesas");
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: undefined
  });
  const [empresa, setEmpresa] = useState<string>("todas");
  const [regime, setRegime] = useState<"quitado" | "competencia">("quitado");
  // Filtro por exclusão: tudo vem selecionado por padrão; guarda-se o que foi DESmarcado.
  // Assim categorias novas de outro período/regime já entram marcadas.
  const [categoriasExcluidas, setCategoriasExcluidas] = useState<string[]>([]);
  const [todasCategorias, setTodasCategorias] = useState<{ id: string; nome: string }[]>([]);
  // Agregadores XX.YY do plano de contas (ex.: "04.02 Recebimento de Empréstimos"):
  // aparecem no dropdown como grupo; desmarcar um pai desmarca todas as suas folhas
  const [categoriasPais, setCategoriasPais] = useState<{ id: string; nome: string }[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['RECEITAS', 'DESPESAS']));
  
  const filterDataInicio = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const filterDataFim = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '';

  const folhasSelecionadas = useMemo(
    () => todasCategorias.filter(c => !categoriasExcluidas.includes(c.id)).map(c => c.id),
    [todasCategorias, categoriasExcluidas]
  );

  const filhasDe = (paiId: string) =>
    todasCategorias.filter(c => c.id.startsWith(paiId + '.')).map(c => c.id);

  // Seleção mostrada no dropdown: folhas + pais cujas filhas estão todas marcadas
  const categoriasSelecionadas = useMemo(() => {
    const folhasSet = new Set(folhasSelecionadas);
    const paisSel = categoriasPais
      .filter(p => {
        const filhas = filhasDe(p.id);
        return filhas.length > 0 && filhas.every(f => folhasSet.has(f));
      })
      .map(p => p.id);
    return [...folhasSelecionadas, ...paisSel];
  }, [folhasSelecionadas, categoriasPais, todasCategorias]);

  const categoriaOptions = useMemo(() => {
    const paiIds = new Set(categoriasPais.map(p => p.id));
    return [
      ...categoriasPais.map(p => ({ value: p.id, label: `${p.id} ${p.nome}` })),
      ...todasCategorias.map(c => {
        const paiId = c.id.split('.').slice(0, 2).join('.');
        const indent = paiIds.has(paiId) && paiId !== c.id ? '   ' : '';
        return { value: c.id, label: `${indent}${c.id} ${c.nome}` };
      }),
    ].sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
  }, [categoriasPais, todasCategorias]);

  const handleCategoriasChange = (novaSelecao: string[]) => {
    // Limpar tudo (X do trigger ou desmarcar o último item) = voltar ao padrão: todas visíveis
    if (novaSelecao.length === 0) {
      setCategoriasExcluidas([]);
      return;
    }
    const prev = new Set(categoriasSelecionadas);
    const nova = new Set(novaSelecao);
    const toggled = [
      ...Array.from(prev).filter(v => !nova.has(v)),
      ...Array.from(nova).filter(v => !prev.has(v)),
    ];
    const folhasSet = new Set(folhasSelecionadas);
    for (const id of toggled) {
      const adicionado = nova.has(id);
      const alvo = categoriasPais.some(p => p.id === id) ? filhasDe(id) : [id];
      alvo.forEach(f => (adicionado ? folhasSet.add(f) : folhasSet.delete(f)));
    }
    // Desmarcar tudo não tem uso (DFC vazia) — volta ao padrão
    if (folhasSet.size === 0) {
      setCategoriasExcluidas([]);
      return;
    }
    setCategoriasExcluidas(todasCategorias.filter(c => !folhasSet.has(c.id)).map(c => c.id));
  };
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
        empresa: empresa !== "todas" ? empresa : undefined,
        regime,
        categorias: categoriasExcluidas.length > 0 ? folhasSelecionadas : undefined,
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

  const { data: dfcData, isLoading } = useQuery<DfcHierarchicalResponse & { empresas?: string[]; categorias?: { id: string; nome: string }[]; categoriasPais?: { id: string; nome: string }[] }>({
    queryKey: ["/api/dfc", filterDataInicio, filterDataFim, empresa, regime, categoriasExcluidas.join(",")],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterDataInicio) params.append("dataInicio", filterDataInicio);
      if (filterDataFim) params.append("dataFim", filterDataFim);
      if (empresa && empresa !== "todas") params.append("empresa", empresa);
      if (regime !== "quitado") params.append("regime", regime);
      if (categoriasExcluidas.length > 0 && folhasSelecionadas.length > 0) {
        params.append("categorias", folhasSelecionadas.join(","));
      }

      const res = await fetch(`/api/dfc?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch DFC data");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Mantém a lista de categorias estável entre refetches (o response traz a lista completa do período/regime)
  useEffect(() => {
    if (dfcData?.categorias) setTodasCategorias(dfcData.categorias);
    if (dfcData?.categoriasPais) setCategoriasPais(dfcData.categoriasPais);
  }, [dfcData]);

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
          const mesesSet = new Set(dfcData.meses);
          // Group parcelas by fornecedor name, pivot values by month
          const grouped = new Map<string, FornecedorRow>();
          node.parcelas
            .filter(p => p.valorBruto !== 0 && mesesSet.has(p.mes))
            .forEach(parcela => {
              const key = parcela.fornecedor || parcela.descricao || `#${parcela.id}`;
              if (!grouped.has(key)) {
                grouped.set(key, {
                  fornecedor: parcela.fornecedor || '',
                  descricao: parcela.descricao || '',
                  valuesByMonth: {},
                  parcelaIds: [],
                });
              }
              const row = grouped.get(key)!;
              row.valuesByMonth[parcela.mes] = (row.valuesByMonth[parcela.mes] || 0) + parcela.valorBruto;
              row.parcelaIds.push(parcela.id);
            });
          grouped.forEach(fornecedorRow => {
            result.push({ type: 'fornecedor', fornecedorRow, parentNode: node });
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

  // Coleta todos os meses disponíveis (visíveis + históricos) para cálculo de variação
  const allAvailableMonths = useMemo(() => {
    if (!dfcData?.nodes) return new Set<string>();
    const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
    const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');
    const months = new Set<string>();
    if (receitasNode) Object.keys(receitasNode.valuesByMonth).forEach(m => months.add(m));
    if (despesasNode) Object.keys(despesasNode.valuesByMonth).forEach(m => months.add(m));
    return months;
  }, [dfcData]);

  const resultadoByMonth = useMemo(() => {
    if (!dfcData || !dfcData.nodes || dfcData.nodes.length === 0) return {};

    const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
    const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');

    // Calcular resultado para TODOS os meses (visíveis + históricos) para variação
    const resultado: Record<string, number> = {};
    allAvailableMonths.forEach(mes => {
      const receita = receitasNode?.valuesByMonth[mes] || 0;
      const despesa = Math.abs(despesasNode?.valuesByMonth[mes] || 0);
      resultado[mes] = receita - despesa;
    });

    return resultado;
  }, [dfcData, allAvailableMonths]);

  const margemByMonth = useMemo(() => {
    if (!dfcData || !dfcData.nodes || dfcData.nodes.length === 0) return {};

    const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
    const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');

    // Calcular margem para TODOS os meses (visíveis + históricos) para variação
    const margem: Record<string, number> = {};
    allAvailableMonths.forEach(mes => {
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
  }, [dfcData, allAvailableMonths]);

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

  // Calcula variação % de um valor genérico em relação à média dos 6 meses anteriores
  const calcVariacaoGeneric = (valuesByMonth: Record<string, number>, mes: string, useAbsValues = true): { avg6m: number; variacao: number; mesesUsados: number } | null => {
    const mesDate = new Date(mes + '-01');
    const prev6: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(mesDate);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (valuesByMonth[key] !== undefined) {
        prev6.push(useAbsValues ? Math.abs(valuesByMonth[key] || 0) : (valuesByMonth[key] || 0));
      }
    }
    if (prev6.length === 0) return null;
    const avg = prev6.reduce((a, b) => a + b, 0) / prev6.length;
    if (avg === 0) return null;
    const valor = useAbsValues ? Math.abs(valuesByMonth[mes] || 0) : (valuesByMonth[mes] || 0);
    return { avg6m: avg, variacao: ((valor - avg) / avg) * 100, mesesUsados: prev6.length };
  };

  // Calcula variação % de um valor em relação à média dos 6 meses anteriores
  const calcVariacao = (node: DfcNode, mes: string) => calcVariacaoGeneric(node.valuesByMonth, mes);

  // Calcula variação % em relação ao mês anterior
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const calcVariacaoMesAnterior = (valuesByMonth: Record<string, number>, mes: string, useAbsValues = true): number | null => {
    // Não mostrar variação no mês atual (dados incompletos)
    if (mes === currentMonthKey) return null;
    const [year, month] = mes.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    if (valuesByMonth[prevKey] === undefined) return null;
    const valorAtual = useAbsValues ? Math.abs(valuesByMonth[mes] || 0) : (valuesByMonth[mes] || 0);
    const valorAnterior = useAbsValues ? Math.abs(valuesByMonth[prevKey] || 0) : (valuesByMonth[prevKey] || 0);
    if (valorAnterior === 0) return null;
    // Para valores com sinal, não mostrar se sinais diferem (cruzou zero)
    if (!useAbsValues && ((valorAtual > 0 && valorAnterior < 0) || (valorAtual < 0 && valorAnterior > 0))) return null;
    return ((valorAtual - valorAnterior) / valorAnterior) * 100;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle de regime: quitado (caixa) x competência */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1" data-testid="toggle-regime">
              <Button
                variant={regime === "quitado" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setRegime("quitado")}
                className="h-8"
                data-testid="button-regime-quitado"
              >
                Quitado
              </Button>
              <Button
                variant={regime === "competencia" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setRegime("competencia")}
                className="h-8"
                data-testid="button-regime-competencia"
              >
                Competência
              </Button>
            </div>
            {/* Filtro de categorias (todas marcadas por padrão; desmarcar exclui da DFC) */}
            <MultiSelect
              className="w-[240px]"
              options={categoriaOptions}
              selected={categoriasSelecionadas}
              onChange={handleCategoriasChange}
              placeholder="Todas as categorias"
              allSelectedLabel="Todas as categorias"
              searchPlaceholder="Buscar categoria..."
              emptyText="Nenhuma categoria encontrada"
            />
            {/* Filtro de empresa */}
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Consolidada</SelectItem>
                {dfcData?.empresas?.map((emp) => (
                  <SelectItem key={emp} value={emp}>
                    {emp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Date Range Picker no header */}
            <div className="flex items-center gap-2">
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Selecione o período"
                align="end"
                data-testid="date-range-picker-dfc"
              />
              {dateRange && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateRange(undefined)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  data-testid="button-clear-dates"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            
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
          </div>
        </div>
      </div>

      {/* Chat Dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-2xl h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 rounded-lg bg-muted">
                <BrainCircuit className="w-5 h-5 text-muted-foreground" />
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
                className="bg-primary hover:bg-primary/90"
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
          
          {/* Hero Metrics */}
          {isLoading ? (
            <div className="flex items-start gap-12">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-12">
              <HeroMetric
                label="Entradas"
                value={formatCurrencyCompact(kpis.totalReceitas)}
                subtitle="Total de receitas no período"
              />
              <HeroMetric
                label="Saídas"
                value={formatCurrencyCompact(kpis.totalDespesas)}
                subtitle="Total de despesas no período"
              />
              <HeroMetric
                label="Saldo"
                value={`${kpis.saldoLiquido >= 0 ? '+' : ''}${formatCurrencyCompact(kpis.saldoLiquido)}`}
                subtitle="Entradas - Saídas"
                trend={{
                  value: formatPercent(kpis.margemMedia),
                  isPositive: kpis.saldoLiquido >= 0,
                }}
              />
            </div>
          )}

          {/* Supporting Cards */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatsCardV2
                title="Margem Média"
                value={formatPercent(kpis.margemMedia)}
                subtitle="Resultado / Receita"
                variant={kpis.margemMedia >= 20 ? 'success' : kpis.margemMedia >= 0 ? 'warning' : 'error'}
              />
              <StatsCardV2
                title="Período"
                value={`${kpis.totalMeses} meses`}
                subtitle="Analisados"
              />
              <StatsCardV2
                title="Categorias"
                value={String(kpis.totalCategorias)}
                subtitle="Ativas no período"
              />
            </div>
          )}

          {/* Charts Section */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Evolução do Fluxo */}
              <Card className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Evolução Mensal</CardTitle>
                  <CardDescription className="text-xs">Comparativo de entradas e saídas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <CartesianGrid vertical={false} stroke={isDark ? '#27272a' : '#f0f0f0'} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} />
                      <YAxis tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} tickFormatter={formatCurrencyCompact} width={60} />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatCurrencyNoDecimals(value), name === 'receitas' ? 'Entradas' : 'Saídas']}
                        contentStyle={{
                          backgroundColor: isDark ? '#18181b' : '#ffffff',
                          border: `1px solid ${isDark ? '#3f3f46' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} fill="#ef4444" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Resultado Mensal */}
              <Card className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resultado Mensal</CardTitle>
                  <CardDescription className="text-xs">Saldo e margem por mês</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid vertical={false} stroke={isDark ? '#27272a' : '#f0f0f0'} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} tickFormatter={formatCurrencyCompact} width={60} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#6b7280' }} tickFormatter={(v) => `${v}%`} width={40} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'saldo') return [formatCurrencyNoDecimals(value), 'Resultado'];
                          return [formatPercent(value), 'Margem'];
                        }}
                        contentStyle={{
                          backgroundColor: isDark ? '#18181b' : '#ffffff',
                          border: `1px solid ${isDark ? '#3f3f46' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <ReferenceLine yAxisId="left" y={0} stroke={isDark ? '#52525b' : '#d1d5db'} strokeDasharray="3 3" />
                      <Bar yAxisId="left" dataKey="saldo" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.saldo >= 0 ? '#10b981' : '#ef4444'} />
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
          <Card className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Demonstrativo de Fluxo de Caixa</CardTitle>
              <CardDescription className="text-xs">
                Clique nas categorias para expandir detalhes
              </CardDescription>
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
                      <div className={`p-4 rounded-lg ${
                        rootNode.categoriaId === 'RECEITAS'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30'
                          : 'bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/30'
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
                            {formatCurrencyNoDecimals(Math.abs(Object.values(rootNode.valuesByMonth).reduce((a, b) => a + b, 0)))}
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
                                      {formatCurrencyNoDecimals(total)}
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
                          className="sticky top-0 z-20 bg-muted font-semibold p-3 border-b text-center text-sm capitalize"
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
                          <Fragment key={`row-${node.categoriaId}`}>
                            {/* Category Cell */}
                            <div
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
                              const varInfo = absValor > 0 ? calcVariacao(node, mes) : null;
                              // Para receitas: subir é bom (verde), cair é ruim (vermelho)
                              // Para despesas: subir é ruim (vermelho), cair é bom (verde)
                              const isPositiveVariation = varInfo
                                ? (isReceitaNode ? varInfo.variacao > 0 : varInfo.variacao < 0)
                                : false;

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
                                    <TooltipProvider delayDuration={200}>
                                      <TooltipUI>
                                        <TooltipTrigger asChild>
                                          <div className="flex flex-col items-end gap-1 cursor-default">
                                            <span className={`text-sm tabular-nums ${
                                              isRootNode ? 'font-bold' : !node.isLeaf ? 'font-semibold' : 'font-medium'
                                            } ${isRootNode ? (isReceitaNode ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400') : ''}`}>
                                              {formatCurrencyNoDecimals(absValor)}
                                            </span>
                                            {(() => {
                                              const varMoM = calcVariacaoMesAnterior(node.valuesByMonth, mes);
                                              if (varMoM === null) return null;
                                              const isGood = isReceitaNode ? varMoM > 0 : varMoM < 0;
                                              return (
                                                <span className={`text-[10px] tabular-nums ${isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                  {varMoM > 0 ? '▲' : '▼'} {varMoM > 0 ? '+' : ''}{formatPercent(varMoM)}
                                                </span>
                                              );
                                            })()}
                                            {node.isLeaf && maxValue > 0 && (
                                              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                                <div
                                                  className={`h-full rounded-full transition-all ${isReceitaNode ? 'bg-emerald-400' : 'bg-rose-400'}`}
                                                  style={{ width: `${(absValor / maxValue) * 100}%` }}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[220px]">
                                          {varInfo ? (
                                            <div className="space-y-1 text-xs">
                                              <p className="text-muted-foreground">
                                                Média {varInfo.mesesUsados}m anteriores: <span className="font-semibold text-foreground">{formatCurrencyNoDecimals(varInfo.avg6m)}</span>
                                              </p>
                                              <p className={isPositiveVariation ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                                                {isPositiveVariation ? '↑' : '↓'} {varInfo.variacao > 0 ? '+' : ''}{formatPercent(varInfo.variacao)} vs média
                                              </p>
                                            </div>
                                          ) : (
                                            <p className="text-xs text-muted-foreground">Sem dados históricos para comparação</p>
                                          )}
                                        </TooltipContent>
                                      </TooltipUI>
                                    </TooltipProvider>
                                  ) : (
                                    <span className="text-muted-foreground/30">
                                      <Minus className="w-3 h-3 inline" />
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </Fragment>
                        );
                      } else if (item.type === 'fornecedor') {
                        const { fornecedorRow, parentNode } = item;
                        const isReceitaRow = isReceita(parentNode.categoriaId);
                        const displayName = fornecedorRow.fornecedor || fornecedorRow.descricao || `#${fornecedorRow.parcelaIds[0]}`;

                        return (
                          <Fragment key={`fornecedor-row-${displayName}-${parentNode.categoriaId}-${idx}`}>
                            {/* Fornecedor Name Cell */}
                            <div
                              className={`sticky left-0 z-10 p-2 border-b border-r text-xs ${
                                isReceitaRow
                                  ? 'bg-emerald-50 dark:bg-emerald-950'
                                  : 'bg-rose-50 dark:bg-rose-950'
                              }`}
                              style={{ paddingLeft: `${(parentNode.nivel + 1) * 20 + 16}px` }}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-1 h-1 rounded-full ${isReceitaRow ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                <TooltipProvider delayDuration={200}>
                                  <TooltipUI>
                                    <TooltipTrigger asChild>
                                      <span className="text-muted-foreground truncate max-w-[200px] block cursor-default">
                                        {displayName}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="max-w-[300px]">{fornecedorRow.descricao || displayName}</p>
                                    </TooltipContent>
                                  </TooltipUI>
                                </TooltipProvider>
                              </div>
                            </div>
                            {/* Fornecedor Value Cells (pivoted by month) */}
                            {dfcData.meses.map(mes => {
                              const valor = fornecedorRow.valuesByMonth[mes] || 0;
                              return (
                                <div
                                  key={`fornecedor-val-${displayName}-${mes}-${idx}`}
                                  className={`p-2 border-b text-right text-xs ${
                                    isReceitaRow
                                      ? 'bg-emerald-50/20 dark:bg-emerald-950/5'
                                      : 'bg-rose-50/20 dark:bg-rose-950/5'
                                  }`}
                                >
                                  {valor !== 0 ? (
                                    <span className="text-muted-foreground tabular-nums">
                                      {formatCurrencyNoDecimals(Math.abs(valor))}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/20">
                                      <Minus className="w-2 h-2 inline" />
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </Fragment>
                        );
                      } else {
                        return null;
                      }
                    })}
                    
                    {/* Result Row */}
                    <div 
                      className="sticky left-0 z-10 p-3 border-t-2 border-b border-r bg-blue-50 dark:bg-blue-950/30"
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
                      const resVarInfo = calcVariacaoGeneric(resultadoByMonth, mes, false);
                      const resIsPositiveVar = resVarInfo ? resVarInfo.variacao > 0 : false;
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
                          <TooltipProvider delayDuration={200}>
                            <TooltipUI>
                              <TooltipTrigger asChild>
                                <div className="flex flex-col items-end gap-0.5 cursor-default">
                                  <span className={`font-bold text-sm tabular-nums ${
                                    isPositivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                  }`}>
                                    {isPositivo ? '+' : ''}{formatCurrencyNoDecimals(resultado)}
                                  </span>
                                  {(() => {
                                    const varMoM = calcVariacaoMesAnterior(resultadoByMonth, mes, false);
                                    if (varMoM === null) return null;
                                    const isGood = varMoM > 0;
                                    return (
                                      <span className={`text-[10px] tabular-nums ${isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {varMoM > 0 ? '▲' : '▼'} {varMoM > 0 ? '+' : ''}{formatPercent(varMoM)}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px]">
                                {resVarInfo ? (
                                  <div className="space-y-1 text-xs">
                                    <p className="text-muted-foreground">
                                      Média {resVarInfo.mesesUsados}m anteriores: <span className="font-semibold text-foreground">{formatCurrencyNoDecimals(resVarInfo.avg6m)}</span>
                                    </p>
                                    <p className={resIsPositiveVar ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                                      {resIsPositiveVar ? '↑' : '↓'} {resVarInfo.variacao > 0 ? '+' : ''}{formatPercent(resVarInfo.variacao)} vs média
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Sem dados históricos para comparação</p>
                                )}
                              </TooltipContent>
                            </TooltipUI>
                          </TooltipProvider>
                        </div>
                      );
                    })}
                    
                    {/* Margin Row */}
                    <div 
                      className="sticky left-0 z-10 p-3 border-b border-r bg-violet-50 dark:bg-violet-950/30"
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
                      const margemVarInfo = calcVariacaoGeneric(margemByMonth, mes, false);
                      const margemIsPositiveVar = margemVarInfo ? margemVarInfo.variacao > 0 : false;
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
                          <TooltipProvider delayDuration={200}>
                            <TooltipUI>
                              <TooltipTrigger asChild>
                                <span className={`font-bold text-sm tabular-nums cursor-default ${colorClass}`}>
                                  {formatPercent(margem)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px]">
                                {margemVarInfo ? (
                                  <div className="space-y-1 text-xs">
                                    <p className="text-muted-foreground">
                                      Média {margemVarInfo.mesesUsados}m anteriores: <span className="font-semibold text-foreground">{formatPercent(margemVarInfo.avg6m)}</span>
                                    </p>
                                    <p className={margemIsPositiveVar ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                                      {margemIsPositiveVar ? '↑' : '↓'} {margemVarInfo.variacao > 0 ? '+' : ''}{formatPercent(margemVarInfo.variacao)} vs média
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Sem dados históricos para comparação</p>
                                )}
                              </TooltipContent>
                            </TooltipUI>
                          </TooltipProvider>
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
