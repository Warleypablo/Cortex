import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronDown, Users, TrendingUp, CirclePlus, FileText, DollarSign, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ParcelaInfo {
  id: string;
  valor: number;
  dataQuitacao: string;
  linkNfse: string | null;
  numNfse: string | null;
  urlCobranca: string | null;
  clienteNome: string;
  servicoNome: string;
  squad: string;
}

interface ReceitaItem {
  categoriaId: string;
  categoriaNome: string;
  valor: number;
  nivel: number;
  parcelas?: ParcelaInfo[];
}

interface ContribuicaoSquadData {
  squads: string[];
  receitas: ReceitaItem[];
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

interface BulkResponse {
  ano: number;
  squad: string;
  squads: string[];
  meses: MonthlyData[];
}

const isOffSquad = (squad: string) => /\bOFF\b/i.test(squad);

export default function ContribuicaoSquad() {
  usePageTitle("Contribuição por Squad");
  useSetPageInfo("Contribuição por Squad", "Receitas atribuídas por squad do contrato");
  
  const hoje = new Date();
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  const [squadSelecionado, setSquadSelecionado] = useState<string>("todos");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["RECEITAS"]));
  
  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i);
  
  // Query bulk otimizada - uma única chamada para todos os 12 meses
  const { data: bulkData, isLoading } = useQuery<BulkResponse>({
    queryKey: ["/api/contribuicao-squad/dfc/bulk", anoSelecionado, squadSelecionado],
    queryFn: async () => {
      const params = new URLSearchParams({ ano: anoSelecionado.toString() });
      if (squadSelecionado !== "todos") {
        params.append("squad", squadSelecionado);
      }
      const response = await fetch(`/api/contribuicao-squad/dfc/bulk?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Falha ao buscar dados");
      return response.json();
    },
  });

  const squadsData = bulkData?.squads || [];
  const visibleSquads = useMemo(
    () => squadsData.filter((squad) => !isOffSquad(squad)),
    [squadsData]
  );
  const monthlyResults = bulkData?.meses || [];

  const hierarchicalData = useMemo(() => {
    if (!monthlyResults || monthlyResults.length === 0) return { categories: [], monthColumns: [], parcelasPorCategoriaEMes: new Map() };
    
    const allCategoriesMap = new Map<string, { id: string; nome: string; nivel: number }>();
    // Mapa: "categoriaId|mes" -> ParcelaInfo[]
    const parcelasPorCategoriaEMes = new Map<string, ParcelaInfo[]>();
    
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
          // Armazena parcelas se disponíveis
          if (receita.parcelas && receita.parcelas.length > 0) {
            const key = `${receita.categoriaId}|${monthData.mes}`;
            parcelasPorCategoriaEMes.set(key, receita.parcelas);
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
      monthColumns,
      parcelasPorCategoriaEMes
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

  const totalReceitaLiquida = useMemo(() => {
    return totalReceitas * (1 - TAXA_IMPOSTO);
  }, [totalReceitas]);
  
  const totalReceitaBruta = useMemo(() => {
    return totalReceitas;
  }, [totalReceitas]);

  const formatMesLabel = (label: string) => {
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

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
              {visibleSquads.map((sq) => (
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
                  ? (visibleSquads.length) 
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
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            DFC - Fluxo Financeiro por Squad
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
                        const parcelaKey = `${category.id}|${col.mes}`;
                        const parcelas = hierarchicalData.parcelasPorCategoriaEMes.get(parcelaKey);
                        const hasLinks = parcelas?.some((p: ParcelaInfo) => p.urlCobranca || p.linkNfse);
                        const firstFaturaLink = parcelas?.find((p: ParcelaInfo) => p.urlCobranca)?.urlCobranca;
                        const firstNfseLink = parcelas?.find((p: ParcelaInfo) => p.linkNfse)?.linkNfse;
                        
                        return (
                          <div key={col.mes} className="px-2 py-1 text-right text-xs flex items-center justify-end gap-1">
                            {valor > 0 ? formatCurrencyNoDecimals(valor) : "-"}
                            {hasLinks && parcelas && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a 
                                    href={firstFaturaLink || firstNfseLink || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={firstFaturaLink ? "text-green-500 hover-elevate" : "text-blue-500 hover-elevate"}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <div className="text-xs space-y-1">
                                    <p className="font-medium">Parcelas ({parcelas.length}):</p>
                                    {parcelas.slice(0, 5).map((p: ParcelaInfo, idx: number) => (
                                      <div key={idx} className="flex items-center gap-1 flex-wrap">
                                        <span>{formatCurrencyNoDecimals(p.valor)}</span>
                                        {p.numNfse && <span className="text-muted-foreground">NF {p.numNfse}</span>}
                                        {p.urlCobranca && (
                                          <a 
                                            href={p.urlCobranca} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-green-500 hover:underline"
                                          >
                                            Fatura
                                          </a>
                                        )}
                                        {p.linkNfse && (
                                          <a 
                                            href={p.linkNfse} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline"
                                          >
                                            NF-e
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                    {parcelas.length > 5 && (
                                      <p className="text-muted-foreground">+{parcelas.length - 5} mais...</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* RESULTADO BRUTO = Receitas (sem despesas operacionais nesta view) */}
                <div 
                  className="grid border-b-2 border-amber-500/50 bg-amber-500/10 mt-2"
                  style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  data-testid="row-resultado-bruto"
                >
                  <div className="px-2 py-1.5 font-bold text-sm text-amber-500 flex items-center gap-1.5 sticky left-0 z-10 bg-amber-500/10">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Resultado Bruto
                  </div>
                  {hierarchicalData.monthColumns.map((col) => (
                    <div key={col.mes} className="px-2 py-1.5 text-right text-sm font-bold text-amber-500">
                      {col.receitaTotal > 0 ? formatCurrencyNoDecimals(col.receitaTotal) : "-"}
                    </div>
                  ))}
                </div>

                {/* IMPOSTOS (18%) - Linha principal */}
                <div 
                  className="grid border-b-2 border-purple-500/50 bg-purple-500/10 mt-2"
                  style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  data-testid="row-impostos"
                >
                  <div className="px-2 py-1.5 font-bold text-sm text-purple-500 flex items-center gap-1.5 sticky left-0 z-10 bg-purple-500/10">
                    <DollarSign className="h-3.5 w-3.5" />
                    Impostos (18%)
                  </div>
                  {hierarchicalData.monthColumns.map((col) => (
                    <div key={col.mes} className="px-2 py-1.5 text-right text-sm font-bold text-purple-500">
                      {col.receitaTotal > 0 ? formatCurrencyNoDecimals(col.receitaTotal * 0.18) : "-"}
                    </div>
                  ))}
                </div>

                {/* RESULTADO LÍQUIDO = Resultado Bruto - Impostos */}
                <div 
                  className="grid border-b-2 border-blue-500/50 bg-blue-500/10 mt-2"
                  style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  data-testid="row-resultado-liquido"
                >
                  <div className="px-2 py-1.5 font-bold text-sm text-blue-500 flex items-center gap-1.5 sticky left-0 z-10 bg-blue-500/10">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Resultado Líquido
                  </div>
                  {hierarchicalData.monthColumns.map((col) => (
                    <div key={col.mes} className="px-2 py-1.5 text-right text-sm font-bold text-blue-500">
                      {col.receitaTotal > 0 ? formatCurrencyNoDecimals(col.receitaTotal * 0.82) : "-"}
                    </div>
                  ))}
                </div>

                {/* CONTRIBUIÇÃO PERCENTUAL */}
                <div 
                  className="grid border-t-2 border-muted mt-4 pt-2"
                  style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                  data-testid="row-contribuicao-percentual"
                >
                  <div className="px-2 py-1.5 font-medium text-sm text-muted-foreground flex items-center gap-1.5 sticky left-0 z-10">
                    Contribuição (%)
                  </div>
                  {hierarchicalData.monthColumns.map((col) => {
                    const percentual = totalReceitaBruta > 0 ? (col.receitaTotal / totalReceitaBruta) * 100 : 0;
                    return (
                      <div key={col.mes} className="px-2 py-1.5 text-right text-sm font-medium">
                        {percentual > 0 ? `${percentual.toFixed(1)}%` : "-"}
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
