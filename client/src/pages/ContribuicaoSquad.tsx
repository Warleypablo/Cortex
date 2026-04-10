import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronDown } from "lucide-react";
import { HeroMetric } from "@/components/HeroMetric";

interface MonthlyData {
  mes: string;
  mesLabel: string;
  data: {
    squads: string[];
    receitas: unknown[];
    totais: {
      receitaTotal: number;
      quantidadeParcelas: number;
      quantidadeContratos: number;
    };
  } | null;
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
    freelancers: number;
  };
}

interface SalarioDetalhe {
  nome: string;
  porMes: number[];
  total: number;
}

interface ReceitaDetalhe {
  cliente: string;
  porMes: number[];
  total: number;
}

interface BulkResponse {
  ano: number;
  squad: string;
  squads: string[];
  meses: MonthlyData[];
  resumoPorSquad?: SquadResumo[];
  despesasMensais?: DespesasMensais;
  salariosDetalhesPorSquad?: Record<string, SalarioDetalhe[]>;
  receitasDetalhesPorSquad?: Record<string, ReceitaDetalhe[]>;
}

const isOffSquad = (squad: string) => /\bOFF\b/i.test(squad);

export default function ContribuicaoSquad() {
  usePageTitle("Contribuição por Squad");
  useSetPageInfo("Contribuição por Squad", "Receitas atribuídas por squad do contrato");

  const hoje = new Date();
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  const [squadSelecionado, setSquadSelecionado] = useState<string>("todos");
  const [collapsedSquads, setCollapsedSquads] = useState<Set<string> | "all">("all");
  const [expandedDespesas, setExpandedDespesas] = useState<Set<string>>(new Set());
  const [expandedSalarios, setExpandedSalarios] = useState<Set<string>>(new Set());
  const [expandedReceitas, setExpandedReceitas] = useState<Set<string>>(new Set());

  const toggleDespesasExpand = (key: string) => {
    setExpandedDespesas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleReceitasExpand = (key: string) => {
    setExpandedReceitas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSalariosExpand = (key: string) => {
    setExpandedSalarios(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i);

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

  const isSquadCollapsed = (squad: string) =>
    collapsedSquads === "all" || collapsedSquads.has(squad);

  const toggleSquadCollapse = (squad: string) => {
    setCollapsedSquads(prev => {
      if (prev === "all") {
        // First interaction: expand only this squad (rest stay collapsed)
        const allSquads = new Set(squadRanking.map(s => s.squad));
        allSquads.delete(squad);
        return allSquads;
      }
      const next = new Set(prev);
      if (next.has(squad)) {
        next.delete(squad);
      } else {
        next.add(squad);
      }
      return next;
    });
  };

  // Ranking de squads com rateio proporcional de despesas
  const squadRanking = useMemo(() => {
    if (!bulkData?.resumoPorSquad) return [];
    const totalGeral = bulkData.resumoPorSquad.reduce((s, sq) => s + sq.receitaTotal, 0);

    // Total de despesas anuais
    let totalDespAnual = 0;
    for (const m of monthlyResults) {
      const desp = bulkData.despesasMensais?.[m.mes];
      totalDespAnual += (desp?.salarios || 0) + (desp?.freelancers || 0);
    }

    return bulkData.resumoPorSquad.map((sq) => {
      const proporcao = totalGeral > 0 ? sq.receitaTotal / totalGeral : 0;
      const despesaRateada = totalDespAnual * proporcao;
      return {
        ...sq,
        contribuicaoPct: totalGeral > 0 ? proporcao * 100 : 0,
        despesaRateada,
        resultadoLiquido: sq.receitaTotal - despesaRateada,
      };
    });
  }, [bulkData, monthlyResults]);

  // Dados computados para a tabela
  const tableData = useMemo(() => {
    if (squadRanking.length === 0 || monthlyResults.length === 0) return null;

    // Despesa total por mês (salários + freelancers)
    const despesaTotalPorMes = monthlyResults.map((m) => {
      const desp = bulkData?.despesasMensais?.[m.mes];
      return (desp?.salarios || 0) + (desp?.freelancers || 0);
    });

    // Receita total por mês
    const receitaTotalPorMes = monthlyResults.map((_, i) =>
      squadRanking.reduce((acc, sq) => acc + (sq.porMes[i] || 0), 0)
    );

    // Componentes de despesa por mês (absolutos, sem rateio)
    const salariosPorMes = monthlyResults.map((m) => bulkData?.despesasMensais?.[m.mes]?.salarios || 0);
    const freelancersPorMes = monthlyResults.map((m) => bulkData?.despesasMensais?.[m.mes]?.freelancers || 0);

    // Despesa rateada por squad por mês
    const despesaSquadMes = (sq: typeof squadRanking[0], mesIdx: number) => {
      const receitaMes = receitaTotalPorMes[mesIdx];
      const proporcao = receitaMes > 0 ? (sq.porMes[mesIdx] || 0) / receitaMes : 0;
      return despesaTotalPorMes[mesIdx] * proporcao;
    };

    // Componente de despesa rateado por squad por mês
    const despesaComponenteSquadMes = (sq: typeof squadRanking[0], mesIdx: number, componente: number[]) => {
      const receitaMes = receitaTotalPorMes[mesIdx];
      const proporcao = receitaMes > 0 ? (sq.porMes[mesIdx] || 0) / receitaMes : 0;
      return componente[mesIdx] * proporcao;
    };

    // Totais gerais
    const totalReceita = squadRanking.reduce((acc, sq) => acc + sq.receitaTotal, 0);
    const totalDespesa = despesaTotalPorMes.reduce((acc, d) => acc + d, 0);
    const totalMargem = totalReceita - totalDespesa;
    const totalMargemPct = totalReceita > 0 ? (totalMargem / totalReceita) * 100 : 0;

    return {
      despesaTotalPorMes,
      receitaTotalPorMes,
      despesaSquadMes,
      despesaComponenteSquadMes,
      salariosPorMes,
      freelancersPorMes,
      totalReceita,
      totalDespesa,
      totalMargem,
      totalMargemPct,
    };
  }, [squadRanking, monthlyResults, bulkData]);

  const formatMesLabel = (label: string) => {
    return label.charAt(0).toUpperCase() + label.slice(1, 3);
  };

  const totalReceitas = useMemo(() => {
    return squadRanking.reduce((acc, sq) => acc + sq.receitaTotal, 0);
  }, [squadRanking]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Contribuição por Squad</h1>
          <p className="text-sm text-muted-foreground">Receitas, despesas e margem de contribuição por squad</p>
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

        </div>
      </div>

      {/* Hero Metrics */}
      {(() => {
        const heroItems = tableData ? [
          { label: "Receita Total", value: formatCurrencyNoDecimals(tableData.totalReceita), subtitle: "Receita bruta acumulada no ano" },
          { label: "Total Despesas", value: formatCurrencyNoDecimals(tableData.totalDespesa), subtitle: "Despesas rateadas (salários + freelancers)" },
          { label: "Margem", value: `${tableData.totalMargemPct.toFixed(1)}%`, subtitle: "Margem de contribuição consolidada" },
        ] : [];
        const skeletons = Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-40 rounded" />);

        if (isLoading || !tableData) {
          return (
            <>
              <div className="hidden md:flex items-start gap-12">{skeletons}</div>
              <div className="grid grid-cols-1 gap-4 md:hidden">{skeletons}</div>
            </>
          );
        }
        return (
          <>
            <div className="hidden md:flex items-start gap-12">
              {heroItems.map((m, i) => <HeroMetric key={i} {...m} />)}
            </div>
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {heroItems.map((m, i) => <HeroMetric key={i} {...m} />)}
            </div>
          </>
        );
      })()}

      {/* Empty state */}
      {!isLoading && totalReceitas === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          Nenhum dado de receita encontrado para {anoSelecionado}.
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-[95%]" />
              <Skeleton className="h-8 w-[90%]" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-[85%]" />
              <Skeleton className="h-8 w-[92%]" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela principal */}
      {!isLoading && tableData && squadRanking.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="min-w-[900px]">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted">
                      <th scope="col" className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground sticky left-0 z-10 bg-muted min-w-[160px]">
                        Squad / Linha
                      </th>
                      {monthlyResults.map((m) => (
                        <th scope="col" key={m.mes} className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[80px]">
                          {formatMesLabel(m.mesLabel)}
                        </th>
                      ))}
                      <th scope="col" className="text-right py-2.5 px-3 text-xs font-bold text-foreground min-w-[100px]">
                        Total
                      </th>
                      <th scope="col" className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground min-w-[70px]">
                        Contrib %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {squadRanking.map((sq) => {
                      const isCollapsed = isSquadCollapsed(sq.squad);
                      const totalDespesaSquad = monthlyResults.reduce((acc, _, i) => acc + tableData.despesaSquadMes(sq, i), 0);
                      const totalMargemSquad = sq.receitaTotal - totalDespesaSquad;
                      const totalMargemPctSquad = sq.receitaTotal > 0 ? (totalMargemSquad / sq.receitaTotal) * 100 : 0;

                      return (
                        <Fragment key={sq.squad}>
                          {/* Squad header row */}
                          <tr
                            className="border-b border-border bg-muted cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => toggleSquadCollapse(sq.squad)}
                          >
                            <td className="py-2 px-3 font-semibold text-sm sticky left-0 z-10 bg-muted hover:bg-muted/50 transition-colors">
                              <span className="flex items-center gap-1.5">
                                {isCollapsed ? (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {sq.squad}
                              </span>
                            </td>
                            {/* When collapsed, show receita per month */}
                            {monthlyResults.map((_, i) => {
                              const receita = sq.porMes[i] || 0;
                              return (
                                <td key={i} className={cn(
                                  "py-2 px-2 text-right text-xs",
                                  isCollapsed ? "text-emerald-600 dark:text-emerald-400" : ""
                                )}>
                                  {isCollapsed && receita > 0 ? formatCurrencyNoDecimals(receita) : ""}
                                </td>
                              );
                            })}
                            <td className={cn(
                              "py-2 px-3 text-right text-xs font-semibold",
                              isCollapsed ? "text-emerald-600 dark:text-emerald-400" : ""
                            )}>
                              {isCollapsed ? formatCurrencyNoDecimals(sq.receitaTotal) : ""}
                            </td>
                            <td className="py-2 px-3 text-right text-xs font-bold text-muted-foreground">
                              {sq.contribuicaoPct.toFixed(1)}%
                            </td>
                          </tr>

                          {!isCollapsed && (
                            <>
                              {/* Receita (expandível) */}
                              <tr className="border-b border-border/30 cursor-pointer hover:bg-muted/30" onClick={() => toggleReceitasExpand(sq.squad)}>
                                <td className="py-1.5 px-3 pl-7 text-xs text-emerald-600 dark:text-emerald-400 sticky left-0 z-10 bg-background flex items-center gap-1">
                                  {expandedReceitas.has(sq.squad) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  Receita
                                </td>
                                {sq.porMes.map((val, i) => (
                                  <td key={i} className="py-1.5 px-2 text-right text-xs text-emerald-600 dark:text-emerald-400">
                                    {val > 0 ? formatCurrencyNoDecimals(val) : "-"}
                                  </td>
                                ))}
                                <td className="py-1.5 px-3 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrencyNoDecimals(sq.receitaTotal)}
                                </td>
                                <td />
                              </tr>
                              {expandedReceitas.has(sq.squad) && (bulkData?.receitasDetalhesPorSquad?.[sq.squad] || []).map((cliente, idx) => (
                                <tr key={`${cliente.cliente}-${idx}`} className="border-b border-border/10">
                                  <td className="py-0.5 px-3 pl-12 text-[10px] text-emerald-500/70 dark:text-emerald-400/50 sticky left-0 z-10 bg-background truncate max-w-[200px]" title={cliente.cliente}>
                                    {cliente.cliente}
                                  </td>
                                  {monthlyResults.map((_, i) => (
                                    <td key={i} className="py-0.5 px-2 text-right text-[10px] text-emerald-500/70 dark:text-emerald-400/50">
                                      {cliente.porMes[i] > 0 ? formatCurrencyNoDecimals(cliente.porMes[i]) : "-"}
                                    </td>
                                  ))}
                                  <td className="py-0.5 px-3 text-right text-[10px] font-medium text-emerald-500/70 dark:text-emerald-400/50">
                                    {formatCurrencyNoDecimals(cliente.total)}
                                  </td>
                                  <td />
                                </tr>
                              ))}

                              {/* Despesas (expandível) */}
                              <tr className="border-b border-border/30 cursor-pointer hover:bg-muted/30" onClick={() => toggleDespesasExpand(sq.squad)}>
                                <td className="py-1.5 px-3 pl-7 text-xs text-red-500 dark:text-red-400 sticky left-0 z-10 bg-background flex items-center gap-1">
                                  {expandedDespesas.has(sq.squad) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  Despesas
                                </td>
                                {monthlyResults.map((_, i) => {
                                  const desp = tableData.despesaSquadMes(sq, i);
                                  return (
                                    <td key={i} className="py-1.5 px-2 text-right text-xs text-red-500 dark:text-red-400">
                                      {desp > 0 ? formatCurrencyNoDecimals(desp) : "-"}
                                    </td>
                                  );
                                })}
                                <td className="py-1.5 px-3 text-right text-xs font-semibold text-red-500 dark:text-red-400">
                                  {formatCurrencyNoDecimals(totalDespesaSquad)}
                                </td>
                                <td />
                              </tr>
                              {expandedDespesas.has(sq.squad) && (
                                <>
                                  {[
                                    { label: "Salários", data: tableData.salariosPorMes, expandable: true },
                                    { label: "Freelancers", data: tableData.freelancersPorMes, expandable: false },
                                  ].map(({ label, data, expandable }) => {
                                    const total = monthlyResults.reduce((acc, _, i) => acc + tableData.despesaComponenteSquadMes(sq, i, data), 0);
                                    const salKey = `${sq.squad}__${label}`;
                                    const isExpanded = expandable && expandedSalarios.has(salKey);
                                    return (
                                      <Fragment key={label}>
                                        <tr
                                          className={cn("border-b border-border/20", expandable && "cursor-pointer hover:bg-muted/20")}
                                          onClick={expandable ? (e) => { e.stopPropagation(); toggleSalariosExpand(salKey); } : undefined}
                                        >
                                          <td className="py-1 px-3 pl-12 text-[11px] text-red-400/70 dark:text-red-400/50 sticky left-0 z-10 bg-background">
                                            <span className="flex items-center gap-1">
                                              {expandable && (isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />)}
                                              {label}
                                            </span>
                                          </td>
                                          {monthlyResults.map((_, i) => {
                                            const val = tableData.despesaComponenteSquadMes(sq, i, data);
                                            return (
                                              <td key={i} className="py-1 px-2 text-right text-[11px] text-red-400/70 dark:text-red-400/50">
                                                {val > 0 ? formatCurrencyNoDecimals(val) : "-"}
                                              </td>
                                            );
                                          })}
                                          <td className="py-1 px-3 text-right text-[11px] font-medium text-red-400/70 dark:text-red-400/50">
                                            {total > 0 ? formatCurrencyNoDecimals(total) : "-"}
                                          </td>
                                          <td />
                                        </tr>
                                        {isExpanded && (bulkData?.salariosDetalhesPorSquad?.[sq.squad] || []).map((colab, idx) => (
                                          <tr key={`${colab.nome}-${idx}`} className="border-b border-border/10">
                                            <td className="py-0.5 px-3 pl-[72px] text-[10px] text-red-400/50 dark:text-red-400/35 sticky left-0 z-10 bg-background truncate max-w-[160px]" title={colab.nome}>
                                              {colab.nome}
                                            </td>
                                            {monthlyResults.map((_, i) => (
                                              <td key={i} className="py-0.5 px-2 text-right text-[10px] text-red-400/50 dark:text-red-400/35">
                                                {colab.porMes[i] > 0 ? formatCurrencyNoDecimals(colab.porMes[i]) : "-"}
                                              </td>
                                            ))}
                                            <td className="py-0.5 px-3 text-right text-[10px] font-medium text-red-400/50 dark:text-red-400/35">
                                              {formatCurrencyNoDecimals(colab.total)}
                                            </td>
                                            <td />
                                          </tr>
                                        ))}
                                      </Fragment>
                                    );
                                  })}
                                </>
                              )}

                              {/* Margem */}
                              <tr className="border-b border-border/30">
                                <td className="py-1.5 px-3 pl-9 text-xs font-bold text-blue-600 dark:text-blue-400 sticky left-0 z-10 bg-background">
                                  Margem
                                </td>
                                {monthlyResults.map((_, i) => {
                                  const receita = sq.porMes[i] || 0;
                                  const desp = tableData.despesaSquadMes(sq, i);
                                  const margem = receita - desp;
                                  return (
                                    <td key={i} className={cn(
                                      "py-1.5 px-2 text-right text-xs font-bold",
                                      margem >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-500 dark:text-red-400"
                                    )}>
                                      {receita > 0 ? formatCurrencyNoDecimals(margem) : "-"}
                                    </td>
                                  );
                                })}
                                <td className={cn(
                                  "py-1.5 px-3 text-right text-xs font-bold",
                                  totalMargemSquad >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-500 dark:text-red-400"
                                )}>
                                  {formatCurrencyNoDecimals(totalMargemSquad)}
                                </td>
                                <td />
                              </tr>

                              {/* Margem % */}
                              <tr className="border-b border-border/50">
                                <td className="py-1.5 px-3 pl-9 text-xs text-muted-foreground sticky left-0 z-10 bg-background">
                                  Margem %
                                </td>
                                {monthlyResults.map((_, i) => {
                                  const receita = sq.porMes[i] || 0;
                                  const desp = tableData.despesaSquadMes(sq, i);
                                  const margemPct = receita > 0 ? ((receita - desp) / receita) * 100 : 0;
                                  return (
                                    <td key={i} className="py-1.5 px-2 text-right text-xs text-muted-foreground">
                                      {receita > 0 ? `${margemPct.toFixed(1)}%` : "-"}
                                    </td>
                                  );
                                })}
                                <td className="py-1.5 px-3 text-right text-xs font-semibold text-muted-foreground">
                                  {totalMargemPctSquad > 0 ? `${totalMargemPctSquad.toFixed(1)}%` : "-"}
                                </td>
                                <td />
                              </tr>
                            </>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>

                  {/* TOTAL row */}
                  <tfoot>
                    <tr className="border-t-2 border-foreground/20 bg-muted">
                      <td className="py-2.5 px-3 font-bold text-sm sticky left-0 z-10 bg-muted" colSpan={1}>
                        TOTAL
                      </td>
                      {monthlyResults.map((m) => (
                        <td key={m.mes} className="py-2.5 px-2" />
                      ))}
                      <td className="py-2.5 px-3" />
                      <td className="py-2.5 px-3 text-right text-xs font-bold text-muted-foreground">100%</td>
                    </tr>
                    {/* Total Receita (expandível) */}
                    <tr className="border-b border-border/30 bg-muted cursor-pointer hover:bg-muted/80" onClick={() => toggleReceitasExpand("__total__")}>
                      <td className="py-1.5 px-3 pl-7 text-xs text-emerald-600 dark:text-emerald-400 font-medium sticky left-0 z-10 bg-muted flex items-center gap-1">
                        {expandedReceitas.has("__total__") ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Receita
                      </td>
                      {tableData.receitaTotalPorMes.map((val, i) => (
                        <td key={i} className="py-1.5 px-2 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {val > 0 ? formatCurrencyNoDecimals(val) : "-"}
                        </td>
                      ))}
                      <td className="py-1.5 px-3 text-right text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyNoDecimals(tableData.totalReceita)}
                      </td>
                      <td />
                    </tr>
                    {expandedReceitas.has("__total__") && (() => {
                      // Agregar todos os clientes de todos os squads com porMes somados
                      const clienteMap = new Map<string, { porMes: number[]; total: number }>();
                      for (const clientes of Object.values(bulkData?.receitasDetalhesPorSquad || {})) {
                        for (const c of clientes) {
                          const existing = clienteMap.get(c.cliente);
                          if (existing) {
                            c.porMes.forEach((v, i) => { existing.porMes[i] += v; });
                            existing.total += c.total;
                          } else {
                            clienteMap.set(c.cliente, { porMes: [...c.porMes], total: c.total });
                          }
                        }
                      }
                      return Array.from(clienteMap.entries())
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([cliente, data], idx) => (
                          <tr key={`${cliente}-${idx}`} className="border-b border-border/10 bg-muted">
                            <td className="py-0.5 px-3 pl-12 text-[10px] text-emerald-500/70 dark:text-emerald-400/50 font-medium sticky left-0 z-10 bg-muted truncate max-w-[200px]" title={cliente}>
                              {cliente}
                            </td>
                            {monthlyResults.map((_, i) => (
                              <td key={i} className="py-0.5 px-2 text-right text-[10px] text-emerald-500/70 dark:text-emerald-400/50">
                                {data.porMes[i] > 0 ? formatCurrencyNoDecimals(data.porMes[i]) : "-"}
                              </td>
                            ))}
                            <td className="py-0.5 px-3 text-right text-[10px] font-medium text-emerald-500/70 dark:text-emerald-400/50">
                              {formatCurrencyNoDecimals(data.total)}
                            </td>
                            <td />
                          </tr>
                        ));
                    })()}
                    {/* Total Despesas (expandível) */}
                    <tr className="border-b border-border/30 bg-muted cursor-pointer hover:bg-muted/80" onClick={() => toggleDespesasExpand("__total__")}>
                      <td className="py-1.5 px-3 pl-7 text-xs text-red-500 dark:text-red-400 font-medium sticky left-0 z-10 bg-muted flex items-center gap-1">
                        {expandedDespesas.has("__total__") ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Despesas
                      </td>
                      {tableData.despesaTotalPorMes.map((val, i) => (
                        <td key={i} className="py-1.5 px-2 text-right text-xs font-semibold text-red-500 dark:text-red-400">
                          {val > 0 ? formatCurrencyNoDecimals(val) : "-"}
                        </td>
                      ))}
                      <td className="py-1.5 px-3 text-right text-xs font-bold text-red-500 dark:text-red-400">
                        {formatCurrencyNoDecimals(tableData.totalDespesa)}
                      </td>
                      <td />
                    </tr>
                    {expandedDespesas.has("__total__") && (
                      <>
                        {[
                          { label: "Salários", data: tableData.salariosPorMes, expandable: true },
                          { label: "Freelancers", data: tableData.freelancersPorMes, expandable: false },
                        ].map(({ label, data, expandable }) => {
                          const total = data.reduce((acc, v) => acc + v, 0);
                          const salKey = `__total____${label}`;
                          const isExpanded = expandable && expandedSalarios.has(salKey);
                          return (
                            <Fragment key={label}>
                              <tr
                                className={cn("border-b border-border/20 bg-muted", expandable && "cursor-pointer hover:bg-muted/80")}
                                onClick={expandable ? (e) => { e.stopPropagation(); toggleSalariosExpand(salKey); } : undefined}
                              >
                                <td className="py-1 px-3 pl-12 text-[11px] text-red-400/70 dark:text-red-400/50 font-medium sticky left-0 z-10 bg-muted">
                                  <span className="flex items-center gap-1">
                                    {expandable && (isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />)}
                                    {label}
                                  </span>
                                </td>
                                {data.map((val, i) => (
                                  <td key={i} className="py-1 px-2 text-right text-[11px] text-red-400/70 dark:text-red-400/50">
                                    {val > 0 ? formatCurrencyNoDecimals(val) : "-"}
                                  </td>
                                ))}
                                <td className="py-1 px-3 text-right text-[11px] font-medium text-red-400/70 dark:text-red-400/50">
                                  {total > 0 ? formatCurrencyNoDecimals(total) : "-"}
                                </td>
                                <td />
                              </tr>
                              {isExpanded && Object.values(bulkData?.salariosDetalhesPorSquad || {}).flat().sort((a, b) => b.total - a.total).map((colab, idx) => (
                                <tr key={`${colab.nome}-${idx}`} className="border-b border-border/10 bg-muted">
                                  <td className="py-0.5 px-3 pl-[72px] text-[10px] text-red-400/50 dark:text-red-400/35 font-medium sticky left-0 z-10 bg-muted truncate max-w-[160px]" title={colab.nome}>
                                    {colab.nome}
                                  </td>
                                  {monthlyResults.map((_, i) => (
                                    <td key={i} className="py-0.5 px-2 text-right text-[10px] text-red-400/50 dark:text-red-400/35">
                                      {colab.porMes[i] > 0 ? formatCurrencyNoDecimals(colab.porMes[i]) : "-"}
                                    </td>
                                  ))}
                                  <td className="py-0.5 px-3 text-right text-[10px] font-medium text-red-400/50 dark:text-red-400/35">
                                    {formatCurrencyNoDecimals(colab.total)}
                                  </td>
                                  <td />
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}
                      </>
                    )}
                    {/* Total Margem */}
                    <tr className="border-b border-border/30 bg-muted">
                      <td className="py-1.5 px-3 pl-9 text-xs font-bold text-blue-600 dark:text-blue-400 sticky left-0 z-10 bg-muted">
                        Margem
                      </td>
                      {monthlyResults.map((_, i) => {
                        const margem = tableData.receitaTotalPorMes[i] - tableData.despesaTotalPorMes[i];
                        return (
                          <td key={i} className={cn(
                            "py-1.5 px-2 text-right text-xs font-bold",
                            margem >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-500 dark:text-red-400"
                          )}>
                            {tableData.receitaTotalPorMes[i] > 0 ? formatCurrencyNoDecimals(margem) : "-"}
                          </td>
                        );
                      })}
                      <td className={cn(
                        "py-1.5 px-3 text-right text-xs font-bold",
                        tableData.totalMargem >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-500 dark:text-red-400"
                      )}>
                        {formatCurrencyNoDecimals(tableData.totalMargem)}
                      </td>
                      <td />
                    </tr>
                    {/* Total Margem % */}
                    <tr className="bg-muted">
                      <td className="py-1.5 px-3 pl-9 text-xs text-muted-foreground font-medium sticky left-0 z-10 bg-muted">
                        Margem %
                      </td>
                      {monthlyResults.map((_, i) => {
                        const rec = tableData.receitaTotalPorMes[i];
                        const desp = tableData.despesaTotalPorMes[i];
                        const pct = rec > 0 ? ((rec - desp) / rec) * 100 : 0;
                        return (
                          <td key={i} className="py-1.5 px-2 text-right text-xs font-semibold text-muted-foreground">
                            {rec > 0 ? `${pct.toFixed(1)}%` : "-"}
                          </td>
                        );
                      })}
                      <td className="py-1.5 px-3 text-right text-xs font-bold text-muted-foreground">
                        {tableData.totalMargemPct !== 0 ? `${tableData.totalMargemPct.toFixed(1)}%` : "-"}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

