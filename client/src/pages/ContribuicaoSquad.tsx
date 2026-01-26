import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronDown, DollarSign, Users, TrendingUp, CirclePlus, FileText, Percent, PieChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { format, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContribuicaoSquadData {
  squads: string[];
  receitas: {
    categoriaId: string;
    categoriaNome: string;
    valor: number;
    nivel: number;
  }[];
  totais: {
    receitaTotal: number;
    quantidadeParcelas: number;
    quantidadeContratos: number;
  };
}

interface MonthlyData {
  mes: string;
  mesLabel: string;
  data: ContribuicaoSquadData | null;
}

export default function ContribuicaoSquad() {
  usePageTitle("Contribuição por Squad");
  useSetPageInfo("Contribuição por Squad", "Receitas atribuídas por squad do contrato");
  
  const hoje = new Date();
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  const [squadSelecionado, setSquadSelecionado] = useState<string>("todos");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["RECEITAS"]));
  
  const meses = useMemo(() => {
    const result: { mes: string; mesLabel: string; dataInicio: string; dataFim: string }[] = [];
    for (let m = 0; m < 12; m++) {
      const start = new Date(anoSelecionado, m, 1);
      const end = endOfMonth(start);
      result.push({
        mes: format(start, "yyyy-MM"),
        mesLabel: format(start, "MMM. 'de' yy", { locale: ptBR }),
        dataInicio: format(start, "yyyy-MM-dd"),
        dataFim: format(end, "yyyy-MM-dd")
      });
    }
    return result;
  }, [anoSelecionado]);
  
  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i);
  
  const { data: squadsData, isLoading: loadingSquads } = useQuery<string[]>({
    queryKey: ["/api/contribuicao-squad/dfc/squads", anoSelecionado],
    queryFn: async () => {
      const dataInicio = `${anoSelecionado}-01-01`;
      const dataFim = `${anoSelecionado}-12-31`;
      const response = await fetch(`/api/contribuicao-squad/dfc?dataInicio=${dataInicio}&dataFim=${dataFim}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Falha ao buscar squads");
      const data = await response.json();
      return data.squads || [];
    },
  });

  const { data: monthlyResults, isLoading } = useQuery<MonthlyData[]>({
    queryKey: ["/api/contribuicao-squad/dfc/monthly", anoSelecionado, squadSelecionado],
    queryFn: async () => {
      const results: MonthlyData[] = [];
      
      for (const mes of meses) {
        try {
          const params = new URLSearchParams({
            dataInicio: mes.dataInicio,
            dataFim: mes.dataFim
          });
          if (squadSelecionado !== "todos") {
            params.append("squad", squadSelecionado);
          }
          
          const response = await fetch(`/api/contribuicao-squad/dfc?${params.toString()}`, {
            credentials: "include"
          });
          
          if (response.ok) {
            const data = await response.json();
            results.push({
              mes: mes.mes,
              mesLabel: mes.mesLabel,
              data
            });
          } else {
            results.push({ mes: mes.mes, mesLabel: mes.mesLabel, data: null });
          }
        } catch {
          results.push({ mes: mes.mes, mesLabel: mes.mesLabel, data: null });
        }
      }
      
      return results;
    },
  });

  const hierarchicalData = useMemo(() => {
    if (!monthlyResults) return { categories: [], monthColumns: [] };
    
    const allCategoriesMap = new Map<string, { id: string; nome: string; nivel: number }>();
    
    for (const monthData of monthlyResults) {
      if (monthData.data?.receitas) {
        for (const receita of monthData.data.receitas) {
          if (!allCategoriesMap.has(receita.categoriaId)) {
            allCategoriesMap.set(receita.categoriaId, {
              id: receita.categoriaId,
              nome: receita.categoriaNome,
              nivel: receita.nivel
            });
          }
        }
      }
    }
    
    const categoriesByLevel: { id: string; nome: string; nivel: number; parentId: string | null }[] = [];
    
    Array.from(allCategoriesMap.entries()).forEach(([id, cat]) => {
      const parts = id.split(".");
      const parentId = parts.length > 1 ? parts.slice(0, -1).join(".") : null;
      categoriesByLevel.push({ ...cat, parentId });
    });
    
    categoriesByLevel.sort((a, b) => {
      if (a.nivel !== b.nivel) return a.nivel - b.nivel;
      return a.id.localeCompare(b.id);
    });
    
    const monthColumns = monthlyResults.map(m => ({
      mes: m.mes,
      mesLabel: m.mesLabel,
      valorPorCategoria: new Map<string, number>(),
      receitaTotal: m.data?.totais?.receitaTotal || 0
    }));
    
    for (let i = 0; i < monthlyResults.length; i++) {
      const monthData = monthlyResults[i];
      if (monthData.data?.receitas) {
        for (const receita of monthData.data.receitas) {
          monthColumns[i].valorPorCategoria.set(receita.categoriaId, receita.valor);
        }
      }
    }
    
    return {
      categories: categoriesByLevel,
      monthColumns
    };
  }, [monthlyResults]);

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

  const isVisible = (categoryId: string, parentId: string | null): boolean => {
    if (!parentId) return true;
    if (!expanded.has(parentId)) return false;
    const grandParentParts = parentId.split(".");
    if (grandParentParts.length > 1) {
      const grandParentId = grandParentParts.slice(0, -1).join(".");
      return isVisible(parentId, grandParentId);
    }
    return true;
  };

  const totalReceitas = useMemo(() => {
    return hierarchicalData.monthColumns.reduce((acc, col) => acc + col.receitaTotal, 0);
  }, [hierarchicalData]);

  const totalContratos = useMemo(() => {
    if (!monthlyResults) return 0;
    return monthlyResults.reduce((acc, m) => acc + (m.data?.totais?.quantidadeContratos || 0), 0);
  }, [monthlyResults]);

  const TAXA_IMPOSTO = 0.18;

  interface SquadContribuicao {
    squad: string;
    valorBruto: number;
    valorLiquido: number;
    percentualBruto: number;
    percentualLiquido: number;
    quantidadeParcelas?: number;
  }

  const { data: totaisPorSquadData, isLoading: loadingTotaisPorSquad } = useQuery<{
    squads: SquadContribuicao[];
    totalBruto: number;
    totalLiquido: number;
  }>({
    queryKey: ["/api/contribuicao-squad/totais-por-squad", anoSelecionado],
    queryFn: async () => {
      const dataInicio = `${anoSelecionado}-01-01`;
      const dataFim = `${anoSelecionado}-12-31`;
      const response = await fetch(`/api/contribuicao-squad/totais-por-squad?dataInicio=${dataInicio}&dataFim=${dataFim}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Falha ao buscar totais por squad");
      return response.json();
    },
  });

  const contribuicaoPorSquad = useMemo(() => {
    if (squadSelecionado === 'todos') {
      return totaisPorSquadData?.squads || [];
    } else {
      const squadData = totaisPorSquadData?.squads?.find(s => s.squad === squadSelecionado);
      if (squadData) {
        return [{
          ...squadData,
          percentualBruto: 100,
          percentualLiquido: 100
        }];
      }
      return [];
    }
  }, [totaisPorSquadData, squadSelecionado]);

  const totalReceitaLiquida = useMemo(() => {
    return totaisPorSquadData?.totalLiquido || totalReceitas * (1 - TAXA_IMPOSTO);
  }, [totaisPorSquadData, totalReceitas]);
  
  const totalReceitaBruta = useMemo(() => {
    return totaisPorSquadData?.totalBruto || totalReceitas;
  }, [totaisPorSquadData, totalReceitas]);

  const formatMesLabel = (label: string) => {
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  
  const squadColors = [
    'hsl(142, 76%, 36%)',
    'hsl(217, 91%, 60%)', 
    'hsl(262, 83%, 58%)',
    'hsl(24, 95%, 53%)',
    'hsl(340, 82%, 52%)',
    'hsl(47, 96%, 53%)',
    'hsl(173, 80%, 40%)',
    'hsl(291, 64%, 42%)',
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Contribuição por Squad</h1>
          <p className="text-sm text-muted-foreground">Receitas por produto/serviço e período (squad do contrato)</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select 
            value={squadSelecionado} 
            onValueChange={setSquadSelecionado}
          >
            <SelectTrigger className="w-[180px]" data-testid="select-squad">
              <SelectValue placeholder="Todos os squads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os squads</SelectItem>
              {squadsData?.map((sq) => (
                <SelectItem key={sq} value={sq}>
                  {sq}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select 
            value={anoSelecionado.toString()} 
            onValueChange={(val) => setAnoSelecionado(parseInt(val))}
          >
            <SelectTrigger className="w-[90px]" data-testid="select-ano">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anos.map((ano) => (
                <SelectItem key={ano} value={ano.toString()}>
                  {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-4 py-2 pb-1">
            <CardTitle className="text-xs font-medium">Receita Total do Ano</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {isLoading ? (
              <Skeleton className="h-6 w-28" />
            ) : (
              <div className="text-xl font-bold text-emerald-500" data-testid="text-receita-total">
                {formatCurrencyNoDecimals(totalReceitas)}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {squadSelecionado === "todos" ? "Todos os squads" : squadSelecionado}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-4 py-2 pb-1">
            <CardTitle className="text-xs font-medium">Squads</CardTitle>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <div className="text-xl font-bold" data-testid="text-squads">
                {squadSelecionado === "todos" 
                  ? (squadsData?.length || 0) 
                  : "1"}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {squadSelecionado === "todos" ? "Com faturamento no período" : "Filtro aplicado"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-4 py-2 pb-1">
            <CardTitle className="text-xs font-medium">Contratos Ativos</CardTitle>
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <div className="text-xl font-bold" data-testid="text-contratos">
                {totalContratos}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Relacionados às parcelas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-4 py-2 pb-1">
            <CardTitle className="text-xs font-medium">Média Mensal</CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <div className="text-xl font-bold" data-testid="text-media-mensal">
                {formatCurrencyNoDecimals(totalReceitas / 12)}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Receita média por mês
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="h-4 w-4 text-blue-500" />
            Contribuição Percentual por Squad
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading || loadingTotaisPorSquad ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="bruto" className="w-full">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <TabsList>
                  <TabsTrigger value="bruto" data-testid="tab-bruto">
                    <DollarSign className="h-3.5 w-3.5 mr-1" />
                    Antes dos Impostos
                  </TabsTrigger>
                  <TabsTrigger value="liquido" data-testid="tab-liquido">
                    <Percent className="h-3.5 w-3.5 mr-1" />
                    Após Impostos (-18%)
                  </TabsTrigger>
                </TabsList>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Total Bruto:</span> {formatCurrencyNoDecimals(totalReceitaBruta)}
                  <span className="mx-2">|</span>
                  <span className="font-medium">Total Líquido:</span> {formatCurrencyNoDecimals(totalReceitaLiquida)}
                </div>
              </div>
              
              <TabsContent value="bruto" className="space-y-3">
                {contribuicaoPorSquad.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum squad com receitas no período</p>
                ) : (
                  contribuicaoPorSquad.map((item, index) => (
                    <div key={item.squad} className="space-y-1.5" data-testid={`contrib-bruto-${index}`}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-sm" 
                            style={{ backgroundColor: squadColors[index % squadColors.length] }}
                          />
                          <span className="font-medium">{item.squad}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{formatCurrencyNoDecimals(item.valorBruto)}</span>
                          <span className="font-bold text-emerald-500 min-w-[50px] text-right">
                            {item.percentualBruto.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={item.percentualBruto} 
                        className="h-2"
                        style={{ 
                          ['--progress-background' as any]: squadColors[index % squadColors.length]
                        }}
                      />
                    </div>
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="liquido" className="space-y-3">
                {contribuicaoPorSquad.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum squad com receitas no período</p>
                ) : (
                  contribuicaoPorSquad.map((item, index) => (
                    <div key={item.squad} className="space-y-1.5" data-testid={`contrib-liquido-${index}`}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-sm" 
                            style={{ backgroundColor: squadColors[index % squadColors.length] }}
                          />
                          <span className="font-medium">{item.squad}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{formatCurrencyNoDecimals(item.valorLiquido)}</span>
                          <span className="font-bold text-blue-500 min-w-[50px] text-right">
                            {item.percentualLiquido.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={item.percentualLiquido} 
                        className="h-2"
                        style={{ 
                          ['--progress-background' as any]: squadColors[index % squadColors.length]
                        }}
                      />
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CirclePlus className="h-4 w-4 text-emerald-500" />
            Receitas por Squad - Produto/Serviço
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-[1024px]">
                <div className="grid border-b border-border" style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}>
                  <div className="px-2 py-1.5 font-semibold text-xs bg-muted/50 sticky left-0 z-10">
                    Produto/Serviço
                  </div>
                  {hierarchicalData.monthColumns.map((col) => (
                    <div key={col.mes} className="px-2 py-1.5 font-semibold text-xs text-right bg-muted/50">
                      {formatMesLabel(col.mesLabel)}
                    </div>
                  ))}
                </div>

                <div 
                  className="grid border-b-2 border-emerald-500/50 bg-emerald-500/10 cursor-pointer hover-elevate"
                  style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  onClick={() => toggleExpand("RECEITAS")}
                  data-testid="row-receitas-total"
                >
                  <div className="px-2 py-1.5 font-bold text-sm text-emerald-500 flex items-center gap-1.5 sticky left-0 z-10 bg-emerald-500/10">
                    {expanded.has("RECEITAS") ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    <CirclePlus className="h-3.5 w-3.5" />
                    Receitas
                  </div>
                  {hierarchicalData.monthColumns.map((col) => (
                    <div key={col.mes} className="px-2 py-1.5 text-right text-sm font-bold text-emerald-500">
                      {formatCurrencyNoDecimals(col.receitaTotal)}
                    </div>
                  ))}
                </div>

                {expanded.has("RECEITAS") && hierarchicalData.categories.map((category) => {
                  const isExpanded = expanded.has(category.id);
                  const hasChildren = hierarchicalData.categories.some(c => c.parentId === category.id);
                  const visible = isVisible(category.id, category.parentId);
                  
                  if (!visible) return null;
                  
                  const indentLevel = category.id.split(".").length;
                  
                  return (
                    <div 
                      key={category.id}
                      className={cn(
                        "grid border-b border-border/50 hover-elevate",
                        hasChildren && "cursor-pointer"
                      )}
                      style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                      onClick={() => hasChildren && toggleExpand(category.id)}
                      data-testid={`row-categoria-${category.id}`}
                    >
                      <div 
                        className="px-2 py-1 flex items-center gap-1.5 sticky left-0 z-10 bg-background"
                        style={{ paddingLeft: `${8 + (indentLevel * 12)}px` }}
                      >
                        {hasChildren ? (
                          isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )
                        ) : (
                          <span className="w-3.5" />
                        )}
                        <span className={cn(
                          "text-xs",
                          indentLevel === 1 && "font-semibold"
                        )}>
                          {category.nome}
                        </span>
                      </div>
                      {hierarchicalData.monthColumns.map((col) => {
                        const valor = col.valorPorCategoria.get(category.id) || 0;
                        return (
                          <div key={col.mes} className="px-2 py-1 text-right text-xs">
                            {valor > 0 ? formatCurrencyNoDecimals(valor) : "-"}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
