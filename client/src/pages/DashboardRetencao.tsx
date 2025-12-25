import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, TrendingDown, TrendingUp, Calendar, DollarSign, ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatPercent, formatCurrency } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ClienteContratoDetail, ChurnPorServico, ChurnPorResponsavel } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps, Cell } from "recharts";
import { isAnomaly, getAnomalyDirection } from "@/components/ui/chart-tooltip";

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
  useSetPageInfo("Análise de Retenção", "Análise de coorte de clientes por mês de início do contrato");
  
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
  
  // Estados para análise de churn por responsável
  const [churnRespFilterServicos, setChurnRespFilterServicos] = useState<string[]>([]);
  const [churnRespFilterSquads, setChurnRespFilterSquads] = useState<string[]>([]);
  const [churnRespFilterColaboradores, setChurnRespFilterColaboradores] = useState<string[]>([]);
  const [churnRespFilterMesInicio, setChurnRespFilterMesInicio] = useState<string>("");
  const [churnRespFilterMesFim, setChurnRespFilterMesFim] = useState<string>("");
  
  // Estados para minimizar cards
  const [isCohortMinimized, setIsCohortMinimized] = useState<boolean>(true);
  
  // Estado para drill-down dialog
  const [drillDownData, setDrillDownData] = useState<{
    isOpen: boolean;
    title: string;
    type: "churn_responsavel" | "cohort" | "churn_servico" | null;
    data: ChurnPorResponsavel | CohortRetentionRow | ChurnPorServico | null;
  }>({
    isOpen: false,
    title: "",
    type: null,
    data: null,
  });
  const [isChurnMinimized, setIsChurnMinimized] = useState<boolean>(true);
  const [isChurnRespMinimized, setIsChurnRespMinimized] = useState<boolean>(true);

  const handleChurnServicosChange = (selected: string[]) => {
    console.log("Churn servicos changed:", selected);
    setChurnFilterServicos(selected);
  };

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
      if (churnFilterServicos.length > 0) params.append("produto", churnFilterServicos.join(","));
      if (churnFilterMesInicio) params.append("mesInicio", churnFilterMesInicio);
      if (churnFilterMesFim) params.append("mesFim", churnFilterMesFim);
      
      const res = await fetch(`/api/churn-por-servico?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch churn data");
      return res.json();
    },
  });

  const { data: churnRespData, isLoading: isChurnRespLoading } = useQuery<ChurnPorResponsavel[]>({
    queryKey: ["/api/churn-por-responsavel", churnRespFilterServicos, churnRespFilterSquads, churnRespFilterColaboradores, churnRespFilterMesInicio, churnRespFilterMesFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (churnRespFilterServicos.length > 0) params.append("servico", churnRespFilterServicos.join(","));
      if (churnRespFilterSquads.length > 0) params.append("squad", churnRespFilterSquads.join(","));
      if (churnRespFilterColaboradores.length > 0) params.append("colaborador", churnRespFilterColaboradores.join(","));
      if (churnRespFilterMesInicio) params.append("mesInicio", churnRespFilterMesInicio);
      if (churnRespFilterMesFim) params.append("mesFim", churnRespFilterMesFim);
      
      const res = await fetch(`/api/churn-por-responsavel?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch churn por responsavel data");
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

  // Produtos únicos para o filtro de churn (vem dos dados de churn)
  const uniqueProdutos = useMemo(() => {
    if (!churnData) return [];
    const produtos = new Set<string>();
    churnData.forEach(item => produtos.add(item.servico));
    return Array.from(produtos).sort();
  }, [churnData]);

  const uniqueSquads = useMemo(() => {
    if (!cohortData) return [];
    return cohortData.availableSquads || [];
  }, [cohortData]);

  const uniqueResponsaveis = useMemo(() => {
    if (!churnRespData) return [];
    const responsaveisSet = new Set(churnRespData.map(item => item.responsavel));
    return Array.from(responsaveisSet).filter(Boolean).sort();
  }, [churnRespData]);

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

  const churnAnomalies = useMemo(() => {
    if (!churnData || churnData.length === 0) {
      return { avgQuantidade: 0, avgValor: 0, avgPercentual: 0, anomalyMap: new Map<string, boolean>() };
    }

    const valores = churnData.map(item => item.valorTotal);
    const quantidades = churnData.map(item => item.quantidade);
    const percentuais = churnData.map(item => item.percentualChurn);

    const avgQuantidade = quantidades.reduce((a, b) => a + b, 0) / quantidades.length;
    const avgValor = valores.reduce((a, b) => a + b, 0) / valores.length;
    const avgPercentual = percentuais.reduce((a, b) => a + b, 0) / percentuais.length;

    const anomalyMap = new Map<string, boolean>();
    churnData.forEach(item => {
      const key = `${item.servico}-${item.mes}`;
      const isAnomalyValue = isAnomaly(item.valorTotal, avgValor, 0.2);
      const isAnomalyQty = isAnomaly(item.quantidade, avgQuantidade, 0.2);
      anomalyMap.set(key, isAnomalyValue || isAnomalyQty);
    });

    return { avgQuantidade, avgValor, avgPercentual, anomalyMap };
  }, [churnData]);

  const churnRespAnomalies = useMemo(() => {
    if (!churnRespData || churnRespData.length === 0) {
      return { avgQuantidade: 0, avgValor: 0, anomalyMap: new Map<string, { isAnomaly: boolean; direction: "up" | "down" }>() };
    }

    const valores = churnRespData.map(item => item.valorTotal);
    const quantidades = churnRespData.map(item => item.quantidade);

    const avgQuantidade = quantidades.reduce((a, b) => a + b, 0) / quantidades.length;
    const avgValor = valores.reduce((a, b) => a + b, 0) / valores.length;

    const anomalyMap = new Map<string, { isAnomaly: boolean; direction: "up" | "down" }>();
    churnRespData.forEach(item => {
      const key = item.responsavel;
      const isAnomalyValue = isAnomaly(item.valorTotal, avgValor, 0.2);
      if (isAnomalyValue) {
        anomalyMap.set(key, { 
          isAnomaly: true, 
          direction: getAnomalyDirection(item.valorTotal, avgValor) 
        });
      }
    });

    return { avgQuantidade, avgValor, anomalyMap };
  }, [churnRespData]);

  const handleBarClick = (data: ChurnPorResponsavel) => {
    setDrillDownData({
      isOpen: true,
      title: `Detalhes de Churn - ${data.responsavel}`,
      type: "churn_responsavel",
      data,
    });
  };

  const closeDrillDown = () => {
    setDrillDownData({
      isOpen: false,
      title: "",
      type: null,
      data: null,
    });
  };

  return (
    <div className="flex flex-col h-full">
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
                  {formatPercent(kpis.avgRetentionMonth3)}
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
                  {formatPercent(kpis.avgRetentionMonth6)}
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
                  {formatPercent(kpis.avgChurnRate)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Perda média (Mês 3)
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Tabela de Coorte
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Acompanhe a retenção de clientes mês a mês desde o início do contrato
                  </CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setIsCohortMinimized(!isCohortMinimized)}
                  data-testid="button-toggle-cohort"
                >
                  {isCohortMinimized ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </Button>
              </div>
              {!isCohortMinimized && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
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
              )}
            </CardHeader>
            {!isCohortMinimized && (
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
                            className="border-b hover-elevate no-default-hover-elevate"
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
                                    <h4 className="font-semibold text-sm mb-2 text-left">
                                      Detalhes da Coorte {cohort.cohortLabel}
                                    </h4>
                                    <div className="space-y-0.5">
                                      {!cohort.clientesContratos || cohort.clientesContratos.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-left">Nenhum contrato encontrado</p>
                                      ) : (
                                        cohort.clientesContratos.map((contrato, idx) => (
                                          <div 
                                            key={`${contrato.clienteId}-${idx}`}
                                            className="text-xs py-0.5 border-b last:border-0 text-left"
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
                                      {formatPercent(rate, 0)}
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
            )}
          </Card>

          {/* Seção de Análise de Churn por Serviço */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Análise de Churn por Serviço</CardTitle>
                  <CardDescription>Contratos encerrados por serviço ao longo dos meses</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setIsChurnMinimized(!isChurnMinimized)}
                  data-testid="button-toggle-churn"
                >
                  {isChurnMinimized ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </Button>
              </div>
            </CardHeader>
            {!isChurnMinimized && (
              <CardContent>
              {/* Filtros */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[250px]">
                  <label className="text-sm font-medium mb-2 block">Produtos</label>
                  <MultiSelect
                    options={uniqueProdutos}
                    selected={churnFilterServicos}
                    onChange={handleChurnServicosChange}
                    placeholder="Todos os produtos"
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
                        <th className="p-3 text-left font-semibold sticky left-0 bg-muted/50 z-10">Produto</th>
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
                            const isAnomalyCell = data && churnAnomalies.anomalyMap.get(`${servico}-${mes}`);
                            const anomalyDir = data && isAnomalyCell 
                              ? getAnomalyDirection(data.valorTotal, churnAnomalies.avgValor) 
                              : null;

                            return (
                              <td key={mes} className="p-3 text-center" data-testid={`cell-churn-${servico}-${mes}`}>
                                {data ? (
                                  <HoverCard>
                                    <HoverCardTrigger asChild>
                                      <span className={`cursor-help font-semibold hover-elevate px-2 py-1 rounded inline-flex items-center gap-1 ${
                                        isAnomalyCell && anomalyDir === "up" 
                                          ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300" 
                                          : isAnomalyCell && anomalyDir === "down"
                                          ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                                          : ""
                                      }`}>
                                        {isAnomalyCell && anomalyDir === "up" && (
                                          <AlertTriangle className="h-3 w-3 text-red-500" />
                                        )}
                                        {churnViewMode === "quantidade" 
                                          ? valor
                                          : churnViewMode === "valorTotal"
                                          ? formatCurrency(valor)
                                          : formatPercent(valor)
                                        }
                                      </span>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-80" data-testid={`hover-churn-${servico}-${mes}`}>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-semibold text-sm">
                                            {servico} - {mes}
                                          </h4>
                                          {isAnomalyCell && (
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                              anomalyDir === "up" 
                                                ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                                                : "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                                            }`}>
                                              {anomalyDir === "up" ? "Acima do normal" : "Abaixo do normal"}
                                            </span>
                                          )}
                                        </div>
                                        <div className="space-y-1 text-sm">
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">Contratos:</span>
                                            <span className="font-medium">{data.quantidade}</span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">Valor:</span>
                                            <span className="font-medium">{formatCurrency(data.valorTotal)}</span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">% Churn:</span>
                                            <span className="font-medium">{formatPercent(data.percentualChurn)}</span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">Valor ativo mês:</span>
                                            <span className="font-medium">{formatCurrency(data.valorAtivoMes)}</span>
                                          </p>
                                          <p className="flex justify-between">
                                            <span className="text-muted-foreground">Média de valor:</span>
                                            <span className="font-medium">{formatCurrency(churnAnomalies.avgValor)}</span>
                                          </p>
                                        </div>
                                        {isAnomalyCell && (
                                          <div className="mt-2 pt-2 border-t border-border">
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                              <Info className="h-3 w-3" />
                                              Valor desvia mais de 20% da média
                                            </p>
                                          </div>
                                        )}
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
                          let totalQuantidade = 0;
                          let totalValor = 0;
                          let totalPercentual = 0;
                          let totalValorAtivoMes = 0;
                          let count = 0;

                          churnTableData.servicos.forEach(servico => {
                            const data = churnTableData.dataMap.get(servico)?.get(mes);
                            if (data) {
                              totalQuantidade += data.quantidade;
                              totalValor += data.valorTotal;
                              totalPercentual += data.percentualChurn;
                              totalValorAtivoMes += data.valorAtivoMes;
                              count++;
                            }
                          });

                          // Para percentual, calcular média
                          const avgPercentual = count > 0 ? totalPercentual / count : 0;

                          const displayValue = churnViewMode === "quantidade" 
                            ? totalQuantidade
                            : churnViewMode === "valorTotal"
                            ? formatCurrency(totalValor)
                            : formatPercent(avgPercentual);

                          return (
                            <td key={mes} className="p-3 text-center" data-testid={`cell-churn-total-${mes}`}>
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <span className="hover:text-primary transition-colors cursor-help underline decoration-dotted inline-block">
                                    {displayValue}
                                  </span>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-64" data-testid={`hover-total-${mes}`}>
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm mb-3">
                                      Total {mes}
                                    </h4>
                                    <div className="space-y-1 text-sm">
                                      <p className="flex justify-between">
                                        <span className="text-muted-foreground">Contratos:</span>
                                        <span className="font-medium">{totalQuantidade}</span>
                                      </p>
                                      <p className="flex justify-between">
                                        <span className="text-muted-foreground">Valor:</span>
                                        <span className="font-medium">{formatCurrency(totalValor)}</span>
                                      </p>
                                      <p className="flex justify-between">
                                        <span className="text-muted-foreground">% Churn:</span>
                                        <span className="font-medium">{formatPercent(avgPercentual)}</span>
                                      </p>
                                      <p className="flex justify-between">
                                        <span className="text-muted-foreground">Valor ativo mês:</span>
                                        <span className="font-medium">{formatCurrency(totalValorAtivoMes)}</span>
                                      </p>
                                    </div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              </CardContent>
            )}
          </Card>

          {/* Seção de Churn por Responsável */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Churn por Responsável</CardTitle>
                  <CardDescription>Contratos encerrados agrupados por responsável do cliente</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setIsChurnRespMinimized(!isChurnRespMinimized)}
                  data-testid="button-toggle-churn-resp"
                >
                  {isChurnRespMinimized ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </Button>
              </div>
            </CardHeader>
            {!isChurnRespMinimized && (
              <CardContent>
                {/* Filtros */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-2 block">Serviços</label>
                    <MultiSelect
                      options={uniqueServicos}
                      selected={churnRespFilterServicos}
                      onChange={setChurnRespFilterServicos}
                      placeholder="Todos os serviços"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-2 block">Squads</label>
                    <MultiSelect
                      options={uniqueSquads}
                      selected={churnRespFilterSquads}
                      onChange={setChurnRespFilterSquads}
                      placeholder="Todos os squads"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-2 block">Responsável</label>
                    <MultiSelect
                      options={uniqueResponsaveis}
                      selected={churnRespFilterColaboradores}
                      onChange={setChurnRespFilterColaboradores}
                      placeholder="Todos os responsáveis"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-sm font-medium mb-2 block">Mês Início</label>
                    <input
                      type="month"
                      value={churnRespFilterMesInicio}
                      onChange={(e) => setChurnRespFilterMesInicio(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                      data-testid="input-churn-resp-mes-inicio"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-sm font-medium mb-2 block">Mês Fim</label>
                    <input
                      type="month"
                      value={churnRespFilterMesFim}
                      onChange={(e) => setChurnRespFilterMesFim(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                      data-testid="input-churn-resp-mes-fim"
                    />
                  </div>
                </div>

                {/* Gráfico */}
                {isChurnRespLoading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !churnRespData || churnRespData.length === 0 ? (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    <div className="text-center">
                      <TrendingDown className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum dado de churn encontrado para os filtros selecionados</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={churnRespData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="responsavel" 
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          className="text-xs"
                        />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          content={(props: TooltipProps<number, string>) => {
                            if (!props.active || !props.payload || props.payload.length === 0) {
                              return null;
                            }
                            
                            const data = props.payload[0].payload as ChurnPorResponsavel;
                            const anomaly = churnRespAnomalies.anomalyMap.get(data.responsavel);
                            
                            return (
                              <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[220px]">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-sm">{data.responsavel}</h4>
                                  {anomaly?.isAnomaly && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      anomaly.direction === "up" 
                                        ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                                        : "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                                    }`}>
                                      {anomaly.direction === "up" ? "Alto churn" : "Baixo churn"}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1 text-sm">
                                  <p className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Contratos:</span>
                                    <span className="font-medium">{data.quantidadeContratos}</span>
                                  </p>
                                  <p className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Valor Total:</span>
                                    <span className={`font-medium ${anomaly?.isAnomaly && anomaly.direction === "up" ? "text-red-600 dark:text-red-400" : ""}`}>
                                      {formatCurrency(data.valorTotal)}
                                    </span>
                                  </p>
                                  <p className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">% Churn:</span>
                                    <span className="font-medium">{formatPercent(data.percentualChurn)}</span>
                                  </p>
                                  <p className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Valor Ativo:</span>
                                    <span className="font-medium">
                                      {formatCurrency(data.valorAtivoTotal)}
                                    </span>
                                  </p>
                                  <p className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Média geral:</span>
                                    <span className="font-medium">
                                      {formatCurrency(churnRespAnomalies.avgValor)}
                                    </span>
                                  </p>
                                </div>
                                <div className="mt-2 pt-2 border-t border-border">
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Info className="h-3 w-3" />
                                    Clique para ver detalhes
                                  </p>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar 
                          dataKey="valorTotal" 
                          radius={[4, 4, 0, 0]}
                          cursor="pointer"
                          onClick={(data) => handleBarClick(data as ChurnPorResponsavel)}
                        >
                          {churnRespData?.map((entry, index) => {
                            const anomaly = churnRespAnomalies.anomalyMap.get(entry.responsavel);
                            let fillColor = "hsl(var(--primary))";
                            if (anomaly?.isAnomaly) {
                              fillColor = anomaly.direction === "up" 
                                ? "hsl(0, 84%, 60%)" 
                                : "hsl(142, 71%, 45%)";
                            }
                            return <Cell key={`cell-${index}`} fill={fillColor} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            )}
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

      <Dialog open={drillDownData.isOpen} onOpenChange={(open) => !open && closeDrillDown()}>
        <DialogContent className="max-w-lg" data-testid="dialog-drill-down">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {drillDownData.type === "churn_responsavel" && <TrendingDown className="h-5 w-5 text-red-500" />}
              {drillDownData.title}
            </DialogTitle>
            <DialogDescription>
              Detalhamento completo do churn para análise
            </DialogDescription>
          </DialogHeader>
          
          {drillDownData.type === "churn_responsavel" && drillDownData.data && (
            <div className="space-y-4">
              {(() => {
                const data = drillDownData.data as ChurnPorResponsavel;
                const anomaly = churnRespAnomalies.anomalyMap.get(data.responsavel);
                
                return (
                  <>
                    {anomaly?.isAnomaly && (
                      <div className={`p-3 rounded-lg flex items-center gap-2 ${
                        anomaly.direction === "up" 
                          ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                          : "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                      }`}>
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {anomaly.direction === "up" 
                            ? "Este responsável apresenta churn acima do normal (+20%)" 
                            : "Este responsável apresenta churn abaixo do normal (-20%)"}
                        </span>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Contratos Encerrados</p>
                        <p className="text-2xl font-bold">{data.quantidadeContratos}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Valor Total Perdido</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(data.valorTotal)}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Taxa de Churn</p>
                        <p className="text-2xl font-bold">{formatPercent(data.percentualChurn)}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Valor Ativo Total</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(data.valorAtivoTotal)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-border">
                      <h4 className="font-semibold text-sm mb-2">Comparação com Média</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Média de churn (valor):</span>
                          <span className="font-medium">{formatCurrency(churnRespAnomalies.avgValor)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Média de contratos:</span>
                          <span className="font-medium">{churnRespAnomalies.avgQuantidade.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Desvio do valor:</span>
                          <span className={`font-medium ${
                            data.valorTotal > churnRespAnomalies.avgValor
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                          }`}>
                            {data.valorTotal > churnRespAnomalies.avgValor ? "+" : ""}
                            {(((data.valorTotal - churnRespAnomalies.avgValor) / churnRespAnomalies.avgValor) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
