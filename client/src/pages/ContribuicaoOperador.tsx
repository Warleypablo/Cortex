import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals, formatPercent, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronDown, DollarSign, Users, TrendingUp, CirclePlus, CircleMinus, FileText, Trophy, Calendar } from "lucide-react";
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
  despesas: {
    categoriaId: string;
    categoriaNome: string;
    valor: number;
    nivel: number;
  }[];
  totais: {
    receitaTotal: number;
    despesaTotal: number;
    resultado: number;
    quantidadeParcelas: number;
    quantidadeContratos: number;
  };
}

interface MonthlyData {
  mes: string;
  mesLabel: string;
  data: ContribuicaoSquadData | null;
}

interface RankingSquadItem {
  squad: string;
  receita: number;
  despesa: number;
  resultadoBruto: number;
  impostos: number;
  contribuicao: number;
  margem: number;
}

interface RankingData {
  ranking: RankingSquadItem[];
  totais: {
    receita: number;
    despesa: number;
    resultadoBruto: number;
    impostos: number;
    contribuicao: number;
  };
}

const isOffSquad = (squad: string) => /\bOFF\b/i.test(squad);

export default function ContribuicaoOperador() {
  usePageTitle("Contribuição por Squad");
  useSetPageInfo("Contribuição por Squad", "Receitas atribuídas por squad do contrato");
  
  const hoje = new Date();
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState<string>("todos");
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

  // Datas do período selecionado (mês específico ou ano inteiro)
  const periodoSelecionado = useMemo(() => {
    if (mesSelecionado === "todos") {
      return { dataInicio: `${anoSelecionado}-01-01`, dataFim: `${anoSelecionado}-12-31` };
    }
    const mesIndex = parseInt(mesSelecionado);
    const mesData = meses[mesIndex];
    return { dataInicio: mesData.dataInicio, dataFim: mesData.dataFim };
  }, [anoSelecionado, mesSelecionado, meses]);

  const labelPeriodo = useMemo(() => {
    if (mesSelecionado === "todos") return "do Ano";
    const mesIndex = parseInt(mesSelecionado);
    const label = meses[mesIndex]?.mesLabel || "";
    return `de ${label.charAt(0).toUpperCase() + label.slice(1)}`;
  }, [mesSelecionado, meses]);
  
  const { data: filterData, isLoading: loadingFilters } = useQuery<{ squads: string[] }>({
    queryKey: ["/api/contribuicao-squad/dfc/filters", anoSelecionado],
    queryFn: async () => {
      const dataInicio = `${anoSelecionado}-01-01`;
      const dataFim = `${anoSelecionado}-12-31`;
      const params = new URLSearchParams({ dataInicio, dataFim });
      const response = await fetch(`/api/contribuicao-squad/dfc?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Falha ao buscar filtros");
      const data = await response.json();
      return { squads: data.squads || [] };
    },
  });

  const visibleSquads = useMemo(
    () => (filterData?.squads ?? []).filter((squad) => !isOffSquad(squad)),
    [filterData?.squads]
  );

  const handleSquadChange = (value: string) => {
    setSquadSelecionado(value);
  };

  // Query para ranking de todos os squads (exibido quando "todos" está selecionado)
  const { data: rankingData, isLoading: loadingRanking } = useQuery<RankingData>({
    queryKey: ["/api/contribuicao-squad/ranking", anoSelecionado, mesSelecionado],
    queryFn: async () => {
      const params = new URLSearchParams({
        dataInicio: periodoSelecionado.dataInicio,
        dataFim: periodoSelecionado.dataFim
      });
      const response = await fetch(`/api/contribuicao-squad/ranking?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Falha ao buscar ranking");
      return response.json();
    },
    enabled: squadSelecionado === "todos",
  });

  const visibleRanking = useMemo(
    () => (rankingData?.ranking ?? []).filter((item) => !isOffSquad(item.squad)),
    [rankingData?.ranking]
  );

  const rankingTotals = useMemo(() => {
    return visibleRanking.reduce(
      (acc, item) => ({
        receita: acc.receita + item.receita,
        despesa: acc.despesa + item.despesa,
        resultadoBruto: acc.resultadoBruto + item.resultadoBruto,
        impostos: acc.impostos + item.impostos,
        contribuicao: acc.contribuicao + item.contribuicao
      }),
      { receita: 0, despesa: 0, resultadoBruto: 0, impostos: 0, contribuicao: 0 }
    );
  }, [visibleRanking]);

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
    if (!monthlyResults) return { categories: [], despesas: [], monthColumns: [] };
    
    const allCategoriesMap = new Map<string, { id: string; nome: string; nivel: number }>();
    const allDespesasMap = new Map<string, { id: string; nome: string; nivel: number }>();
    
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
      if (monthData.data?.despesas) {
        for (const despesa of monthData.data.despesas) {
          if (!allDespesasMap.has(despesa.categoriaId)) {
            allDespesasMap.set(despesa.categoriaId, {
              id: despesa.categoriaId,
              nome: despesa.categoriaNome,
              nivel: despesa.nivel
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
    
    // Ordenar hierarquicamente: filhos aparecem logo após o pai
    categoriesByLevel.sort((a, b) => {
      const partsA = a.id.split(".");
      const partsB = b.id.split(".");
      
      const minLen = Math.min(partsA.length, partsB.length);
      for (let i = 0; i < minLen; i++) {
        if (partsA[i] !== partsB[i]) {
          const numA = parseFloat(partsA[i]);
          const numB = parseFloat(partsB[i]);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return partsA[i].localeCompare(partsB[i]);
        }
      }
      
      return partsA.length - partsB.length;
    });

    const despesasByLevel: { id: string; nome: string; nivel: number; parentId: string | null }[] = [];
    
    Array.from(allDespesasMap.entries()).forEach(([id, cat]) => {
      const parts = id.split(".");
      const parentId = parts.length > 1 ? parts.slice(0, -1).join(".") : null;
      despesasByLevel.push({ ...cat, parentId });
    });
    
    // Ordenar hierarquicamente: Salários > CXCS > Freelancers > Benefícios (SEM IMPOSTOS - vai ser linha separada)
    const despesaOrder: Record<string, number> = {
      'SALARIOS': 1,
      'CXCS': 2,
      'FREELANCERS': 3,
      'BENEFICIOS': 4
    };
    
    // Filtrar IMPOSTOS das despesas - será exibido como linha principal separada
    const despesasSemImpostos = despesasByLevel.filter(d => !d.id.toUpperCase().includes('IMPOSTOS'));
    
    despesasByLevel.sort((a, b) => {
      const partsA = a.id.split(".");
      const partsB = b.id.split(".");
      
      const minLen = Math.min(partsA.length, partsB.length);
      for (let i = 0; i < minLen; i++) {
        if (partsA[i] !== partsB[i]) {
          const orderA = despesaOrder[partsA[i]] || 99;
          const orderB = despesaOrder[partsB[i]] || 99;
          if (orderA !== orderB) return orderA - orderB;
          return partsA[i].localeCompare(partsB[i]);
        }
      }
      
      return partsA.length - partsB.length;
    });

    const monthColumns = monthlyResults.map(m => {
      // Calcular despesa SEM impostos
      let despesaSemImpostos = 0;
      if (m.data?.despesas) {
        for (const despesa of m.data.despesas) {
          if (!despesa.categoriaId.toUpperCase().includes('IMPOSTOS')) {
            despesaSemImpostos += despesa.valor;
          }
        }
      }
      const receita = m.data?.totais?.receitaTotal || 0;
      const resultadoBruto = receita - despesaSemImpostos;
      const impostos = receita * 0.18; // 18% sobre Receita
      const resultadoLiquido = resultadoBruto - impostos;
      
      return {
        mes: m.mes,
        mesLabel: m.mesLabel,
        valorPorCategoria: new Map<string, number>(),
        valorPorDespesa: new Map<string, number>(),
        receitaTotal: receita,
        despesaTotal: despesaSemImpostos, // Despesas SEM impostos
        resultadoBruto,
        impostos,
        resultadoLiquido
      };
    });
    
    for (let i = 0; i < monthlyResults.length; i++) {
      const monthData = monthlyResults[i];
      if (monthData.data?.receitas) {
        for (const receita of monthData.data.receitas) {
          monthColumns[i].valorPorCategoria.set(receita.categoriaId, receita.valor);
        }
      }
      if (monthData.data?.despesas) {
        for (const despesa of monthData.data.despesas) {
          monthColumns[i].valorPorDespesa.set(despesa.categoriaId, despesa.valor);
        }
      }
    }
    
    return {
      categories: categoriesByLevel,
      despesas: despesasSemImpostos, // Usar despesas SEM impostos
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
    if (mesSelecionado !== "todos") {
      const mesIndex = parseInt(mesSelecionado);
      const col = hierarchicalData.monthColumns[mesIndex];
      return col?.receitaTotal || 0;
    }
    return hierarchicalData.monthColumns.reduce((acc, col) => acc + col.receitaTotal, 0);
  }, [hierarchicalData, mesSelecionado]);

  const totalContratos = useMemo(() => {
    if (!monthlyResults) return 0;
    if (mesSelecionado !== "todos") {
      const mesIndex = parseInt(mesSelecionado);
      return monthlyResults[mesIndex]?.data?.totais?.quantidadeContratos || 0;
    }
    return monthlyResults.reduce((acc, m) => acc + (m.data?.totais?.quantidadeContratos || 0), 0);
  }, [monthlyResults, mesSelecionado]);

  const mesesComDados = useMemo(() => {
    return hierarchicalData.monthColumns.filter(col => col.receitaTotal > 0).length;
  }, [hierarchicalData]);

  const formatMesLabel = (label: string) => {
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Contribuição por Squad</h1>
          <p className="text-muted-foreground">Receitas por squad do contrato - baseado em parcelas quitadas</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select
            value={squadSelecionado}
            onValueChange={handleSquadChange}
          >
            <SelectTrigger className="w-[180px]" data-testid="select-squad">
              <SelectValue placeholder="Todos os squads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os squads</SelectItem>
              {visibleSquads.map((sq) => (
                <SelectItem key={sq} value={sq}>
                  {sq}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={mesSelecionado}
            onValueChange={setMesSelecionado}
          >
            <SelectTrigger className="w-[150px]" data-testid="select-mes">
              <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Todos os meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Ano inteiro</SelectItem>
              {meses.map((m, i) => (
                <SelectItem key={m.mes} value={i.toString()}>
                  {m.mesLabel.charAt(0).toUpperCase() + m.mesLabel.slice(1)}
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
            <CardTitle className="text-sm font-medium">Receita Total {labelPeriodo}</CardTitle>
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
              {squadSelecionado === "todos" ? "Todos os squads" : squadSelecionado}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Squads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-squads">
                {squadSelecionado === "todos" 
                  ? (visibleSquads.length) 
                  : "1"}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {squadSelecionado === "todos" ? "Com faturamento no período" : "Filtro aplicado"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Ativos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-contratos">
                {totalContratos}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Relacionados às parcelas
            </p>
          </CardContent>
        </Card>
        
        {mesSelecionado === "todos" && (
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
                  {formatCurrencyNoDecimals(mesesComDados > 0 ? totalReceitas / mesesComDados : 0)}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Receita média por mês ({mesesComDados} meses com dados)
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabela de Ranking - exibida apenas quando "todos" está selecionado */}
      {squadSelecionado === "todos" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Ranking de Contribuição por Squad
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRanking ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : visibleRanking.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="p-3 text-left font-semibold">#</th>
                      <th className="p-3 text-left font-semibold">Squad</th>
                      <th className="p-3 text-right font-semibold">Receita</th>
                      <th className="p-3 text-right font-semibold">Despesa</th>
                      <th className="p-3 text-right font-semibold">Resultado Bruto</th>
                      <th className="p-3 text-right font-semibold">Margem Bruta (%)</th>
                      <th className="p-3 text-right font-semibold">Impostos (18%)</th>
                      <th className="p-3 text-right font-semibold">Contribuição</th>
                      <th className="p-3 text-right font-semibold">Margem L�quida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRanking.map((squad, index) => (
                      <tr 
                        key={squad.squad} 
                        className={cn(
                          "border-b border-border/50 hover-elevate cursor-pointer",
                          index === 0 && "bg-amber-500/10",
                          index === 1 && "bg-zinc-400/10",
                          index === 2 && "bg-orange-400/10"
                        )}
                        onClick={() => setSquadSelecionado(squad.squad)}
                        data-testid={`row-ranking-${index}`}
                      >
                        <td className="p-3 font-bold">
                          {index === 0 && <span className="text-amber-500">🥇</span>}
                          {index === 1 && <span className="text-zinc-400">🥈</span>}
                          {index === 2 && <span className="text-orange-400">🥉</span>}
                          {index > 2 && (index + 1)}
                        </td>
                        <td className="p-3 font-medium">{squad.squad}</td>
                        <td className="p-3 text-right text-emerald-500 font-medium">
                          {formatCurrencyNoDecimals(squad.receita)}
                        </td>
                        <td className="p-3 text-right text-red-500 font-medium">
                          {formatCurrencyNoDecimals(squad.despesa)}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrencyNoDecimals(squad.resultadoBruto)}
                        </td>
                        <td className={cn(
                          "p-3 text-right font-medium",
                          squad.receita > 0
                            ? squad.resultadoBruto / squad.receita >= 0.2
                              ? "text-emerald-500"
                              : squad.resultadoBruto / squad.receita >= 0
                                ? "text-amber-500"
                                : "text-red-500"
                            : "text-muted-foreground"
                        )}>
                          {squad.receita > 0 ? formatPercent((squad.resultadoBruto / squad.receita) * 100, 1) : "-"}
                        </td>
                        <td className="p-3 text-right text-orange-500 font-medium">
                          {formatCurrencyNoDecimals(squad.impostos)}
                        </td>
                        <td className={cn(
                          "p-3 text-right font-bold",
                          squad.contribuicao >= 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          {formatCurrencyNoDecimals(squad.contribuicao)}
                        </td>
                        <td className={cn(
                          "p-3 text-right font-medium",
                          squad.margem >= 20 ? "text-emerald-500" : squad.margem >= 0 ? "text-amber-500" : "text-red-500"
                        )}>
                          {formatPercent(squad.margem)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/50 font-bold">
                      <td className="p-3" colSpan={2}>Total</td>
                      <td className="p-3 text-right text-emerald-500">
                        {formatCurrencyNoDecimals(rankingTotals.receita)}
                      </td>
                      <td className="p-3 text-right text-red-500">
                        {formatCurrencyNoDecimals(rankingTotals.despesa)}
                      </td>
                      <td className="p-3 text-right">
                        {formatCurrencyNoDecimals(rankingTotals.resultadoBruto)}
                      </td>
                      <td className="p-3 text-right">
                        {rankingTotals.receita > 0
                          ? formatPercent((rankingTotals.resultadoBruto / rankingTotals.receita) * 100, 1)
                          : "-"}
                      </td>
                      <td className="p-3 text-right text-orange-500">
                        {formatCurrencyNoDecimals(rankingTotals.impostos)}
                      </td>
                      <td className={cn(
                        "p-3 text-right",
                        rankingTotals.contribuicao >= 0 ? "text-emerald-500" : "text-red-500"
                      )}>
                        {formatCurrencyNoDecimals(rankingTotals.contribuicao)}
                      </td>
                      <td className="p-3 text-right">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhum dado disponível para o período selecionado
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CirclePlus className="h-5 w-5 text-emerald-500" />
            DFC por Operador - Receitas por Produto/Serviço
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
                    Produto/Serviço
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

                <div 
                  className="grid border-b-2 border-red-500/50 bg-red-500/10 cursor-pointer hover-elevate mt-4"
                  style={{ gridTemplateColumns: `250px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  onClick={() => toggleExpand("DESPESAS")}
                  data-testid="row-despesas-total"
                >
                  <div className="p-3 font-bold text-red-500 flex items-center gap-2 sticky left-0 z-10 bg-red-500/10">
                    {expanded.has("DESPESAS") ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <CircleMinus className="h-4 w-4" />
                    Despesas
                  </div>
                  {hierarchicalData.monthColumns.map((col) => (
                    <div key={col.mes} className="p-3 text-right font-bold text-red-500">
                      {formatCurrencyNoDecimals(col.despesaTotal)}
                    </div>
                  ))}
                </div>

                {expanded.has("DESPESAS") && hierarchicalData.despesas.map((despesa) => {
                  const isLevel1 = despesa.nivel === 1;
                  const hasChildren = hierarchicalData.despesas.some(d => d.parentId === despesa.id);
                  const isExpanded = expanded.has(despesa.id);
                  
                  // Para nível 2+, só mostrar se o pai estiver expandido
                  if (!isLevel1 && despesa.parentId && !expanded.has(despesa.parentId)) {
                    return null;
                  }
                  
                  const indentLevel = despesa.id.split(".").length - 1;
                  
                  return (
                    <div 
                      key={despesa.id}
                      className={cn(
                        "grid border-b border-border/50 hover-elevate",
                        hasChildren && "cursor-pointer"
                      )}
                      style={{ gridTemplateColumns: `250px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                      onClick={() => hasChildren && toggleExpand(despesa.id)}
                      data-testid={`row-despesa-${despesa.id}`}
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
                          isLevel1 && "font-semibold"
                        )}>{despesa.nome}</span>
                      </div>
                      {hierarchicalData.monthColumns.map((col) => {
                        const valor = col.valorPorDespesa.get(despesa.id) || 0;
                        return (
                          <div key={col.mes} className={cn(
                            "p-3 text-right text-sm",
                            isLevel1 ? "text-red-500 font-medium" : "text-red-400"
                          )}>
                            {valor > 0 ? formatCurrencyNoDecimals(valor) : "-"}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* RESULTADO BRUTO = Receitas - Despesas */}
                <div 
                  className="grid border-b border-amber-500/30 bg-amber-500/5 mt-3"
                  style={{ gridTemplateColumns: `250px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  data-testid="row-resultado-bruto"
                >
                  <div className="p-2.5 font-semibold text-sm text-amber-400 flex items-center gap-2 sticky left-0 z-10 bg-amber-500/5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Resultado Bruto
                  </div>
                  {hierarchicalData.monthColumns.map((col) => {
                    const hasData = col.receitaTotal > 0 || col.despesaTotal > 0;
                    const isPositive = col.resultadoBruto >= 0;
                    return (
                      <div 
                        key={col.mes} 
                        className={cn(
                          "p-2.5 text-right text-sm font-semibold",
                          !hasData ? "text-muted-foreground" : isPositive ? "text-amber-400" : "text-red-400"
                        )}
                      >
                        {hasData ? formatCurrencyNoDecimals(col.resultadoBruto) : "-"}
                      </div>
                    );
                  })}
                </div>

                {/* CONTRIBUIÇÃO BRUTA % */}
                <div
                  className="grid border-b border-border/30 bg-amber-500/5"
                  style={{ gridTemplateColumns: `250px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  data-testid="row-contribuicao-bruta"
                >
                  <div className="p-2 pl-8 text-xs text-muted-foreground sticky left-0 z-10 bg-amber-500/5">
                    Contribuição Bruta (%)
                  </div>
                  {hierarchicalData.monthColumns.map((col) => {
                    const percentBruto = col.receitaTotal > 0 ? (col.resultadoBruto / col.receitaTotal) * 100 : 0;
                    const hasReceita = col.receitaTotal > 0;
                    const isPositive = percentBruto >= 0;
                    return (
                      <div
                        key={col.mes}
                        className={cn(
                          "p-2 text-right text-xs",
                          hasReceita ? (isPositive ? "text-amber-400/80" : "text-red-400/80") : "text-muted-foreground"
                        )}
                      >
                        {hasReceita ? formatPercent(percentBruto, 1) : "-"}
                      </div>
                    );
                  })}
                </div>

                {/* IMPOSTOS (18%) - Linha principal separada */}
                <div 
                  className="grid border-b border-purple-500/30 bg-purple-500/5"
                  style={{ gridTemplateColumns: `250px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  data-testid="row-impostos"
                >
                  <div className="p-2.5 font-semibold text-sm text-purple-400 flex items-center gap-2 sticky left-0 z-10 bg-purple-500/5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Impostos (18%)
                  </div>
                  {hierarchicalData.monthColumns.map((col) => {
                    const hasData = col.receitaTotal > 0 || col.despesaTotal > 0;
                    return (
                      <div 
                        key={col.mes} 
                        className={cn(
                          "p-2.5 text-right text-sm font-semibold",
                          hasData ? "text-purple-400" : "text-muted-foreground"
                        )}
                      >
                        {hasData && col.impostos > 0 ? formatCurrencyNoDecimals(col.impostos) : "-"}
                      </div>
                    );
                  })}
                </div>

                {/* RESULTADO LÍQUIDO = Resultado Bruto - Impostos */}
                <div 
                  className="grid border-b-2 border-emerald-500/40 bg-emerald-500/10"
                  style={{ gridTemplateColumns: `250px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  data-testid="row-resultado-liquido"
                >
                  <div className="p-2.5 font-bold text-sm text-emerald-400 flex items-center gap-2 sticky left-0 z-10 bg-emerald-500/10">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Resultado Líquido
                  </div>
                  {hierarchicalData.monthColumns.map((col) => {
                    const hasData = col.receitaTotal > 0 || col.despesaTotal > 0;
                    const isPositive = col.resultadoLiquido >= 0;
                    return (
                      <div 
                        key={col.mes} 
                        className={cn(
                          "p-2.5 text-right text-sm font-bold",
                          !hasData ? "text-muted-foreground" : isPositive ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {hasData ? formatCurrencyNoDecimals(col.resultadoLiquido) : "-"}
                      </div>
                    );
                  })}
                </div>

                {/* CONTRIBUIÇÃO % */}
                <div
                  className="grid bg-muted/20 mt-2"
                  style={{ gridTemplateColumns: `250px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  data-testid="row-contribuicao-percentual"
                >
                  <div className="p-2.5 text-sm text-muted-foreground sticky left-0 z-10 bg-muted/20">
                    Contribuição (%)
                  </div>
                  {hierarchicalData.monthColumns.map((col) => {
                    const percent = col.receitaTotal > 0 ? (col.resultadoLiquido / col.receitaTotal) * 100 : 0;
                    const hasReceita = col.receitaTotal > 0;
                    const isPositive = percent >= 0;
                    return (
                      <div
                        key={col.mes}
                        className={cn(
                          "p-2.5 text-right text-sm",
                          hasReceita ? (isPositive ? "text-emerald-500" : "text-red-500") : "text-muted-foreground"
                        )}
                      >
                        {hasReceita ? formatPercent(percent, 1) : "-"}
                      </div>
                    );
                  })}
                </div>

              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


