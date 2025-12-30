import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSelect } from "@/components/ui/multi-select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency } from "@/lib/utils";
import { 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Search,
  AlertTriangle,
  FileText,
  Filter,
  ChevronDown,
  ChevronUp,
  Percent,
  Clock,
  BarChart3,
  PieChart,
  Target
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChurnContract {
  id: string;
  cliente_nome: string;
  cnpj: string;
  produto: string;
  squad: string;
  responsavel: string;
  valorr: number;
  data_inicio: string;
  data_encerramento: string;
  status: string;
  servico: string;
  lifetime_meses: number;
  ltv: number;
}

interface ChurnDetalhamentoData {
  contratos: ChurnContract[];
  metricas: {
    total_churned: number;
    mrr_perdido: number;
    ltv_total: number;
    lt_medio: number;
  };
  filtros: {
    squads: string[];
    produtos: string[];
    responsaveis: string[];
    servicos: string[];
  };
}

export default function ChurnDetalhamento() {
  usePageTitle("Detalhamento de Churn");
  useSetPageInfo("Detalhamento de Churn", "Análise detalhada de contratos encerrados");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSquads, setFilterSquads] = useState<string[]>([]);
  const [filterProdutos, setFilterProdutos] = useState<string[]>([]);
  const [filterResponsaveis, setFilterResponsaveis] = useState<string[]>([]);
  const [filterServicos, setFilterServicos] = useState<string[]>([]);
  const [filterPeriodo, setFilterPeriodo] = useState<string>("12");
  const [sortBy, setSortBy] = useState<string>("data_encerramento");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const { data, isLoading, error } = useQuery<ChurnDetalhamentoData>({
    queryKey: ["/api/analytics/churn-detalhamento", filterPeriodo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("meses", filterPeriodo);
      const res = await fetch(`/api/analytics/churn-detalhamento?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch churn data");
      return res.json();
    },
  });

  const filteredContratos = useMemo(() => {
    if (!data?.contratos) return [];
    
    let filtered = [...data.contratos];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.cliente_nome?.toLowerCase().includes(term) ||
        c.cnpj?.includes(term) ||
        c.produto?.toLowerCase().includes(term) ||
        c.responsavel?.toLowerCase().includes(term)
      );
    }
    
    if (filterSquads.length > 0) {
      filtered = filtered.filter(c => filterSquads.includes(c.squad));
    }
    
    if (filterProdutos.length > 0) {
      filtered = filtered.filter(c => filterProdutos.includes(c.produto));
    }
    
    if (filterResponsaveis.length > 0) {
      filtered = filtered.filter(c => filterResponsaveis.includes(c.responsavel));
    }
    
    if (filterServicos.length > 0) {
      filtered = filtered.filter(c => c.servico && filterServicos.includes(c.servico));
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "data_encerramento":
          comparison = new Date(a.data_encerramento).getTime() - new Date(b.data_encerramento).getTime();
          break;
        case "valorr":
          comparison = a.valorr - b.valorr;
          break;
        case "lifetime_meses":
          comparison = a.lifetime_meses - b.lifetime_meses;
          break;
        case "ltv":
          comparison = a.ltv - b.ltv;
          break;
        case "cliente_nome":
          comparison = (a.cliente_nome || "").localeCompare(b.cliente_nome || "");
          break;
        default:
          comparison = 0;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });
    
    return filtered;
  }, [data?.contratos, searchTerm, filterSquads, filterProdutos, filterResponsaveis, filterServicos, sortBy, sortOrder]);

  const filteredMetricas = useMemo(() => {
    if (filteredContratos.length === 0) {
      return { total_churned: 0, mrr_perdido: 0, ltv_total: 0, lt_medio: 0, ticket_medio: 0 };
    }
    
    const total = filteredContratos.length;
    const mrrPerdido = filteredContratos.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const ltvTotal = filteredContratos.reduce((sum, c) => sum + (c.ltv || 0), 0);
    const ltMedio = filteredContratos.reduce((sum, c) => sum + (c.lifetime_meses || 0), 0) / total;
    const ticketMedio = mrrPerdido / total;
    
    return {
      total_churned: total,
      mrr_perdido: mrrPerdido,
      ltv_total: ltvTotal,
      lt_medio: ltMedio,
      ticket_medio: ticketMedio
    };
  }, [filteredContratos]);

  const distribuicaoPorSquad = useMemo(() => {
    if (filteredContratos.length === 0) return [];
    
    const squadCounts: Record<string, { count: number; mrr: number }> = {};
    filteredContratos.forEach(c => {
      const squad = c.squad || "Não especificado";
      if (!squadCounts[squad]) squadCounts[squad] = { count: 0, mrr: 0 };
      squadCounts[squad].count++;
      squadCounts[squad].mrr += c.valorr || 0;
    });
    
    const total = filteredContratos.length;
    return Object.entries(squadCounts)
      .map(([squad, data]) => ({
        squad,
        count: data.count,
        mrr: data.mrr,
        percentual: (data.count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredContratos]);

  const distribuicaoPorProduto = useMemo(() => {
    if (filteredContratos.length === 0) return [];
    
    const prodCounts: Record<string, { count: number; mrr: number }> = {};
    filteredContratos.forEach(c => {
      const produto = c.produto || "Não especificado";
      if (!prodCounts[produto]) prodCounts[produto] = { count: 0, mrr: 0 };
      prodCounts[produto].count++;
      prodCounts[produto].mrr += c.valorr || 0;
    });
    
    const total = filteredContratos.length;
    return Object.entries(prodCounts)
      .map(([produto, data]) => ({
        produto,
        count: data.count,
        mrr: data.mrr,
        percentual: (data.count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredContratos]);

  const distribuicaoPorLifetime = useMemo(() => {
    if (filteredContratos.length === 0) return { curto: 0, medio: 0, longo: 0 };
    
    let curto = 0, medio = 0, longo = 0;
    filteredContratos.forEach(c => {
      if (c.lifetime_meses < 6) curto++;
      else if (c.lifetime_meses < 12) medio++;
      else longo++;
    });
    
    const total = filteredContratos.length;
    return {
      curto: (curto / total) * 100,
      medio: (medio / total) * 100,
      longo: (longo / total) * 100
    };
  }, [filteredContratos]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const colors = {
    danger: "text-red-500",
    warning: "text-amber-500",
    success: "text-emerald-500",
    info: "text-blue-500",
  };

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">Erro ao carregar dados de churn</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Churned</CardTitle>
            <TrendingDown className={`h-4 w-4 ${colors.danger}`} />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-3xl font-bold" data-testid="text-total-churned">
                  {filteredMetricas.total_churned}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  contratos encerrados
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR Perdido</CardTitle>
            <DollarSign className={`h-4 w-4 ${colors.danger}`} />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold" data-testid="text-mrr-perdido">
                  {formatCurrency(filteredMetricas.mrr_perdido)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  receita mensal perdida
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">LTV Total</CardTitle>
            <Target className={`h-4 w-4 ${colors.warning}`} />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold" data-testid="text-ltv-total">
                  {formatCurrency(filteredMetricas.ltv_total)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  valor gerado antes do churn
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lifetime Médio</CardTitle>
            <Clock className={`h-4 w-4 ${colors.info}`} />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-3xl font-bold" data-testid="text-lt-medio">
                  {filteredMetricas.lt_medio.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  meses em média
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-3xl font-bold" data-testid="text-ticket-medio">
                  {formatCurrency(filteredMetricas.ticket_medio)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  MRR médio por contrato
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">LTV/CAC Médio</CardTitle>
            <Percent className={`h-4 w-4 ${colors.success}`} />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-3xl font-bold" data-testid="text-ltv-cac">
                  {filteredMetricas.total_churned > 0 
                    ? (filteredMetricas.ltv_total / filteredMetricas.total_churned / 1000).toFixed(1) + "x"
                    : "0x"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  LTV médio / R$1k
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Distribuição por Lifetime</CardTitle>
            </div>
            <CardDescription>Tempo de permanência dos contratos churned</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      Curto (&lt;6 meses)
                    </span>
                    <span className="font-medium">{distribuicaoPorLifetime.curto.toFixed(1)}%</span>
                  </div>
                  <Progress value={distribuicaoPorLifetime.curto} className="h-2 bg-red-100 dark:bg-red-900/30" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      Médio (6-12 meses)
                    </span>
                    <span className="font-medium">{distribuicaoPorLifetime.medio.toFixed(1)}%</span>
                  </div>
                  <Progress value={distribuicaoPorLifetime.medio} className="h-2 bg-amber-100 dark:bg-amber-900/30" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      Longo (&gt;12 meses)
                    </span>
                    <span className="font-medium">{distribuicaoPorLifetime.longo.toFixed(1)}%</span>
                  </div>
                  <Progress value={distribuicaoPorLifetime.longo} className="h-2 bg-emerald-100 dark:bg-emerald-900/30" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Top 5 Squads com Churn</CardTitle>
            </div>
            <CardDescription>Distribuição percentual por squad</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : distribuicaoPorSquad.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhum dado disponível</p>
            ) : (
              distribuicaoPorSquad.map((item, index) => (
                <div key={item.squad} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate max-w-[60%]" title={item.squad}>{item.squad}</span>
                    <span className="font-medium text-right">
                      {item.count} ({item.percentual.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress 
                    value={item.percentual} 
                    className="h-2" 
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Top 5 Produtos com Churn</CardTitle>
            </div>
            <CardDescription>Distribuição percentual por produto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : distribuicaoPorProduto.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhum dado disponível</p>
            ) : (
              distribuicaoPorProduto.map((item, index) => (
                <div key={item.produto} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate max-w-[60%]" title={item.produto}>{item.produto}</span>
                    <span className="font-medium text-right">
                      {item.count} ({item.percentual.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress 
                    value={item.percentual} 
                    className="h-2" 
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <CardTitle className="text-base">Filtros Avançados</CardTitle>
                </div>
                {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cliente, CNPJ, produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-churn"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Período</label>
                  <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
                    <SelectTrigger data-testid="select-periodo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">Últimos 3 meses</SelectItem>
                      <SelectItem value="6">Últimos 6 meses</SelectItem>
                      <SelectItem value="12">Últimos 12 meses</SelectItem>
                      <SelectItem value="24">Últimos 24 meses</SelectItem>
                      <SelectItem value="all">Todo o período</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Squads</label>
                  <MultiSelect
                    options={data?.filtros?.squads || []}
                    selected={filterSquads}
                    onChange={setFilterSquads}
                    placeholder="Todos os squads"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Produtos</label>
                  <MultiSelect
                    options={data?.filtros?.produtos || []}
                    selected={filterProdutos}
                    onChange={setFilterProdutos}
                    placeholder="Todos os produtos"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Responsáveis</label>
                  <MultiSelect
                    options={data?.filtros?.responsaveis || []}
                    selected={filterResponsaveis}
                    onChange={setFilterResponsaveis}
                    placeholder="Todos os responsáveis"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Serviço</label>
                  <MultiSelect
                    options={data?.filtros?.servicos || []}
                    selected={filterServicos}
                    onChange={setFilterServicos}
                    placeholder="Todos os serviços"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ordenar por</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="data_encerramento">Data de Encerramento</SelectItem>
                      <SelectItem value="valorr">MRR</SelectItem>
                      <SelectItem value="lifetime_meses">Lifetime</SelectItem>
                      <SelectItem value="ltv">LTV</SelectItem>
                      <SelectItem value="cliente_nome">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterSquads([]);
                      setFilterProdutos([]);
                      setFilterResponsaveis([]);
                      setFilterServicos([]);
                      setFilterPeriodo("12");
                      setSortBy("data_encerramento");
                      setSortOrder("desc");
                    }}
                    data-testid="button-clear-filters"
                  >
                    Limpar Filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contratos Encerrados
            </CardTitle>
            <CardDescription>
              Listagem detalhada de todos os contratos churned no período
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {filteredContratos.length}
          </Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredContratos.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum contrato churned encontrado</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/80"
                      onClick={() => handleSort("cliente_nome")}
                    >
                      <div className="flex items-center gap-1">
                        Cliente
                        <SortIcon column="cliente_nome" />
                      </div>
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Squad</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/80 text-right"
                      onClick={() => handleSort("valorr")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        MRR
                        <SortIcon column="valorr" />
                      </div>
                    </TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/80"
                      onClick={() => handleSort("data_encerramento")}
                    >
                      <div className="flex items-center gap-1">
                        Encerramento
                        <SortIcon column="data_encerramento" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/80 text-right"
                      onClick={() => handleSort("lifetime_meses")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Lifetime
                        <SortIcon column="lifetime_meses" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/80 text-right"
                      onClick={() => handleSort("ltv")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        LTV
                        <SortIcon column="ltv" />
                      </div>
                    </TableHead>
                    <TableHead>Serviço</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContratos.map((contrato, index) => (
                    <TableRow 
                      key={`${contrato.id}-${index}`} 
                      data-testid={`row-churn-${contrato.id}`}
                      className="hover:bg-muted/30"
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{contrato.cliente_nome || "-"}</span>
                          <span className="text-xs text-muted-foreground">{contrato.cnpj || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{contrato.produto || "-"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{contrato.squad || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{contrato.responsavel || "-"}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(contrato.valorr || 0)}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(contrato.data_inicio)}</TableCell>
                      <TableCell className="text-sm">{formatDate(contrato.data_encerramento)}</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={contrato.lifetime_meses < 6 ? "destructive" : contrato.lifetime_meses < 12 ? "secondary" : "default"}
                        >
                          {contrato.lifetime_meses.toFixed(1)}m
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(contrato.ltv || 0)}
                      </TableCell>
                      <TableCell>
                        {contrato.servico ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[120px] block" title={contrato.servico}>
                            {contrato.servico}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
