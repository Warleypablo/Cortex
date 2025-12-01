import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Loader2, TrendingUp, TrendingDown, DollarSign, Calendar, ChevronRight, ChevronDown,
  Wallet, ArrowUpCircle, ArrowDownCircle, PiggyBank, BarChart3, Banknote, Receipt,
  CircleDollarSign, Coins, CreditCard, LineChart, Target, Activity
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import type { DfcHierarchicalResponse, DfcNode, DfcParcela } from "@shared/schema";

type VisibleItem = 
  | { type: 'node'; node: DfcNode }
  | { type: 'parcela'; parcela: DfcParcela; parentNode: DfcNode };

export default function DashboardDFC() {
  const [filterDataInicio, setFilterDataInicio] = useState<string>("2025-01-01");
  const [filterDataFim, setFilterDataFim] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['RECEITAS', 'DESPESAS']));

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

    return { 
      totalCategorias, 
      totalMeses, 
      totalReceitas,
      totalDespesas,
      saldoLiquido: totalReceitas - totalDespesas,
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
      
      return {
        mes: mesLabel,
        receitas,
        despesas,
        saldo: receitas - despesas,
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
    return categoriaId === 'RECEITAS' || categoriaId.startsWith('R');
  };

  const KPICard = ({ 
    title, value, subtitle, icon: Icon, variant = 'default', loading = false 
  }: { 
    title: string; 
    value: string; 
    subtitle?: string; 
    icon: any; 
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
    loading?: boolean;
  }) => {
    const variantStyles = {
      default: {
        bg: 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900',
        icon: 'bg-primary/10 text-primary',
      },
      success: {
        bg: 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/20',
        icon: 'bg-green-500/20 text-green-600 dark:text-green-400',
      },
      danger: {
        bg: 'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/30 dark:to-rose-900/20',
        icon: 'bg-red-500/20 text-red-600 dark:text-red-400',
      },
      warning: {
        bg: 'bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20',
        icon: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
      },
      info: {
        bg: 'bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-900/30 dark:to-sky-900/20',
        icon: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
      },
    };

    const styles = variantStyles[variant];

    if (loading) {
      return (
        <Card className={`${styles.bg} border-0 shadow-lg overflow-hidden`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={`${styles.bg} border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 overflow-hidden`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
              <p className="text-lg font-bold text-foreground truncate">
                {value}
              </p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            <div className={`p-2.5 rounded-xl ${styles.icon} shadow-inner flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b bg-gradient-to-r from-background via-background to-muted/30 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text" data-testid="text-page-title">
                DFC - Demonstração de Fluxo de Caixa
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Análise hierárquica completa do fluxo financeiro
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1.5 text-sm font-medium bg-green-500/10 text-green-600 border-green-500/30">
              <ArrowUpCircle className="w-4 h-4 mr-1.5" />
              Entradas
            </Badge>
            <Badge variant="outline" className="px-3 py-1.5 text-sm font-medium bg-red-500/10 text-red-600 border-red-500/30">
              <ArrowDownCircle className="w-4 h-4 mr-1.5" />
              Saídas
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-gradient-to-b from-muted/20 to-background">
        <div className="max-w-[1800px] mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Total de Entradas"
              value={formatCurrency(kpis.totalReceitas)}
              icon={ArrowUpCircle}
              variant="success"
              subtitle="Receitas no período"
              loading={isLoading}
            />
            <KPICard
              title="Total de Saídas"
              value={formatCurrency(kpis.totalDespesas)}
              icon={ArrowDownCircle}
              variant="danger"
              subtitle="Despesas no período"
              loading={isLoading}
            />
            <KPICard
              title="Saldo Líquido"
              value={formatCurrency(kpis.saldoLiquido)}
              icon={Wallet}
              variant={kpis.saldoLiquido >= 0 ? 'success' : 'danger'}
              subtitle="Entradas - Saídas"
              loading={isLoading}
            />
            <KPICard
              title="Meses Analisados"
              value={kpis.totalMeses.toString()}
              icon={Calendar}
              variant="info"
              subtitle="Período de análise"
              loading={isLoading}
            />
            <KPICard
              title="Categorias"
              value={kpis.totalCategorias.toString()}
              icon={Receipt}
              variant="warning"
              subtitle="Categorias ativas"
              loading={isLoading}
            />
          </div>

          {chartData.length > 0 && (
            <Card className="shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <LineChart className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Evolução do Fluxo de Caixa</CardTitle>
                    <CardDescription>Comparativo mensal de entradas e saídas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mes" tick={{ fill: 'currentColor', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'currentColor' }} tickFormatter={formatCurrencyCompact} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name === 'receitas' ? 'Entradas' : 'Saídas']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Legend 
                      formatter={(value: string) => value === 'receitas' ? 'Entradas' : 'Saídas'}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="receitas" 
                      stroke="#22c55e" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorReceitas)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="despesas" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorDespesas)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-lg border-0 bg-gradient-to-br from-background to-muted/10">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>DFC</CardTitle>
                    <CardDescription>
                      Navegue pela hierarquia expandindo e colapsando os níveis
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Vencimento de:</label>
                    <input
                      type="date"
                      value={filterDataInicio}
                      onChange={(e) => setFilterDataInicio(e.target.value)}
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      data-testid="input-data-inicio"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Até:</label>
                    <input
                      type="date"
                      value={filterDataFim}
                      onChange={(e) => setFilterDataFim(e.target.value)}
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      data-testid="input-data-fim"
                    />
                  </div>
                  
                  {(filterDataInicio || filterDataFim) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilterDataInicio("");
                        setFilterDataFim("");
                      }}
                      className="h-10"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4" data-testid="loading-dfc">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                  </div>
                  <p className="text-muted-foreground animate-pulse">Carregando dados financeiros...</p>
                </div>
              ) : !dfcData || visibleItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
                  <DollarSign className="w-16 h-16 opacity-20" />
                  <p>Nenhum dado de DFC disponível para os filtros selecionados.</p>
                </div>
              ) : (
                <div className="relative rounded-lg border overflow-hidden">
                  <div 
                    className="overflow-auto max-h-[70vh]"
                    style={{ 
                      display: 'grid',
                      gridTemplateColumns: `350px repeat(${dfcData.meses.length}, 130px)`,
                    }}
                  >
                    {/* Header Row - Sticky Top */}
                    <div className="sticky top-0 left-0 z-30 bg-muted font-bold p-3 border-b border-r border-border flex items-center gap-2 shadow-[2px_2px_4px_rgba(0,0,0,0.1)]">
                      <Receipt className="w-4 h-4" />
                      Categoria
                    </div>
                    {dfcData.meses.map(mes => {
                      const [ano, mesNum] = mes.split('-');
                      const data = new Date(parseInt(ano), parseInt(mesNum) - 1);
                      const mesFormatado = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                      return (
                        <div 
                          key={`header-${mes}`} 
                          className="sticky top-0 z-20 bg-muted font-bold p-3 border-b border-border text-center capitalize"
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
                        
                        const cellBg = isRootNode 
                          ? (isReceitaNode ? 'bg-green-100 dark:bg-green-950' : 'bg-red-100 dark:bg-red-950')
                          : 'bg-background';
                        
                        const valueCellBg = isRootNode 
                          ? (isReceitaNode ? 'bg-green-50 dark:bg-green-950/50' : 'bg-red-50 dark:bg-red-950/50')
                          : 'bg-background';
                        
                        return (
                          <>
                            {/* Category Cell - Sticky Left */}
                            <div 
                              key={`cat-${node.categoriaId}`}
                              className={`sticky left-0 z-10 p-3 border-b border-r border-border ${cellBg} shadow-[2px_0_4px_rgba(0,0,0,0.05)] hover:brightness-95 transition-all`}
                              style={{ paddingLeft: `${node.nivel * 24 + 12}px` }}
                              data-testid={`dfc-row-${node.categoriaId}`}
                            >
                              <div className="flex items-center gap-2">
                                {!node.isLeaf || hasParcelas ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-7 w-7 rounded-lg transition-all duration-200 ${
                                      expanded.has(node.categoriaId) 
                                        ? 'bg-primary/10 text-primary' 
                                        : 'hover:bg-muted'
                                    }`}
                                    onClick={() => toggleExpand(node.categoriaId)}
                                    data-testid={`button-toggle-${node.categoriaId}`}
                                  >
                                    {expanded.has(node.categoriaId) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                ) : (
                                  <div className="w-7 flex justify-center">
                                    {isReceitaNode ? (
                                      <Coins className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <CreditCard className="w-4 h-4 text-red-500" />
                                    )}
                                  </div>
                                )}
                                <span className={`${!node.isLeaf ? 'font-bold' : 'font-medium'} ${
                                  isRootNode 
                                    ? (isReceitaNode ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')
                                    : ''
                                }`}>
                                  {node.categoriaId === 'RECEITAS' && <ArrowUpCircle className="w-5 h-5 inline mr-2 text-green-500" />}
                                  {node.categoriaId === 'DESPESAS' && <ArrowDownCircle className="w-5 h-5 inline mr-2 text-red-500" />}
                                  {node.categoriaNome}
                                </span>
                              </div>
                            </div>
                            {/* Value Cells */}
                            {dfcData.meses.map(mes => {
                              const valor = node.valuesByMonth[mes] || 0;
                              return (
                                <div 
                                  key={`val-${node.categoriaId}-${mes}`}
                                  className={`p-3 border-b border-border text-center ${valueCellBg} hover:brightness-95 transition-all`}
                                  data-testid={`dfc-cell-${node.categoriaId}-${mes}`}
                                >
                                  {valor !== 0 ? (
                                    <span className={`${!node.isLeaf ? 'font-bold' : 'font-medium'} ${isRootNode ? 'text-base' : 'text-sm'}`}>
                                      {formatCurrency(Math.abs(valor))}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
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
                        
                        const parcelaBg = isReceitaParcela 
                          ? 'bg-green-50 dark:bg-green-950/30' 
                          : 'bg-red-50 dark:bg-red-950/30';
                        
                        return (
                          <>
                            {/* Parcela Category Cell - Sticky Left */}
                            <div 
                              key={`parcela-cat-${parcela.id}-${idx}`}
                              className={`sticky left-0 z-10 p-3 border-b border-r border-border ${parcelaBg} shadow-[2px_0_4px_rgba(0,0,0,0.05)] hover:brightness-95 transition-all`}
                              style={{ paddingLeft: `${(parentNode.nivel + 1) * 24 + 12}px` }}
                              data-testid={`dfc-row-parcela-${parcela.id}-${parentNode.categoriaId}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isReceitaParcela ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-sm text-muted-foreground">
                                  #{parcela.id} - {parcela.descricao || 'Sem descrição'}
                                </span>
                              </div>
                            </div>
                            {/* Parcela Value Cells */}
                            {dfcData.meses.map(mes => {
                              const valor = parcela.mes === mes ? parcela.valorBruto : 0;
                              return (
                                <div 
                                  key={`parcela-val-${parcela.id}-${mes}-${idx}`}
                                  className={`p-3 border-b border-border text-center ${parcelaBg} hover:brightness-95 transition-all`}
                                  data-testid={`dfc-cell-parcela-${parcela.id}-${mes}`}
                                >
                                  {valor !== 0 ? (
                                    <span className="text-sm font-medium">
                                      {formatCurrency(Math.abs(valor))}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/30">—</span>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        );
                      }
                    })}
                    
                    {/* Linha de Resultado */}
                    <div 
                      className="sticky left-0 z-10 p-3 border-t-2 border-b border-r border-border bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-950 dark:to-indigo-950 shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                      data-testid="dfc-row-resultado"
                    >
                      <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="font-bold text-blue-700 dark:text-blue-400">
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
                          className={`p-3 border-t-2 border-b border-border text-center whitespace-nowrap ${
                            isPositivo 
                              ? 'bg-green-50 dark:bg-green-950/50' 
                              : 'bg-red-50 dark:bg-red-950/50'
                          }`}
                          data-testid={`dfc-cell-resultado-${mes}`}
                        >
                          <span className={`font-bold text-sm ${
                            isPositivo ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {isPositivo ? '+R$ ' : 'R$ '}{Math.abs(resultado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
