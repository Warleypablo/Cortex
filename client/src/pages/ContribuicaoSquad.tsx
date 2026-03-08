import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { ChevronRight, ChevronDown, ChevronUp, Users, TrendingUp, CirclePlus, FileText, DollarSign, ExternalLink, Trophy, Percent } from "lucide-react";
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

interface SquadResumo {
  squad: string;
  receitaTotal: number;
  porMes: number[];
  quantidadeContratos: number;
}

interface DespesasMensais {
  [mes: string]: {
    salarios: number;
    cxcs: number;
    freelancers: number;
  };
}

interface BulkResponse {
  ano: number;
  squad: string;
  squads: string[];
  meses: MonthlyData[];
  resumoPorSquad?: SquadResumo[];
  despesasMensais?: DespesasMensais;
}

const isOffSquad = (squad: string) => /\bOFF\b/i.test(squad);

export default function ContribuicaoSquad() {
  usePageTitle("Contribuição por Squad");
  useSetPageInfo("Contribuição por Squad", "Receitas atribuídas por squad do contrato");

  const hoje = new Date();
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  const [squadSelecionado, setSquadSelecionado] = useState<string>("todos");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["RECEITAS"]));
  const [taxaImposto, setTaxaImposto] = useState(18);
  const taxaDecimal = taxaImposto / 100;
  const [showDetail, setShowDetail] = useState(false);

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

  const totalReceitaBruta = useMemo(() => {
    return totalReceitas;
  }, [totalReceitas]);

  // Total de despesas anuais (salários + CXCS + freelancers + impostos)
  const totalDespesasAnual = useMemo(() => {
    if (!bulkData?.despesasMensais) return totalReceitas * taxaDecimal;
    let total = 0;
    for (const col of hierarchicalData.monthColumns) {
      const desp = bulkData.despesasMensais[col.mes];
      const impostos = col.receitaTotal * taxaDecimal;
      total += impostos + (desp?.salarios || 0) + (desp?.cxcs || 0) + (desp?.freelancers || 0);
    }
    return total;
  }, [bulkData, hierarchicalData, taxaDecimal, totalReceitas]);

  // Ranking de squads
  const squadRanking = useMemo(() => {
    if (!bulkData?.resumoPorSquad) return [];
    const totalGeral = bulkData.resumoPorSquad.reduce((s, sq) => s + sq.receitaTotal, 0);
    return bulkData.resumoPorSquad.map((sq, idx) => ({
      ...sq,
      posicao: idx + 1,
      contribuicaoPct: totalGeral > 0 ? (sq.receitaTotal / totalGeral) * 100 : 0,
      resultadoLiquido: sq.receitaTotal * (1 - taxaDecimal),
    }));
  }, [bulkData, taxaDecimal]);

  const formatMesLabel = (label: string) => {
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Contribuição por Squad</h1>
          <p className="text-sm text-muted-foreground">Receitas por produto/serviço e período (squad do contrato)</p>
          {squadSelecionado !== "todos" && (
            <button onClick={() => setSquadSelecionado("todos")} className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
              ← Voltar para todos os squads
            </button>
          )}
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

          <div className="flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={taxaImposto}
              onChange={(e) => setTaxaImposto(Number(e.target.value) || 0)}
              className="w-[70px] h-9 text-sm text-center"
              title="Alíquota de imposto (%)"
            />
          </div>
        </div>
      </div>

      {/* Hero Ranking - only when "todos" is selected */}
      {squadSelecionado === "todos" && squadRanking.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Ranking de Contribuição
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {squadRanking.map((sq) => {
              const posColors = ['#10b981', '#3b82f6', '#f59e0b'];
              const borderColor = sq.posicao <= 3 ? posColors[sq.posicao - 1] : '#71717a';
              return (
                <Card
                  key={sq.squad}
                  className="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] border-l-4"
                  style={{ borderLeftColor: borderColor }}
                  onClick={() => setSquadSelecionado(sq.squad)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-muted-foreground">{sq.posicao}º</span>
                        <div>
                          <p className="font-semibold text-sm">{sq.squad}</p>
                          <p className="text-xs text-muted-foreground">{sq.quantidadeContratos} contratos</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs font-bold">
                        {sq.contribuicaoPct.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <Progress value={sq.contribuicaoPct} className="h-2" />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>Receita: {formatCurrencyNoDecimals(sq.receitaTotal)}</span>
                      <span>Líquido: {formatCurrencyNoDecimals(sq.resultadoLiquido)}</span>
                    </div>
                    <div className="h-8 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sq.porMes.map((v, i) => ({ m: i, v }))}>
                          <Area type="monotone" dataKey="v" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={1.5} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Annual Summary Table - only when "todos" is selected */}
      {squadSelecionado === "todos" && squadRanking.length > 0 && (
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-semibold">Resumo Anual por Squad</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">#</th>
                    <th className="text-left py-2 pr-4">Squad</th>
                    <th className="text-right py-2 px-3">Receita Bruta</th>
                    <th className="text-right py-2 px-3">Despesas</th>
                    <th className="text-right py-2 px-3">Resultado Líquido</th>
                    <th className="text-right py-2 px-3">Contribuição</th>
                    <th className="text-center py-2 px-3 w-24">Tendência</th>
                  </tr>
                </thead>
                <tbody>
                  {squadRanking.map((sq) => (
                    <tr key={sq.squad} className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSquadSelecionado(sq.squad)}>
                      <td className="py-2 pr-4 font-bold text-muted-foreground">{sq.posicao}º</td>
                      <td className="py-2 pr-4 font-medium">{sq.squad}</td>
                      <td className="py-2 px-3 text-right">{formatCurrencyNoDecimals(sq.receitaTotal)}</td>
                      <td className="py-2 px-3 text-right text-purple-500">{formatCurrencyNoDecimals(sq.receitaTotal * taxaDecimal)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{formatCurrencyNoDecimals(sq.resultadoLiquido)}</td>
                      <td className="py-2 px-3 text-right font-bold">{sq.contribuicaoPct.toFixed(1)}%</td>
                      <td className="py-2 px-3">
                        <div className="h-6 w-20 mx-auto">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sq.porMes.map((v, i) => ({ m: i, v }))}>
                              <Area type="monotone" dataKey="v" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={1} dot={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="py-2 pr-4" colSpan={2}>Total</td>
                    <td className="py-2 px-3 text-right">{formatCurrencyNoDecimals(totalReceitas)}</td>
                    <td className="py-2 px-3 text-right text-red-500">{formatCurrencyNoDecimals(totalDespesasAnual)}</td>
                    <td className="py-2 px-3 text-right">{formatCurrencyNoDecimals(totalReceitas - totalDespesasAnual)}</td>
                    <td className="py-2 px-3 text-right">100%</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards - show when specific squad is selected */}
      {squadSelecionado !== "todos" && (
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
                {squadSelecionado}
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
                  1
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Filtro aplicado
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
      )}

      {/* When "todos" and no data, show empty state */}
      {!isLoading && squadSelecionado === "todos" && squadRanking.length === 0 && totalReceitas === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">Nenhum dado de receita encontrado para {anoSelecionado}.</p>
            <p className="text-muted-foreground text-xs mt-1">Tente selecionar outro ano ou verifique os dados.</p>
          </CardContent>
        </Card>
      )}

      {/* Monthly Detail - Collapsible */}
      <Card>
        <CardHeader
          className="px-4 py-3 cursor-pointer select-none hover:bg-muted/50 transition-colors"
          onClick={() => setShowDetail(!showDetail)}
        >
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            DFC - Fluxo Financeiro por Squad
            <span className="ml-auto">
              {showDetail ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
          </CardTitle>
        </CardHeader>
        {showDetail && (
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

                  {/* DESPESAS - Seção expandível com Impostos, Salários, CXCS, Freelancers */}
                  <div
                    className="grid border-b-2 border-red-500/50 bg-red-500/10 cursor-pointer hover:bg-red-500/15 transition-colors mt-2"
                    style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                    onClick={() => toggleExpand("DESPESAS")}
                    data-testid="row-despesas-total"
                  >
                    <div className="px-2 py-1.5 font-bold text-sm text-red-500 flex items-center gap-1.5 sticky left-0 z-10 bg-red-500/10">
                      {expanded.has("DESPESAS") ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      <CirclePlus className="h-3.5 w-3.5 rotate-45" />
                      Despesas
                    </div>
                    {hierarchicalData.monthColumns.map((col) => {
                      const desp = bulkData?.despesasMensais?.[col.mes];
                      const impostos = col.receitaTotal * taxaDecimal;
                      const totalDesp = impostos + (desp?.salarios || 0) + (desp?.cxcs || 0) + (desp?.freelancers || 0);
                      return (
                        <div key={col.mes} className="px-2 py-1.5 text-right text-sm font-bold text-red-500">
                          {totalDesp > 0 ? formatCurrencyNoDecimals(totalDesp) : "-"}
                        </div>
                      );
                    })}
                  </div>

                  {expanded.has("DESPESAS") && (
                    <>
                      {/* Impostos */}
                      <div
                        className="grid border-b border-border/50"
                        style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                      >
                        <div className="px-2 py-1 flex items-center gap-1.5 sticky left-0 z-10 bg-background pl-8">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">Impostos ({taxaImposto}%)</span>
                        </div>
                        {hierarchicalData.monthColumns.map((col) => (
                          <div key={col.mes} className="px-2 py-1 text-right text-xs">
                            {col.receitaTotal > 0 ? formatCurrencyNoDecimals(col.receitaTotal * taxaDecimal) : "-"}
                          </div>
                        ))}
                      </div>

                      {/* Salários */}
                      <div
                        className="grid border-b border-border/50"
                        style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                      >
                        <div className="px-2 py-1 flex items-center gap-1.5 sticky left-0 z-10 bg-background pl-8">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">Salários</span>
                        </div>
                        {hierarchicalData.monthColumns.map((col) => {
                          const val = bulkData?.despesasMensais?.[col.mes]?.salarios || 0;
                          return (
                            <div key={col.mes} className="px-2 py-1 text-right text-xs">
                              {val > 0 ? formatCurrencyNoDecimals(val) : "-"}
                            </div>
                          );
                        })}
                      </div>

                      {/* CXCS */}
                      <div
                        className="grid border-b border-border/50"
                        style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                      >
                        <div className="px-2 py-1 flex items-center gap-1.5 sticky left-0 z-10 bg-background pl-8">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">CXCS (Média)</span>
                        </div>
                        {hierarchicalData.monthColumns.map((col) => {
                          const val = bulkData?.despesasMensais?.[col.mes]?.cxcs || 0;
                          return (
                            <div key={col.mes} className="px-2 py-1 text-right text-xs">
                              {val > 0 ? formatCurrencyNoDecimals(val) : "-"}
                            </div>
                          );
                        })}
                      </div>

                      {/* Freelancers */}
                      <div
                        className="grid border-b border-border/50"
                        style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                      >
                        <div className="px-2 py-1 flex items-center gap-1.5 sticky left-0 z-10 bg-background pl-8">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">Freelancers</span>
                        </div>
                        {hierarchicalData.monthColumns.map((col) => {
                          const val = bulkData?.despesasMensais?.[col.mes]?.freelancers || 0;
                          return (
                            <div key={col.mes} className="px-2 py-1 text-right text-xs">
                              {val > 0 ? formatCurrencyNoDecimals(val) : "-"}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* RESULTADO LÍQUIDO = Receitas - Despesas */}
                  <div
                    className="grid border-b-2 border-blue-500/50 bg-blue-500/10 mt-2"
                    style={{ gridTemplateColumns: `220px repeat(${hierarchicalData.monthColumns.length}, 1fr)` }}
                    data-testid="row-resultado-liquido"
                  >
                    <div className="px-2 py-1.5 font-bold text-sm text-blue-500 flex items-center gap-1.5 sticky left-0 z-10 bg-blue-500/10">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Resultado
                    </div>
                    {hierarchicalData.monthColumns.map((col) => {
                      const desp = bulkData?.despesasMensais?.[col.mes];
                      const impostos = col.receitaTotal * taxaDecimal;
                      const totalDesp = impostos + (desp?.salarios || 0) + (desp?.cxcs || 0) + (desp?.freelancers || 0);
                      const resultado = col.receitaTotal - totalDesp;
                      return (
                        <div key={col.mes} className={cn(
                          "px-2 py-1.5 text-right text-sm font-bold",
                          resultado >= 0 ? "text-blue-500" : "text-red-500"
                        )}>
                          {col.receitaTotal > 0 ? formatCurrencyNoDecimals(resultado) : "-"}
                        </div>
                      );
                    })}
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
        )}
      </Card>
    </div>
  );
}
