import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, TrendingDown, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CohortRetentionRow {
  cohortMonth: string;
  cohortLabel: string;
  totalClients: number;
  totalValue: number;
  retentionByMonth: {
    [monthOffset: number]: {
      activeClients: number;
      retentionRate: number;
      activeValue: number;
      valueRetentionRate: number;
    };
  };
}

interface CohortRetentionData {
  cohorts: CohortRetentionRow[];
  maxMonthOffset: number;
  filters: {
    squad?: string;
    servico?: string;
  };
  availableServicos: string[];
  availableSquads: string[];
}

type ViewMode = "clientes" | "valor";

export default function DashboardRetencao() {
  const [filterSquad, setFilterSquad] = useState<string>("todos");
  const [filterServico, setFilterServico] = useState<string>("todos");
  const [filterMesInicio, setFilterMesInicio] = useState<string>("");
  const [filterMesFim, setFilterMesFim] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("clientes");

  const { data: cohortData, isLoading } = useQuery<CohortRetentionData>({
    queryKey: ["/api/analytics/cohort-retention", filterSquad, filterServico, filterMesInicio, filterMesFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterSquad !== "todos") params.append("squad", filterSquad);
      if (filterServico !== "todos") params.append("servico", filterServico);
      if (filterMesInicio) params.append("mesInicio", filterMesInicio);
      if (filterMesFim) params.append("mesFim", filterMesFim);
      
      const res = await fetch(`/api/analytics/cohort-retention?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch cohort data");
      return res.json();
    },
  });

  const kpis = useMemo(() => {
    if (!cohortData || cohortData.cohorts.length === 0) {
      return {
        totalClients: 0,
        totalValue: 0,
        avgRetentionMonth3: 0,
        avgRetentionMonth6: 0,
        avgChurnRate: 0,
      };
    }

    const totalClients = cohortData.cohorts.reduce((sum, cohort) => sum + cohort.totalClients, 0);
    const totalValue = cohortData.cohorts.reduce((sum, cohort) => sum + cohort.totalValue, 0);
    
    const retentionsMonth3: number[] = [];
    const retentionsMonth6: number[] = [];
    
    cohortData.cohorts.forEach(cohort => {
      if (cohort.retentionByMonth[3]) {
        const rate = viewMode === "clientes" 
          ? cohort.retentionByMonth[3].retentionRate 
          : cohort.retentionByMonth[3].valueRetentionRate;
        retentionsMonth3.push(rate);
      }
      if (cohort.retentionByMonth[6]) {
        const rate = viewMode === "clientes"
          ? cohort.retentionByMonth[6].retentionRate
          : cohort.retentionByMonth[6].valueRetentionRate;
        retentionsMonth6.push(rate);
      }
    });

    const avgRetentionMonth3 = retentionsMonth3.length > 0
      ? retentionsMonth3.reduce((a, b) => a + b, 0) / retentionsMonth3.length
      : 0;

    const avgRetentionMonth6 = retentionsMonth6.length > 0
      ? retentionsMonth6.reduce((a, b) => a + b, 0) / retentionsMonth6.length
      : 0;

    const avgChurnRate = 100 - avgRetentionMonth3;

    return {
      totalClients,
      totalValue,
      avgRetentionMonth3,
      avgRetentionMonth6,
      avgChurnRate,
    };
  }, [cohortData, viewMode]);

  const getRetentionColor = (rate: number): string => {
    if (rate >= 80) return "bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-100 border-green-300 dark:border-green-700";
    if (rate >= 60) return "bg-lime-100 dark:bg-lime-950 text-lime-900 dark:text-lime-100 border-lime-300 dark:border-lime-700";
    if (rate >= 40) return "bg-yellow-100 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700";
    if (rate >= 20) return "bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-100 border-orange-300 dark:border-orange-700";
    return "bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-100 border-red-300 dark:border-red-700";
  };

  const uniqueServicos = useMemo(() => {
    if (!cohortData) return [];
    return cohortData.availableServicos || [];
  }, [cohortData]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">Análise de Retenção</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise de coorte de clientes por mês de início do contrato
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "clientes" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("clientes")}
              data-testid="button-view-clientes"
            >
              <Users className="h-4 w-4 mr-2" />
              Clientes
            </Button>
            <Button
              variant={viewMode === "valor" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("valor")}
              data-testid="button-view-valor"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Valor MRR
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-clients">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">
                  {viewMode === "clientes" ? "Total de Clientes" : "Valor Total MRR"}
                </CardTitle>
                {viewMode === "clientes" ? (
                  <Users className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-clients">
                  {viewMode === "clientes" 
                    ? kpis.totalClients 
                    : `R$ ${kpis.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Desde o início
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-retention-month3">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Retenção Mês 3</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-retention-month3">
                  {kpis.avgRetentionMonth3.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Taxa média de retenção
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-retention-month6">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Retenção Mês 6</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-retention-month6">
                  {kpis.avgRetentionMonth6.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Taxa média de retenção
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-churn-rate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-churn-rate">
                  {kpis.avgChurnRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Perda média (Mês 3)
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Tabela de Coorte
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Acompanhe a retenção de clientes mês a mês desde o início do contrato
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

                  <Select value={filterSquad} onValueChange={setFilterSquad}>
                    <SelectTrigger className="w-[160px]" data-testid="select-squad-filter">
                      <SelectValue placeholder="Filtrar Squad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas Squads</SelectItem>
                      <SelectItem value="0">Supreme</SelectItem>
                      <SelectItem value="1">Forja</SelectItem>
                      <SelectItem value="2">Squadra</SelectItem>
                      <SelectItem value="3">Chama</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterServico} onValueChange={setFilterServico}>
                    <SelectTrigger className="w-[160px]" data-testid="select-servico-filter">
                      <SelectValue placeholder="Filtrar Serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Serviços</SelectItem>
                      {uniqueServicos.map(servico => (
                        <SelectItem key={servico} value={servico}>{servico}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12" data-testid="loading-cohort">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : !cohortData || cohortData.cohorts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum dado de coorte disponível para os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-semibold bg-muted sticky left-0 z-10">
                            Coorte
                          </th>
                          <th className="text-center p-3 font-semibold bg-muted min-w-[100px]">
                            Total
                          </th>
                          {Array.from({ length: cohortData.maxMonthOffset + 1 }, (_, i) => i).map(offset => (
                            <th key={offset} className="text-center p-3 font-semibold bg-muted min-w-[90px]">
                              Mês {offset}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cohortData.cohorts.map((cohort) => (
                          <tr 
                            key={cohort.cohortMonth} 
                            className="border-b hover-elevate"
                            data-testid={`cohort-row-${cohort.cohortMonth}`}
                          >
                            <td className="p-3 font-medium bg-background sticky left-0 z-10">
                              {cohort.cohortLabel}
                            </td>
                            <td className="p-3 text-center font-semibold" data-testid={`total-${cohort.cohortMonth}`}>
                              {cohort.totalClients}
                            </td>
                            {Array.from({ length: cohortData.maxMonthOffset + 1 }, (_, offset) => {
                              const data = cohort.retentionByMonth[offset];
                              if (!data) {
                                return (
                                  <td key={offset} className="p-3 text-center bg-muted/30">
                                    -
                                  </td>
                                );
                              }
                              
                              return (
                                <td 
                                  key={offset} 
                                  className="p-2 text-center"
                                  data-testid={`cell-${cohort.cohortMonth}-${offset}`}
                                >
                                  <div className="flex flex-col items-center gap-1">
                                    <Badge 
                                      variant="outline"
                                      className={`${getRetentionColor(data.retentionRate)} font-semibold min-w-[70px]`}
                                    >
                                      {data.retentionRate.toFixed(0)}%
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {data.activeClients}/{cohort.totalClients}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Legenda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-100 border-green-300 dark:border-green-700">
                    ≥ 80%
                  </Badge>
                  <span className="text-sm text-muted-foreground">Excelente retenção</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-lime-100 dark:bg-lime-950 text-lime-900 dark:text-lime-100 border-lime-300 dark:border-lime-700">
                    60-79%
                  </Badge>
                  <span className="text-sm text-muted-foreground">Boa retenção</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700">
                    40-59%
                  </Badge>
                  <span className="text-sm text-muted-foreground">Retenção média</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-100 border-orange-300 dark:border-orange-700">
                    20-39%
                  </Badge>
                  <span className="text-sm text-muted-foreground">Retenção baixa</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-100 border-red-300 dark:border-red-700">
                    &lt; 20%
                  </Badge>
                  <span className="text-sm text-muted-foreground">Retenção crítica</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
