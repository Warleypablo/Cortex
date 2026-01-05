import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronDown, DollarSign, Users, TrendingUp, CirclePlus, CircleMinus } from "lucide-react";
import { format, startOfYear, endOfMonth, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContribuicaoDfcData {
  colaboradores: string[];
  receitas: {
    categoriaId: string;
    categoriaNome: string;
    valor: number;
    nivel: number;
    children: string[];
    isLeaf: boolean;
  }[];
  totais: {
    receitaTotal: number;
    quantidadeParcelas: number;
    quantidadeClientes: number;
  };
}

interface MonthlyData {
  mes: string;
  mesLabel: string;
  data: ContribuicaoDfcData | null;
}

export default function ContribuicaoColaborador() {
  usePageTitle("Contribuição por Colaborador");
  useSetPageInfo("Contribuição por Colaborador", "DFC do colaborador - Receitas atribuídas por responsável");
  
  const hoje = new Date();
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<string>("todos");
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
  
  const { data: colaboradoresData, isLoading: loadingColaboradores } = useQuery<string[]>({
    queryKey: ["/api/contribuicao-colaborador/dfc/colaboradores", anoSelecionado],
    queryFn: async () => {
      const dataInicio = `${anoSelecionado}-01-01`;
      const dataFim = `${anoSelecionado}-12-31`;
      const response = await fetch(`/api/contribuicao-colaborador/dfc?dataInicio=${dataInicio}&dataFim=${dataFim}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Falha ao buscar colaboradores");
      const data = await response.json();
      return data.colaboradores || [];
    },
  });

  const { data: monthlyResults, isLoading } = useQuery<MonthlyData[]>({
    queryKey: ["/api/contribuicao-colaborador/dfc/monthly", anoSelecionado, colaboradorSelecionado],
    queryFn: async () => {
      const results: MonthlyData[] = [];
      
      for (const mes of meses) {
        try {
          const params = new URLSearchParams({
            dataInicio: mes.dataInicio,
            dataFim: mes.dataFim
          });
          if (colaboradorSelecionado !== "todos") {
            params.append("responsavel", colaboradorSelecionado);
          }
          
          const response = await fetch(`/api/contribuicao-colaborador/dfc?${params.toString()}`, {
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

  const formatMesLabel = (label: string) => {
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Contribuição por Colaborador</h1>
          <p className="text-muted-foreground">DFC do colaborador - Receitas por categoria e período</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select 
            value={colaboradorSelecionado} 
            onValueChange={setColaboradorSelecionado}
          >
            <SelectTrigger className="w-[200px]" data-testid="select-colaborador">
              <SelectValue placeholder="Todos os colaboradores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os colaboradores</SelectItem>
              {colaboradoresData?.map((colab) => (
                <SelectItem key={colab} value={colab}>
                  {colab}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select 
            value={anoSelecionado.toString()} 
            onValueChange={(val) => setAnoSelecionado(parseInt(val))}
          >
            <SelectTrigger className="w-[100px]" data-testid="select-ano">
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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total do Ano</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-emerald-500" data-testid="text-receita-total">
                {formatCurrencyNoDecimals(totalReceitas)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {colaboradorSelecionado === "todos" ? "Todos os colaboradores" : colaboradorSelecionado}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaborador</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-colaborador">
                {colaboradorSelecionado === "todos" 
                  ? (colaboradoresData?.length || 0) 
                  : "1"}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {colaboradorSelecionado === "todos" ? "Com faturamento no período" : "Filtro aplicado"}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-media-mensal">
                {formatCurrencyNoDecimals(totalReceitas / 12)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Receita média por mês
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CirclePlus className="h-5 w-5 text-emerald-500" />
            DFC por Colaborador - Receitas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-[1200px]">
                <div className="grid border-b border-border" style={{ gridTemplateColumns: `250px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}>
                  <div className="p-3 font-semibold text-sm bg-muted/50 sticky left-0 z-10">
                    Categoria
                  </div>
                  {hierarchicalData.monthColumns.map((col) => (
                    <div key={col.mes} className="p-3 font-semibold text-sm text-right bg-muted/50">
                      {formatMesLabel(col.mesLabel)}
                    </div>
                  ))}
                </div>

                <div 
                  className="grid border-b-2 border-emerald-500/50 bg-emerald-500/10 cursor-pointer hover-elevate"
                  style={{ gridTemplateColumns: `250px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  onClick={() => toggleExpand("RECEITAS")}
                  data-testid="row-receitas-total"
                >
                  <div className="p-3 font-bold text-emerald-500 flex items-center gap-2 sticky left-0 z-10 bg-emerald-500/10">
                    {expanded.has("RECEITAS") ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <CirclePlus className="h-4 w-4" />
                    Receitas
                  </div>
                  {hierarchicalData.monthColumns.map((col) => (
                    <div key={col.mes} className="p-3 text-right font-bold text-emerald-500">
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
                      style={{ gridTemplateColumns: `250px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                      onClick={() => hasChildren && toggleExpand(category.id)}
                      data-testid={`row-categoria-${category.id}`}
                    >
                      <div 
                        className="p-3 flex items-center gap-2 sticky left-0 z-10 bg-background"
                        style={{ paddingLeft: `${12 + (indentLevel * 16)}px` }}
                      >
                        {hasChildren ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )
                        ) : (
                          <span className="w-4" />
                        )}
                        <span className={cn(
                          "text-sm",
                          indentLevel === 1 && "font-semibold"
                        )}>
                          {category.nome}
                        </span>
                      </div>
                      {hierarchicalData.monthColumns.map((col) => {
                        const valor = col.valorPorCategoria.get(category.id) || 0;
                        return (
                          <div key={col.mes} className="p-3 text-right text-sm">
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
