import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, TrendingDown, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { ClienteContratoDetail, ChurnPorServico } from "@shared/schema";

interface CohortRetentionRow {
  cohortMonth: string;
  cohortLabel: string;
  totalClients: number;
  totalValue: number;
  totalContracts: number;
  clientesContratos: ClienteContratoDetail[];
  retentionByMonth: {
    [monthOffset: number]: {
      activeClients: number;
      retentionRate: number;
      activeValue: number;
      valueRetentionRate: number;
      activeContracts: number;
      contractRetentionRate: number;
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

type ViewMode = "clientes" | "valor" | "contratos";
type ViewModeChurn = "quantidade" | "valorTotal" | "percentual";

export default function DashboardRetencao() {
  const [filterSquad, setFilterSquad] = useState<string>("todos");
  const [filterServicos, setFilterServicos] = useState<string[]>([]);
  const [filterMesInicio, setFilterMesInicio] = useState<string>("");
  const [filterMesFim, setFilterMesFim] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("clientes");

  // Estados para análise de churn por serviço
  const [churnFilterServicos, setChurnFilterServicos] = useState<string[]>([]);
  const [churnFilterMesInicio, setChurnFilterMesInicio] = useState<string>("");
  const [churnFilterMesFim, setChurnFilterMesFim] = useState<string>("");
  const [churnViewMode, setChurnViewMode] = useState<ViewModeChurn>("quantidade");

  const { data: cohortData, isLoading } = useQuery<CohortRetentionData>({
    queryKey: ["/api/analytics/cohort-retention", filterSquad, filterServicos, filterMesInicio, filterMesFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterSquad !== "todos") params.append("squad", filterSquad);
      if (filterServicos.length > 0) params.append("servico", filterServicos.join(","));
      if (filterMesInicio) params.append("mesInicio", filterMesInicio);
      if (filterMesFim) params.append("mesFim", filterMesFim);
      
      const res = await fetch(`/api/analytics/cohort-retention?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch cohort data");
      return res.json();
    },
  });

  const { data: churnData, isLoading: isChurnLoading } = useQuery<ChurnPorServico[]>({
    queryKey: ["/api/churn-por-servico", churnFilterServicos, churnFilterMesInicio, churnFilterMesFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (churnFilterServicos.length > 0) params.append("servico", churnFilterServicos.join(","));
      if (churnFilterMesInicio) params.append("mesInicio", churnFilterMesInicio);
      if (churnFilterMesFim) params.append("mesFim", churnFilterMesFim);
      
      const res = await fetch(`/api/churn-por-servico?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch churn data");
      return res.json();
    },
  });

  const kpis = useMemo(() => {
    if (!cohortData || cohortData.cohorts.length === 0) {
      return {
        totalClients: 0,
        totalValue: 0,
        totalContracts: 0,
        avgRetentionMonth3: 0,
        avgRetentionMonth6: 0,
        avgChurnRate: 0,
      };
    }

    const totalClients = cohortData.cohorts.reduce((sum, cohort) => sum + cohort.totalClients, 0);
    const totalValue = cohortData.cohorts.reduce((sum, cohort) => sum + cohort.totalValue, 0);
    const totalContracts = cohortData.cohorts.reduce((sum, cohort) => sum + cohort.totalContracts, 0);
    
    const retentionsMonth3: number[] = [];
    const retentionsMonth6: number[] = [];
    
    cohortData.cohorts.forEach(cohort => {
      if (cohort.retentionByMonth[3]) {
        const rate = viewMode === "clientes" 
          ? cohort.retentionByMonth[3].retentionRate 
          : viewMode === "valor"
          ? cohort.retentionByMonth[3].valueRetentionRate
          : cohort.retentionByMonth[3].contractRetentionRate;
        retentionsMonth3.push(rate);
      }
      if (cohort.retentionByMonth[6]) {
        const rate = viewMode === "clientes"
          ? cohort.retentionByMonth[6].retentionRate
          : viewMode === "valor"
          ? cohort.retentionByMonth[6].valueRetentionRate
          : cohort.retentionByMonth[6].contractRetentionRate;
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
      totalContracts,
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

  // Processar dados de churn por serviço
  const churnTableData = useMemo(() => {
    if (!churnData || churnData.length === 0) {
      return { servicos: [], meses: [], dataMap: new Map<string, Map<string, ChurnPorServico>>() };
    }

    const servicosSet = new Set<string>();
    const mesesSet = new Set<string>();
    const dataMap = new Map<string, Map<string, ChurnPorServico>>();

    churnData.forEach(item => {
      servicosSet.add(item.servico);
      mesesSet.add(item.mes);

      if (!dataMap.has(item.servico)) {
        dataMap.set(item.servico, new Map());
      }
      dataMap.get(item.servico)!.set(item.mes, item);
    });

    const servicos = Array.from(servicosSet).sort();
    const meses = Array.from(mesesSet).sort();

    return { servicos, meses, dataMap };
  }, [churnData]);

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
            <Button
              variant={viewMode === "contratos" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("contratos")}
              data-testid="button-view-contratos"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Contratos
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
                  {viewMode === "clientes" 
                    ? "Total de Clientes" 
                    : viewMode === "valor"
                    ? "Valor Total MRR"
                    : "Total de Contratos"
                  }
                </CardTitle>
                {viewMode === "clientes" ? (
                  <Users className="h-4 w-4 text-muted-foreground" />
                ) : viewMode === "valor" ? (
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-clients">
                  {viewMode === "clientes" 
                    ? kpis.totalClients 
                    : viewMode === "valor"
                    ? `R$ ${kpis.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : kpis.totalContracts
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

                  <MultiSelect
                    options={uniqueServicos}
                    selected={filterServicos}
                    onChange={setFilterServicos}
                    placeholder="Selecionar Serviços"
                    searchPlaceholder="Buscar serviço..."
                    emptyText="Nenhum serviço encontrado"
                    className="w-[240px]"
                  />
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
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <span className="hover:text-primary transition-colors cursor-help underline decoration-dotted inline-block">
                                    {viewMode === "clientes" 
                                      ? cohort.totalClients
                                      : viewMode === "valor"
                                      ? `R$ ${cohort.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                      : cohort.totalContracts
                                    }
                                  </span>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80 max-h-96 overflow-auto" data-testid={`hover-details-${cohort.cohortMonth}`}>
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm mb-3">
                                      Detalhes da Coorte {cohort.cohortLabel}
                                    </h4>
                                    <div className="space-y-1">
                                      {!cohort.clientesContratos || cohort.clientesContratos.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Nenhum contrato encontrado</p>
                                      ) : (
                                        cohort.clientesContratos.map((contrato, idx) => (
                                          <div 
                                            key={`${contrato.clienteId}-${idx}`}
                                            className="text-sm py-1 border-b last:border-0"
                                          >
                                            {contrato.nomeCliente} - {contrato.servico}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
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
                              
                              const rate = viewMode === "clientes" 
                                ? data.retentionRate 
                                : viewMode === "valor"
                                ? data.valueRetentionRate
                                : data.contractRetentionRate;
                              const activeMetric = viewMode === "clientes" 
                                ? data.activeClients 
                                : viewMode === "valor"
                                ? data.activeValue
                                : data.activeContracts;
                              const totalMetric = viewMode === "clientes" 
                                ? cohort.totalClients 
                                : viewMode === "valor"
                                ? cohort.totalValue
                                : cohort.totalContracts;
                              
                              return (
                                <td 
                                  key={offset} 
                                  className="p-2 text-center"
                                  data-testid={`cell-${cohort.cohortMonth}-${offset}`}
                                >
                                  <div className="flex flex-col items-center gap-1">
                                    <Badge 
                                      variant="outline"
                                      className={`${getRetentionColor(rate)} font-semibold min-w-[70px]`}
                                    >
                                      {rate.toFixed(0)}%
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {viewMode === "clientes" 
                                        ? `${activeMetric}/${totalMetric}`
                                        : viewMode === "valor"
                                        ? `R$ ${activeMetric.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                        : `${activeMetric}/${totalMetric}`
                                      }
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

          {/* Seção de Análise de Churn por Serviço */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Análise de Churn por Serviço</CardTitle>
                  <CardDescription>Contratos encerrados por serviço ao longo dos meses</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[250px]">
                  <label className="text-sm font-medium mb-2 block">Serviços</label>
                  <MultiSelect
                    options={uniqueServicos.map(s => ({ label: s, value: s }))}
                    selected={churnFilterServicos}
                    onChange={setChurnFilterServicos}
                    placeholder="Todos os serviços"
                    data-testid="multiselect-churn-servicos"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="text-sm font-medium mb-2 block">Mês Início</label>
                  <input
                    type="month"
                    value={churnFilterMesInicio}
                    onChange={(e) => setChurnFilterMesInicio(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                    data-testid="input-churn-mes-inicio"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="text-sm font-medium mb-2 block">Mês Fim</label>
                  <input
                    type="month"
                    value={churnFilterMesFim}
                    onChange={(e) => setChurnFilterMesFim(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                    data-testid="input-churn-mes-fim"
                  />
                </div>
              </div>

              {/* Toggle de Visualização */}
              <div className="flex gap-2 mb-6">
                <Button
                  variant={churnViewMode === "quantidade" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChurnViewMode("quantidade")}
                  data-testid="button-churn-view-quantidade"
                >
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Quantidade
                </Button>
                <Button
                  variant={churnViewMode === "valorTotal" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChurnViewMode("valorTotal")}
                  data-testid="button-churn-view-valor"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Valor R$
                </Button>
                <Button
                  variant={churnViewMode === "percentual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChurnViewMode("percentual")}
                  data-testid="button-churn-view-percentual"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  % Churn
                </Button>
              </div>

              {/* Tabela de Churn */}
              {isChurnLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : churnTableData.servicos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Nenhum dado de churn disponível para os filtros selecionados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-semibold sticky left-0 bg-muted/50 z-10">Serviço</th>
                        {churnTableData.meses.map(mes => {
                          const [ano, mesNum] = mes.split('-');
                          const data = new Date(parseInt(ano), parseInt(mesNum) - 1);
                          const mesLabel = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                          return (
                            <th key={mes} className="p-3 text-center font-semibold" data-testid={`header-churn-mes-${mes}`}>
                              {mesLabel}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {churnTableData.servicos.map(servico => (
                        <tr key={servico} className="border-b hover-elevate">
                          <td className="p-3 font-medium sticky left-0 bg-background z-10" data-testid={`row-churn-servico-${servico}`}>
                            {servico}
                          </td>
                          {churnTableData.meses.map(mes => {
                            const data = churnTableData.dataMap.get(servico)?.get(mes);
                            const valor = data 
                              ? churnViewMode === "quantidade" 
                                ? data.quantidade
                                : churnViewMode === "valorTotal"
                                ? data.valorTotal
                                : data.percentualChurn
                              : 0;

                            return (
                              <td key={mes} className="p-3 text-center" data-testid={`cell-churn-${servico}-${mes}`}>
                                {data ? (
                                  <HoverCard>
                                    <HoverCardTrigger asChild>
                                      <span className="cursor-help font-semibold hover-elevate px-2 py-1 rounded">
                                        {churnViewMode === "quantidade" 
                                          ? valor
                                          : churnViewMode === "valorTotal"
                                          ? `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                          : `${valor.toFixed(1)}%`
                                        }
                                      </span>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-80" data-testid={`hover-churn-${servico}-${mes}`}>
                                      <div className="space-y-2">
                                        <h4 className="font-semibold text-sm">
                                          {servico} - {mes}
                                        </h4>
                                        <div className="space-y-1 text-sm">
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">Contratos:</span>
                                            <span className="font-medium">{data.quantidade}</span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">Valor:</span>
                                            <span className="font-medium">R$ {data.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">% Churn:</span>
                                            <span className="font-medium">{data.percentualChurn.toFixed(1)}%</span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">Valor ativo mês:</span>
                                            <span className="font-medium">R$ {data.valorAtivoMes.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                          </p>
                                        </div>
                                      </div>
                                    </HoverCardContent>
                                  </HoverCard>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Linha de TOTAL */}
                      <tr className="border-t-2 font-bold bg-muted/30">
                        <td className="p-3 sticky left-0 bg-muted/30 z-10" data-testid="row-churn-total">
                          TOTAL
                        </td>
                        {churnTableData.meses.map(mes => {
                          let total = 0;
                          churnTableData.servicos.forEach(servico => {
                            const data = churnTableData.dataMap.get(servico)?.get(mes);
                            if (data) {
                              if (churnViewMode === "quantidade") {
                                total += data.quantidade;
                              } else if (churnViewMode === "valorTotal") {
                                total += data.valorTotal;
                              } else {
                                // Para percentual, calcular média ponderada
                                total += data.percentualChurn;
                              }
                            }
                          });

                          // Para percentual, calcular média
                          if (churnViewMode === "percentual" && churnTableData.servicos.length > 0) {
                            total = total / churnTableData.servicos.length;
                          }

                          return (
                            <td key={mes} className="p-3 text-center" data-testid={`cell-churn-total-${mes}`}>
                              {churnViewMode === "quantidade" 
                                ? total
                                : churnViewMode === "valorTotal"
                                ? `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                : `${total.toFixed(1)}%`
                              }
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
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
