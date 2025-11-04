import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, Calendar } from "lucide-react";
import type { DfcResponse } from "@shared/schema";

export default function DashboardDFC() {
  const [filterMesInicio, setFilterMesInicio] = useState<string>("");
  const [filterMesFim, setFilterMesFim] = useState<string>("");

  const { data: dfcData, isLoading } = useQuery<DfcResponse>({
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

  const tableData = useMemo(() => {
    if (!dfcData || dfcData.items.length === 0) {
      return { categorias: [], meses: [], dataMap: new Map<string, Map<string, number>>() };
    }

    const categoriasSet = new Set<string>();
    const dataMap = new Map<string, Map<string, number>>();

    dfcData.items.forEach(item => {
      const key = `${item.categoriaId}|${item.categoriaNome}`;
      categoriasSet.add(key);

      if (!dataMap.has(key)) {
        dataMap.set(key, new Map());
      }
      dataMap.get(key)!.set(item.mes, item.valorTotal);
    });

    const categorias = Array.from(categoriasSet).sort((a, b) => {
      const nomeA = a.split('|')[1];
      const nomeB = b.split('|')[1];
      return nomeA.localeCompare(nomeB);
    });

    const meses = dfcData.meses.sort();

    return { categorias, meses, dataMap };
  }, [dfcData]);

  const kpis = useMemo(() => {
    if (!dfcData || dfcData.items.length === 0) {
      return {
        totalCategorias: 0,
        totalMeses: 0,
        valorTotal: 0,
      };
    }

    const totalCategorias = new Set(dfcData.items.map(item => item.categoriaId)).size;
    const totalMeses = dfcData.meses.length;
    const valorTotal = dfcData.items.reduce((sum, item) => sum + item.valorTotal, 0);

    return { totalCategorias, totalMeses, valorTotal };
  }, [dfcData]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              DFC - Demonstração de Fluxo de Caixa
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise de categorias de fluxo de caixa ao longo dos meses
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
                  Categorias distintas
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
                  R$ {kpis.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    Fluxo de Caixa por Categoria
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Visualize os valores por categoria ao longo dos meses
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
              ) : !dfcData || tableData.categorias.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum dado de DFC disponível para os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-semibold bg-muted sticky left-0 z-10 min-w-[200px]">
                            Categoria
                          </th>
                          {tableData.meses.map(mes => {
                            const [ano, mesNum] = mes.split('-');
                            const data = new Date(parseInt(ano), parseInt(mesNum) - 1);
                            const mesFormatado = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                            return (
                              <th key={mes} className="text-center p-3 font-semibold bg-muted min-w-[120px]">
                                {mesFormatado}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.categorias.map((categoriaKey) => {
                          const [categoriaId, categoriaNome] = categoriaKey.split('|');
                          return (
                            <tr 
                              key={categoriaKey} 
                              className="border-b hover-elevate"
                              data-testid={`dfc-row-${categoriaId}`}
                            >
                              <td className="p-3 font-medium bg-background sticky left-0 z-10">
                                {categoriaNome}
                              </td>
                              {tableData.meses.map(mes => {
                                const valor = tableData.dataMap.get(categoriaKey)?.get(mes);
                                return (
                                  <td 
                                    key={mes} 
                                    className="p-3 text-center"
                                    data-testid={`dfc-cell-${categoriaId}-${mes}`}
                                  >
                                    {valor !== undefined ? (
                                      <span className="font-semibold">
                                        R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
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
