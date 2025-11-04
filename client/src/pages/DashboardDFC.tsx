import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, DollarSign, Calendar, ChevronRight, ChevronDown } from "lucide-react";
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
        valorTotal: 0,
      };
    }

    const totalCategorias = dfcData.nodes.filter(n => n.isLeaf).length;
    const totalMeses = dfcData.meses.length;
    
    const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
    const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');
    
    let valorTotal = 0;
    dfcData.meses.forEach(mes => {
      valorTotal += (receitasNode?.valuesByMonth[mes] || 0);
      valorTotal += (despesasNode?.valuesByMonth[mes] || 0);
    });

    return { totalCategorias, totalMeses, valorTotal };
  }, [dfcData]);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              DFC - Demonstração de Fluxo de Caixa
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise hierárquica de categorias de fluxo de caixa
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-total-categorias">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total de Categorias</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-categorias">
                  {kpis.totalCategorias}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Categorias finais
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-meses">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Meses Analisados</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-meses">
                  {kpis.totalMeses}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Período analisado
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-valor-total">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-valor-total">
                  {formatCurrency(kpis.valorTotal)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Soma de todos os valores
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Fluxo de Caixa Hierárquico
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Navegue pela hierarquia de categorias expandindo e colapsando os níveis
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground whitespace-nowrap">De:</label>
                    <input
                      type="month"
                      value={filterMesInicio}
                      onChange={(e) => setFilterMesInicio(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm hover-elevate"
                      data-testid="input-mes-inicio"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground whitespace-nowrap">Até:</label>
                    <input
                      type="month"
                      value={filterMesFim}
                      onChange={(e) => setFilterMesFim(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm hover-elevate"
                      data-testid="input-mes-fim"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12" data-testid="loading-dfc">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : !dfcData || visibleItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum dado de DFC disponível para os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-10 min-w-[300px]">
                            Categoria
                          </TableHead>
                          {dfcData.meses.map(mes => {
                            const [ano, mesNum] = mes.split('-');
                            const data = new Date(parseInt(ano), parseInt(mesNum) - 1);
                            const mesFormatado = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                            return (
                              <TableHead key={mes} className="text-center min-w-[140px]">
                                {mesFormatado}
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleItems.map((item, index) => {
                          if (item.type === 'node') {
                            const node = item.node;
                            const hasParcelas = node.isLeaf && node.parcelas && node.parcelas.length > 0;
                            
                            return (
                              <TableRow 
                                key={node.categoriaId}
                                className="hover-elevate"
                                data-testid={`dfc-row-${node.categoriaId}`}
                              >
                                <TableCell 
                                  className="sticky left-0 bg-background z-10"
                                  style={{ paddingLeft: `${node.nivel * 24 + 12}px` }}
                                >
                                  <div className="flex items-center gap-1">
                                    {!node.isLeaf || hasParcelas ? (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
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
                                      <div className="w-6" />
                                    )}
                                    <span className={node.isLeaf ? "" : "font-semibold"}>
                                      {node.categoriaNome}
                                    </span>
                                  </div>
                                </TableCell>
                                {dfcData.meses.map(mes => {
                                  const valor = node.valuesByMonth[mes] || 0;
                                  return (
                                    <TableCell 
                                      key={mes} 
                                      className="text-center"
                                      data-testid={`dfc-cell-${node.categoriaId}-${mes}`}
                                    >
                                      {valor !== 0 ? (
                                        <span className={node.isLeaf ? "" : "font-semibold"}>
                                          {formatCurrency(valor)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          } else {
                            const parcela = item.parcela;
                            const parentNode = item.parentNode;
                            
                            return (
                              <TableRow 
                                key={`parcela-${parcela.id}`}
                                className="hover-elevate bg-muted/30"
                                data-testid={`dfc-row-parcela-${parcela.id}`}
                              >
                                <TableCell 
                                  className="sticky left-0 bg-muted/30 z-10"
                                  style={{ paddingLeft: `${(parentNode.nivel + 1) * 24 + 12}px` }}
                                >
                                  <div className="flex items-center gap-1">
                                    <div className="w-6" />
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
                                        <span className="text-sm">
                                          {formatCurrency(valor)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
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
