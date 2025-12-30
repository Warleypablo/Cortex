import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSelect } from "@/components/ui/multi-select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Users, 
  Search,
  AlertTriangle,
  Building2,
  User,
  FileText,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  ExternalLink
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
import { format, parseISO, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChurnContract {
  id: number;
  cliente_nome: string;
  cnpj: string;
  produto: string;
  squad: string;
  responsavel: string;
  valorr: number;
  data_inicio: string;
  data_encerramento: string;
  status: string;
  motivo_churn: string | null;
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
    motivos: string[];
  };
}

export default function ChurnDetalhamento() {
  usePageTitle("Detalhamento de Churn");
  useSetPageInfo("Detalhamento de Churn", "Análise detalhada de contratos encerrados");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSquads, setFilterSquads] = useState<string[]>([]);
  const [filterProdutos, setFilterProdutos] = useState<string[]>([]);
  const [filterResponsaveis, setFilterResponsaveis] = useState<string[]>([]);
  const [filterMotivos, setFilterMotivos] = useState<string[]>([]);
  const [filterPeriodo, setFilterPeriodo] = useState<string>("12");
  const [sortBy, setSortBy] = useState<string>("data_encerramento");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);

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
    
    if (filterMotivos.length > 0) {
      filtered = filtered.filter(c => c.motivo_churn && filterMotivos.includes(c.motivo_churn));
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
  }, [data?.contratos, searchTerm, filterSquads, filterProdutos, filterResponsaveis, filterMotivos, sortBy, sortOrder]);

  const filteredMetricas = useMemo(() => {
    if (filteredContratos.length === 0) {
      return { total_churned: 0, mrr_perdido: 0, ltv_total: 0, lt_medio: 0 };
    }
    
    const total = filteredContratos.length;
    const mrrPerdido = filteredContratos.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const ltvTotal = filteredContratos.reduce((sum, c) => sum + (c.ltv || 0), 0);
    const ltMedio = filteredContratos.reduce((sum, c) => sum + (c.lifetime_meses || 0), 0) / total;
    
    return {
      total_churned: total,
      mrr_perdido: mrrPerdido,
      ltv_total: ltvTotal,
      lt_medio: ltMedio
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Churned</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-churned">
                  {filteredMetricas.total_churned}
                </div>
                <p className="text-xs text-muted-foreground">
                  contratos encerrados
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Perdido</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-mrr-perdido">
                  {formatCurrency(filteredMetricas.mrr_perdido)}
                </div>
                <p className="text-xs text-muted-foreground">
                  receita recorrente perdida
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LTV Total</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-ltv-total">
                  {formatCurrency(filteredMetricas.ltv_total)}
                </div>
                <p className="text-xs text-muted-foreground">
                  valor total gerado
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Médio</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-lt-medio">
                  {filteredMetricas.lt_medio.toFixed(1)} meses
                </div>
                <p className="text-xs text-muted-foreground">
                  tempo médio de contrato
                </p>
              </>
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
                  <CardTitle className="text-base">Filtros</CardTitle>
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
                  <label className="text-sm font-medium">Motivo do Churn</label>
                  <MultiSelect
                    options={data?.filtros?.motivos || []}
                    selected={filterMotivos}
                    onChange={setFilterMotivos}
                    placeholder="Todos os motivos"
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
                      setFilterMotivos([]);
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contratos Encerrados
            <Badge variant="secondary">{filteredContratos.length}</Badge>
          </CardTitle>
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
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
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
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort("valorr")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        MRR
                        <SortIcon column="valorr" />
                      </div>
                    </TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("data_encerramento")}
                    >
                      <div className="flex items-center gap-1">
                        Encerramento
                        <SortIcon column="data_encerramento" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort("lifetime_meses")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Lifetime
                        <SortIcon column="lifetime_meses" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort("ltv")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        LTV
                        <SortIcon column="ltv" />
                      </div>
                    </TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContratos.map((contrato) => (
                    <TableRow key={contrato.id} data-testid={`row-churn-${contrato.id}`}>
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
                      <TableCell>{contrato.responsavel || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(contrato.valorr || 0)}
                      </TableCell>
                      <TableCell>{formatDate(contrato.data_inicio)}</TableCell>
                      <TableCell>{formatDate(contrato.data_encerramento)}</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={contrato.lifetime_meses < 6 ? "destructive" : contrato.lifetime_meses < 12 ? "secondary" : "default"}
                        >
                          {contrato.lifetime_meses} meses
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(contrato.ltv || 0)}
                      </TableCell>
                      <TableCell>
                        {contrato.motivo_churn ? (
                          <Badge variant="outline" className="text-xs">
                            {contrato.motivo_churn}
                          </Badge>
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
