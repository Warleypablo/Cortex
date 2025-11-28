import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [filterMesInicio, setFilterMesInicio] = useState<string>("");
  const [filterMesFim, setFilterMesFim] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['RECEITAS', 'DESPESAS']));

  const { data: dfcData, isLoading } = useQuery<DfcHierarchicalResponse>({
    queryKey: ["/api/dfc", filterMesInicio, filterMesFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterMesInicio) params.append("mesInicio", filterMesInicio);
      if (filterMesFim) params.append("mesFim", filterMesFim);
      
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
    title, value, subtitle, icon: Icon, variant = 'default', loading = false, animate = false 
  }: { 
    title: string; 
    value: string; 
    subtitle?: string; 
    icon: any; 
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
    loading?: boolean;
    animate?: boolean;
  }) => {
    const variantStyles = {
      default: {
        bg: 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900',
        icon: 'bg-primary/10 text-primary',
        text: 'text-foreground',
      },
      success: {
        bg: 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/20',
        icon: 'bg-green-500/20 text-green-600 dark:text-green-400',
        text: 'text-green-700 dark:text-green-400',
      },
      danger: {
        bg: 'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/30 dark:to-rose-900/20',
        icon: 'bg-red-500/20 text-red-600 dark:text-red-400',
        text: 'text-red-700 dark:text-red-400',
      },
      warning: {
        bg: 'bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20',
        icon: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
        text: 'text-amber-700 dark:text-amber-400',
      },
      info: {
        bg: 'bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-900/30 dark:to-sky-900/20',
        icon: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
        text: 'text-blue-700 dark:text-blue-400',
      },
    };

    const styles = variantStyles[variant];

    if (loading) {
      return (
        <Card className={`${styles.bg} border-0 shadow-lg`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-14 w-14 rounded-2xl" />
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={`${styles.bg} border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className={`text-2xl font-bold ${styles.text} ${animate ? 'animate-pulse' : ''}`}>
                {value}
              </p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            <div className={`p-4 rounded-2xl ${styles.icon} shadow-inner`}>
              <Icon className="w-7 h-7" />
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
              animate={kpis.saldoLiquido < 0}
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
                    <CardTitle>Fluxo de Caixa Hierárquico</CardTitle>
                    <CardDescription>
                      Navegue pela hierarquia expandindo e colapsando os níveis
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">De:</label>
                    <input
                      type="month"
                      value={filterMesInicio}
                      onChange={(e) => setFilterMesInicio(e.target.value)}
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      data-testid="input-mes-inicio"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Até:</label>
                    <input
                      type="month"
                      value={filterMesFim}
                      onChange={(e) => setFilterMesFim(e.target.value)}
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      data-testid="input-mes-fim"
                    />
                  </div>
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
                <div className="overflow-x-auto relative rounded-lg border">
                  <div className="inline-block min-w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[350px] font-bold">
                            <div className="flex items-center gap-2">
                              <Receipt className="w-4 h-4" />
                              Categoria
                            </div>
                          </TableHead>
                          {dfcData.meses.map(mes => {
                            const [ano, mesNum] = mes.split('-');
                            const data = new Date(parseInt(ano), parseInt(mesNum) - 1);
                            const mesFormatado = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                            return (
                              <TableHead key={mes} className="text-center min-w-[130px] font-bold">
                                <div className="flex flex-col items-center">
                                  <span className="capitalize">{mesFormatado}</span>
                                </div>
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleItems.map((item, idx) => {
                          if (item.type === 'node') {
                            const node = item.node;
                            const hasParcelas = node.isLeaf && node.parcelas && node.parcelas.length > 0;
                            const isReceitaNode = isReceita(node.categoriaId);
                            const isRootNode = node.categoriaId === 'RECEITAS' || node.categoriaId === 'DESPESAS';
                            
                            const rowBg = isRootNode 
                              ? (isReceitaNode 
                                  ? 'bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent' 
                                  : 'bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent')
                              : '';
                            
                            return (
                              <TableRow 
                                key={node.categoriaId}
                                className={`transition-all duration-200 hover:bg-muted/50 ${rowBg}`}
                                data-testid={`dfc-row-${node.categoriaId}`}
                              >
                                <TableCell 
                                  className={`sticky left-0 z-10 ${isRootNode ? (isReceitaNode ? 'bg-green-500/10' : 'bg-red-500/10') : 'bg-background'}`}
                                  style={{ paddingLeft: `${node.nivel * 24 + 16}px` }}
                                >
                                  <div className="flex items-center gap-2">
                                    {!node.isLeaf || hasParcelas ? (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-7 w-7 rounded-lg transition-all duration-200 ${
                                          expanded.has(node.categoriaId) 
                                            ? 'bg-primary/10 text-primary rotate-0' 
                                            : 'hover:bg-muted'
                                        }`}
                                        onClick={() => toggleExpand(node.categoriaId)}
                                        data-testid={`button-toggle-${node.categoriaId}`}
                                      >
                                        {expanded.has(node.categoriaId) ? (
                                          <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 transition-transform duration-200" />
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
                                </TableCell>
                                {dfcData.meses.map(mes => {
                                  const valor = node.valuesByMonth[mes] || 0;
                                  const isPositive = valor > 0;
                                  return (
                                    <TableCell 
                                      key={mes} 
                                      className="text-center"
                                      data-testid={`dfc-cell-${node.categoriaId}-${mes}`}
                                    >
                                      {valor !== 0 ? (
                                        <span className={`
                                          ${!node.isLeaf ? 'font-bold' : 'font-medium'}
                                          ${isReceitaNode || isPositive 
                                            ? 'text-green-600 dark:text-green-400' 
                                            : 'text-red-600 dark:text-red-400'
                                          }
                                          ${isRootNode ? 'text-lg' : ''}
                                        `}>
                                          {formatCurrency(Math.abs(valor))}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground/40">—</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          } else {
                            const parcela = item.parcela;
                            const parentNode = item.parentNode;
                            const isReceitaParcela = isReceita(parentNode.categoriaId);
                            
                            return (
                              <TableRow 
                                key={`${parentNode.categoriaId}-parcela-${parcela.id}-${idx}`}
                                className={`transition-all duration-200 ${
                                  isReceitaParcela 
                                    ? 'bg-green-500/5 hover:bg-green-500/10' 
                                    : 'bg-red-500/5 hover:bg-red-500/10'
                                }`}
                                data-testid={`dfc-row-parcela-${parcela.id}-${parentNode.categoriaId}`}
                              >
                                <TableCell 
                                  className={`sticky left-0 z-10 ${
                                    isReceitaParcela ? 'bg-green-500/5' : 'bg-red-500/5'
                                  }`}
                                  style={{ paddingLeft: `${(parentNode.nivel + 1) * 24 + 16}px` }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      isReceitaParcela ? 'bg-green-500' : 'bg-red-500'
                                    }`} />
                                    <span className="text-sm text-muted-foreground">
                                      #{parcela.id} - {parcela.descricao || 'Sem descrição'}
                                    </span>
                                  </div>
                                </TableCell>
                                {dfcData.meses.map(mes => {
                                  const valor = parcela.mes === mes ? parcela.valorBruto : 0;
                                  return (
                                    <TableCell 
                                      key={mes} 
                                      className="text-center"
                                      data-testid={`dfc-cell-parcela-${parcela.id}-${mes}`}
                                    >
                                      {valor !== 0 ? (
                                        <Badge 
                                          variant="outline" 
                                          className={`font-medium ${
                                            isReceitaParcela 
                                              ? 'border-green-500/30 text-green-600 bg-green-500/10' 
                                              : 'border-red-500/30 text-red-600 bg-red-500/10'
                                          }`}
                                        >
                                          {formatCurrency(Math.abs(valor))}
                                        </Badge>
                                      ) : (
                                        <span className="text-muted-foreground/30">—</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          }
                        })}
                      </TableBody>
                    </Table>
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
