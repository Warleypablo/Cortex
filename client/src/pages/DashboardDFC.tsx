import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, ChevronRight, ChevronDown,
  Wallet, ArrowUpCircle, ArrowDownCircle, BarChart3, Banknote,
  Coins, CreditCard, LineChart, Minus
} from "lucide-react";
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import type { DfcHierarchicalResponse, DfcNode } from "@shared/schema";

export default function DashboardDFC() {
  const [filterDataInicio, setFilterDataInicio] = useState<string>("2025-01-01");
  const [filterDataFim, setFilterDataFim] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['RECEITAS', 'DESPESAS']));
  const [viewMode, setViewMode] = useState<'resumo' | 'detalhado'>('resumo');

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

  const kpis = useMemo(() => {
    if (!dfcData || !dfcData.nodes || dfcData.nodes.length === 0) {
      return {
        totalReceitas: 0,
        totalDespesas: 0,
        saldoLiquido: 0,
        margemOperacional: 0,
      };
    }
    
    const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
    const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');
    
    let totalReceitas = 0;
    let totalDespesas = 0;
    
    dfcData.meses.forEach(mes => {
      totalReceitas += (receitasNode?.valuesByMonth[mes] || 0);
      totalDespesas += Math.abs(despesasNode?.valuesByMonth[mes] || 0);
    });

    const saldoLiquido = totalReceitas - totalDespesas;
    const margemOperacional = totalReceitas > 0 ? (saldoLiquido / totalReceitas) * 100 : 0;

    return { 
      totalReceitas,
      totalDespesas,
      saldoLiquido,
      margemOperacional,
    };
  }, [dfcData]);

  const chartData = useMemo(() => {
    if (!dfcData || !dfcData.nodes || dfcData.nodes.length === 0) return [];
    
    const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
    const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');
    
    let saldoAcumulado = 0;
    
    return dfcData.meses.map(mes => {
      const [ano, mesNum] = mes.split('-');
      const data = new Date(parseInt(ano), parseInt(mesNum) - 1);
      const mesLabel = data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const anoLabel = ano.slice(2);
      
      const receitas = receitasNode?.valuesByMonth[mes] || 0;
      const despesas = Math.abs(despesasNode?.valuesByMonth[mes] || 0);
      const saldo = receitas - despesas;
      saldoAcumulado += saldo;
      
      return {
        mes: `${mesLabel}/${anoLabel}`,
        receitas,
        despesas,
        saldo,
        saldoAcumulado,
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
    if (categoriaId === 'DESPESAS') return false;
    const prefix = categoriaId.substring(0, 2);
    return prefix === '03' || prefix === '04';
  };

  const getVisibleNodes = (): DfcNode[] => {
    if (!dfcData || !dfcData.nodes || !dfcData.rootIds) return [];

    const nodeMap = new Map(dfcData.nodes.map(n => [n.categoriaId, n]));
    const result: DfcNode[] = [];

    const addNode = (id: string) => {
      const node = nodeMap.get(id);
      if (!node) return;
      result.push(node);
      
      if (expanded.has(id) && node.children && node.children.length > 0) {
        node.children.forEach(childId => addNode(childId));
      }
    };

    dfcData.rootIds.forEach(id => addNode(id));
    return result;
  };

  const visibleNodes = getVisibleNodes();

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold" data-testid="text-page-title">
                DFC - Fluxo de Caixa
              </h1>
              <p className="text-sm text-muted-foreground">
                Análise financeira por categoria
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
              <label className="text-xs font-medium text-muted-foreground px-2">De:</label>
              <input
                type="date"
                value={filterDataInicio}
                onChange={(e) => setFilterDataInicio(e.target.value)}
                className="h-8 rounded-md border-0 bg-background px-2 text-sm focus:ring-2 focus:ring-primary/20"
                data-testid="input-data-inicio"
              />
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
              <label className="text-xs font-medium text-muted-foreground px-2">Até:</label>
              <input
                type="date"
                value={filterDataFim}
                onChange={(e) => setFilterDataFim(e.target.value)}
                className="h-8 rounded-md border-0 bg-background px-2 text-sm focus:ring-2 focus:ring-primary/20"
                data-testid="input-data-fim"
              />
            </div>
            {(filterDataInicio !== "2025-01-01" || filterDataFim) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterDataInicio("2025-01-01");
                  setFilterDataFim("");
                }}
                data-testid="button-limpar-filtros"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isLoading ? (
              <>
                {[1,2,3,4].map(i => (
                  <Card key={i} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-7 w-28" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-green-700 dark:text-green-400">Entradas</p>
                        <p className="text-lg font-bold text-green-800 dark:text-green-300 mt-1">
                          {formatCurrencyCompact(kpis.totalReceitas)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <ArrowUpCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-red-700 dark:text-red-400">Saídas</p>
                        <p className="text-lg font-bold text-red-800 dark:text-red-300 mt-1">
                          {formatCurrencyCompact(kpis.totalDespesas)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-red-500/20">
                        <ArrowDownCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-0 shadow-sm ${
                  kpis.saldoLiquido >= 0 
                    ? 'bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/40 dark:to-sky-950/30'
                    : 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/30'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xs font-medium ${kpis.saldoLiquido >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
                          Saldo Líquido
                        </p>
                        <p className={`text-lg font-bold mt-1 ${kpis.saldoLiquido >= 0 ? 'text-blue-800 dark:text-blue-300' : 'text-orange-800 dark:text-orange-300'}`}>
                          {formatCurrencyCompact(kpis.saldoLiquido)}
                        </p>
                      </div>
                      <div className={`p-2 rounded-lg ${kpis.saldoLiquido >= 0 ? 'bg-blue-500/20' : 'bg-orange-500/20'}`}>
                        <Wallet className={`w-5 h-5 ${kpis.saldoLiquido >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Margem Operacional</p>
                        <p className="text-lg font-bold text-purple-800 dark:text-purple-300 mt-1">
                          {kpis.margemOperacional.toFixed(1)}%
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        {kpis.margemOperacional >= 0 ? (
                          <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {!isLoading && chartData.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base">Evolução Mensal</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Receitas vs Despesas com saldo acumulado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis 
                      dataKey="mes" 
                      tick={{ fill: 'currentColor', fontSize: 11 }}
                      axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fill: 'currentColor', fontSize: 11 }} 
                      tickFormatter={formatCurrencyCompact}
                      axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: 'currentColor', fontSize: 11 }} 
                      tickFormatter={formatCurrencyCompact}
                      axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          receitas: 'Entradas',
                          despesas: 'Saídas',
                          saldoAcumulado: 'Saldo Acumulado'
                        };
                        return [formatCurrency(value), labels[name] || name];
                      }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend 
                      formatter={(value: string) => {
                        const labels: Record<string, string> = {
                          receitas: 'Entradas',
                          despesas: 'Saídas',
                          saldoAcumulado: 'Saldo Acumulado'
                        };
                        return labels[value] || value;
                      }}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                    <ReferenceLine y={0} yAxisId="right" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Bar 
                      yAxisId="left"
                      dataKey="receitas" 
                      fill="#22c55e" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="despesas" 
                      fill="#ef4444" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="saldoAcumulado" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base">Detalhamento por Categoria</CardTitle>
                </div>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'resumo' | 'detalhado')} data-testid="tabs-view-mode">
                  <TabsList>
                    <TabsTrigger value="resumo" data-testid="tab-resumo">Resumo</TabsTrigger>
                    <TabsTrigger value="detalhado" data-testid="tab-detalhado">Detalhado</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-3" data-testid="loading-dfc">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">Carregando...</span>
                </div>
              ) : !dfcData || visibleNodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <DollarSign className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Nenhum dado disponível</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="sticky left-0 z-20 bg-muted/50 text-left p-3 font-medium border-r min-w-[280px]">
                            Categoria
                          </th>
                          {dfcData.meses.map(mes => {
                            const [ano, mesNum] = mes.split('-');
                            const data = new Date(parseInt(ano), parseInt(mesNum) - 1);
                            return (
                              <th 
                                key={mes} 
                                className="text-right p-3 font-medium min-w-[110px] whitespace-nowrap"
                              >
                                {data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} {ano.slice(2)}
                              </th>
                            );
                          })}
                          <th className="text-right p-3 font-medium min-w-[120px] bg-muted/30 border-l">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleNodes
                          .filter(node => viewMode === 'detalhado' || node.nivel <= 1)
                          .map((node) => {
                            const isReceitaNode = isReceita(node.categoriaId);
                            const isRootNode = node.categoriaId === 'RECEITAS' || node.categoriaId === 'DESPESAS';
                            const hasChildren = node.children && node.children.length > 0;
                            
                            let total = 0;
                            dfcData.meses.forEach(mes => {
                              total += node.valuesByMonth[mes] || 0;
                            });

                            const rowBg = isRootNode 
                              ? (isReceitaNode ? 'bg-green-50/80 dark:bg-green-950/30' : 'bg-red-50/80 dark:bg-red-950/30')
                              : node.nivel === 1 
                                ? 'bg-muted/20' 
                                : '';
                            
                            return (
                              <tr 
                                key={node.categoriaId}
                                className={`${rowBg} border-t hover:bg-muted/30 transition-colors`}
                                data-testid={`dfc-row-${node.categoriaId}`}
                              >
                                <td 
                                  className={`sticky left-0 z-10 p-3 border-r ${rowBg || 'bg-background'}`}
                                  style={{ paddingLeft: `${node.nivel * 16 + 12}px` }}
                                >
                                  <div className="flex items-center gap-2">
                                    {(hasChildren || (viewMode === 'detalhado' && node.nivel < 2)) ? (
                                      <Button
                                        variant="ghost"
                                        size="icon"
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
                                      <span className="w-9 flex justify-center">
                                        {isReceitaNode ? (
                                          <Coins className="w-3.5 h-3.5 text-green-500" />
                                        ) : (
                                          <CreditCard className="w-3.5 h-3.5 text-red-500" />
                                        )}
                                      </span>
                                    )}
                                    <span className={`${isRootNode || node.nivel <= 1 ? 'font-semibold' : ''} ${
                                      isRootNode 
                                        ? (isReceitaNode ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')
                                        : ''
                                    }`}>
                                      {node.categoriaId === 'RECEITAS' && (
                                        <ArrowUpCircle className="w-4 h-4 inline mr-1.5 text-green-500" />
                                      )}
                                      {node.categoriaId === 'DESPESAS' && (
                                        <ArrowDownCircle className="w-4 h-4 inline mr-1.5 text-red-500" />
                                      )}
                                      {node.categoriaNome}
                                    </span>
                                  </div>
                                </td>
                                {dfcData.meses.map(mes => {
                                  const valor = node.valuesByMonth[mes] || 0;
                                  return (
                                    <td 
                                      key={`${node.categoriaId}-${mes}`}
                                      className="text-right p-3 tabular-nums"
                                      data-testid={`dfc-cell-${node.categoriaId}-${mes}`}
                                    >
                                      {valor !== 0 ? (
                                        <span className={isRootNode || node.nivel <= 1 ? 'font-semibold' : ''}>
                                          {formatCurrency(Math.abs(valor))}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground/40">
                                          <Minus className="w-3 h-3 inline" />
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="text-right p-3 font-semibold tabular-nums bg-muted/20 border-l">
                                  {total !== 0 ? formatCurrency(Math.abs(total)) : (
                                    <span className="text-muted-foreground/40">
                                      <Minus className="w-3 h-3 inline" />
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                        <tr className="bg-primary/5 border-t-2 border-primary/20 font-bold">
                          <td className="sticky left-0 z-10 p-3 border-r bg-primary/5">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-primary" />
                              <span>SALDO DO PERÍODO</span>
                            </div>
                          </td>
                          {dfcData.meses.map(mes => {
                            const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
                            const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');
                            const receitas = receitasNode?.valuesByMonth[mes] || 0;
                            const despesas = Math.abs(despesasNode?.valuesByMonth[mes] || 0);
                            const saldo = receitas - despesas;
                            
                            return (
                              <td 
                                key={`saldo-${mes}`}
                                className={`text-right p-3 tabular-nums ${saldo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                              >
                                {formatCurrency(saldo)}
                              </td>
                            );
                          })}
                          <td className={`text-right p-3 tabular-nums bg-muted/20 border-l ${kpis.saldoLiquido >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(kpis.saldoLiquido)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
