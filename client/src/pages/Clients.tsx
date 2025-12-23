import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ClientsTable from "@/components/ClientsTable";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Filter, Users, UserCheck, TrendingUp, Clock, DollarSign, X, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import StatsCard from "@/components/StatsCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, formatCurrencyNoDecimals, formatDecimal, formatPercent } from "@/lib/utils";
import type { ClienteCompleto } from "../../../server/storage";

type SortField = "name" | "cnpj" | "ltv" | "lt" | "status" | "startDate";
type SortDirection = "asc" | "desc";

const mapClusterToName = (cluster: string | null): string => {
  if (!cluster) return "Não definido";
  switch (cluster) {
    case "0": return "NFNC";
    case "1": return "Regulares";
    case "2": return "Chaves";
    case "3": return "Imperdíveis";
    default: return cluster;
  }
};

export default function Clients() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [servicoFilter, setServicoFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tipoContratoFilter, setTipoContratoFilter] = useState<string>("ambos");
  const [responsavelFilter, setResponsavelFilter] = useState<string[]>([]);
  const [clusterFilter, setClusterFilter] = useState<string>("all");
  const [ltOperator, setLtOperator] = useState<string>("all");
  const [ltValue, setLtValue] = useState<string>("");
  const [aovOperator, setAovOperator] = useState<string>("all");
  const [aovValue, setAovValue] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { data: clientes, isLoading, error } = useQuery<ClienteCompleto[]>({
    queryKey: ["/api/clientes"],
  });

  const { data: ltvMap } = useQuery<Record<string, number>>({
    queryKey: ["/api/clientes-ltv"],
  });

  const servicosUnicos = useMemo(() => {
    if (!clientes) return [];
    const servicosSet = new Set<string>();
    clientes.forEach(client => {
      if (client.servicos) {
        client.servicos.split(',').forEach(servico => {
          const trimmed = servico.trim();
          if (trimmed) servicosSet.add(trimmed);
        });
      }
    });
    return Array.from(servicosSet).sort();
  }, [clientes]);

  const statusUnicos = useMemo(() => {
    if (!clientes) return [];
    const statusSet = new Set<string>();
    clientes.forEach(client => {
      if (client.statusClickup) statusSet.add(client.statusClickup);
    });
    return Array.from(statusSet).sort();
  }, [clientes]);

  const responsaveisUnicos = useMemo(() => {
    if (!clientes) return [];
    const responsavelSet = new Set<string>();
    clientes.forEach(client => {
      if (client.responsavel) responsavelSet.add(client.responsavel);
    });
    return Array.from(responsavelSet).sort();
  }, [clientes]);

  const clustersUnicos = useMemo(() => {
    if (!clientes) return [];
    const clusterSet = new Set<string>();
    clientes.forEach(client => {
      if (client.cluster) clusterSet.add(client.cluster);
    });
    return Array.from(clusterSet).sort();
  }, [clientes]);

  const filteredClients = useMemo(() => {
    if (!clientes) return [];
    
    return clientes.filter(client => {
      const nome = (client.nomeClickup || client.nome || "").toLowerCase();
      const cnpj = (client.cnpjCliente || client.cnpj || "").toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || nome.includes(query) || cnpj.includes(query);

      const matchesServico = servicoFilter.length === 0 || 
        (client.servicos && servicoFilter.some(s => client.servicos!.toLowerCase().includes(s.toLowerCase())));
      
      const matchesStatus = statusFilter.length === 0 || 
        statusFilter.includes(client.statusClickup || "");

      const matchesTipoContrato = 
        tipoContratoFilter === "ambos" ||
        (tipoContratoFilter === "recorrente" && (client.totalRecorrente || 0) > 0) ||
        (tipoContratoFilter === "pontual" && (client.totalPontual || 0) > 0);

      const matchesResponsavel = responsavelFilter.length === 0 || 
        responsavelFilter.includes(client.responsavel || "");

      const matchesCluster = clusterFilter === "all" || 
        client.cluster === clusterFilter;

      const clientLt = client.ltMeses || 0;
      const ltVal = parseFloat(ltValue);
      const matchesLt = ltOperator === "all" || !ltValue || isNaN(ltVal) ||
        (ltOperator === "maior" && clientLt > ltVal) ||
        (ltOperator === "menor" && clientLt < ltVal) ||
        (ltOperator === "igual" && clientLt === ltVal);

      const clientLtv = ltvMap?.[client.ids || String(client.id)] || 0;
      const clientAov = clientLt > 0 ? clientLtv / clientLt : 0;
      const aovVal = parseFloat(aovValue);
      const matchesAov = aovOperator === "all" || !aovValue || isNaN(aovVal) ||
        (aovOperator === "maior" && clientAov > aovVal) ||
        (aovOperator === "menor" && clientAov < aovVal) ||
        (aovOperator === "igual" && clientAov === aovVal);

      return matchesSearch && matchesServico && matchesStatus && matchesTipoContrato && matchesResponsavel && matchesCluster && matchesLt && matchesAov;
    });
  }, [clientes, searchQuery, servicoFilter, statusFilter, tipoContratoFilter, responsavelFilter, clusterFilter, ltOperator, ltValue, aovOperator, aovValue, ltvMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      let comparison = 0;
      
      if (sortField === "name") {
        const nameA = a.nomeClickup || a.nome || "";
        const nameB = b.nomeClickup || b.nome || "";
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === "cnpj") {
        const cnpjA = a.cnpjCliente || a.cnpj || "";
        const cnpjB = b.cnpjCliente || b.cnpj || "";
        comparison = cnpjA.localeCompare(cnpjB);
      } else if (sortField === "ltv") {
        const ltvA = ltvMap?.[a.ids || String(a.id)] || 0;
        const ltvB = ltvMap?.[b.ids || String(b.id)] || 0;
        comparison = ltvA - ltvB;
      } else if (sortField === "lt") {
        const ltA = a.ltMeses || 0;
        const ltB = b.ltMeses || 0;
        comparison = ltA - ltB;
      } else if (sortField === "status") {
        const statusA = a.statusClickup || "";
        const statusB = b.statusClickup || "";
        comparison = statusA.localeCompare(statusB);
      } else if (sortField === "startDate") {
        const dateA = a.dataInicio ? new Date(a.dataInicio).getTime() : 0;
        const dateB = b.dataInicio ? new Date(b.dataInicio).getTime() : 0;
        comparison = dateA - dateB;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredClients, sortField, sortDirection, ltvMap]);

  const kpis = useMemo(() => {
    if (!filteredClients || filteredClients.length === 0) {
      return { totalClientes: 0, clientesAtivos: 0, ltvMedio: 0, ltMedio: 0, aov: 0 };
    }
    
    const totalClientes = filteredClients.length;
    const clientesAtivos = filteredClients.filter(c => {
      const status = (c.statusClickup || "").toLowerCase();
      return status === "ativo" || status === "onboarding" || status === "triagem";
    }).length;
    
    let somaLtv = 0;
    let countLtv = 0;
    if (ltvMap) {
      filteredClients.forEach(c => {
        const ltv = ltvMap[c.ids || String(c.id)] || 0;
        if (ltv > 0) {
          somaLtv += ltv;
          countLtv++;
        }
      });
    }
    const ltvMedio = countLtv > 0 ? somaLtv / countLtv : 0;
    
    let somaLt = 0;
    let countLt = 0;
    filteredClients.forEach(c => {
      const lt = c.ltMeses || 0;
      if (lt > 0) {
        somaLt += lt;
        countLt++;
      }
    });
    const ltMedio = countLt > 0 ? somaLt / countLt : 0;
    
    const aov = ltMedio > 0 ? ltvMedio / ltMedio : 0;
    
    return { totalClientes, clientesAtivos, ltvMedio, ltMedio, aov };
  }, [filteredClients, ltvMap]);

  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClients = sortedClients.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, servicoFilter, statusFilter, tipoContratoFilter, responsavelFilter, clusterFilter, ltOperator, ltValue, aovOperator, aovValue, itemsPerPage, sortField, sortDirection]);

  const hasActiveFilters = tipoContratoFilter !== "ambos" || servicoFilter.length > 0 || statusFilter.length > 0 || responsavelFilter.length > 0 || clusterFilter !== "all" || ltOperator !== "all" || aovOperator !== "all";

  const activeFilterCount = [
    tipoContratoFilter !== "ambos",
    servicoFilter.length > 0,
    statusFilter.length > 0,
    responsavelFilter.length > 0,
    clusterFilter !== "all",
    ltOperator !== "all",
    aovOperator !== "all"
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setTipoContratoFilter("ambos");
    setServicoFilter([]);
    setStatusFilter([]);
    setResponsavelFilter([]);
    setClusterFilter("all");
    setLtOperator("all");
    setLtValue("");
    setAovOperator("all");
    setAovValue("");
  };

  const toggleServicoFilter = (servico: string) => {
    setServicoFilter(prev => 
      prev.includes(servico) 
        ? prev.filter(s => s !== servico)
        : [...prev, servico]
    );
  };

  const toggleResponsavelFilter = (responsavel: string) => {
    setResponsavelFilter(prev => 
      prev.includes(responsavel) 
        ? prev.filter(r => r !== responsavel)
        : [...prev, responsavel]
    );
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  if (error) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="p-8">
            <div className="text-center">
              <p className="text-destructive font-semibold mb-2">Erro ao carregar clientes</p>
              <p className="text-muted-foreground text-sm">
                {error instanceof Error ? error.message : "Erro desconhecido"}
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center py-12" data-testid="loading-clients">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background h-full">
      <div className="container mx-auto px-4 py-4 max-w-7xl h-full flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <StatsCard
            title="Total de Clientes"
            value={String(kpis.totalClientes)}
            icon={Users}
            subtitle="Quantidade de clientes cadastrados no ClickUp (ativos + inativos)"
            tooltipType="help"
          />
          <StatsCard
            title="Clientes Ativos"
            value={String(kpis.clientesAtivos)}
            icon={UserCheck}
            variant="success"
            subtitle={`${kpis.totalClientes > 0 ? formatPercent((kpis.clientesAtivos / kpis.totalClientes) * 100) : '0%'} dos clientes estão com status Ativo, Onboarding ou Triagem`}
            tooltipType="help"
          />
          <StatsCard
            title="LTV Médio"
            value={formatCurrencyNoDecimals(kpis.ltvMedio)}
            icon={TrendingUp}
            variant="info"
            subtitle="Soma de toda a receita paga dividida pelo número de clientes. Quanto maior, mais valor cada cliente gerou."
            tooltipType="help"
          />
          <StatsCard
            title="LT Médio"
            value={formatDecimal(kpis.ltMedio)}
            icon={Clock}
            subtitle="Média de meses que os clientes permanecem pagando. Quanto maior, mais tempo de relacionamento."
            tooltipType="help"
          />
          <StatsCard
            title="AOV"
            value={formatCurrencyNoDecimals(kpis.aov)}
            icon={DollarSign}
            variant="success"
            subtitle="Ticket médio mensal por cliente. É o LTV dividido pelo LT (tempo de vida)."
            tooltipType="help"
          />
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nome ou CNPJ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-clients"
            />
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="default" className="gap-2" data-testid="button-filter-clients">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filtros</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0 overflow-hidden" align="end">
              <div className="flex items-center justify-between p-4 pb-2 border-b">
                <h4 className="font-medium text-sm">Filtros</h4>
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs"
                    onClick={clearAllFilters}
                    data-testid="button-clear-filters"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Tipo de Contrato</Label>
                    <Select
                      value={tipoContratoFilter}
                      onValueChange={setTipoContratoFilter}
                    >
                      <SelectTrigger className="w-full" data-testid="select-filter-tipo-contrato">
                        <SelectValue placeholder="Tipo de contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ambos">Ambos</SelectItem>
                        <SelectItem value="recorrente">Recorrente</SelectItem>
                        <SelectItem value="pontual">Pontual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Status (múltipla seleção)</Label>
                      {statusFilter.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{statusFilter.length}</Badge>
                      )}
                    </div>
                    <div className="border rounded-md max-h-32 overflow-y-auto overflow-x-hidden">
                      {statusUnicos.map(status => (
                        <label
                          key={status}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 min-w-0"
                          data-testid={`checkbox-status-${status}`}
                        >
                          <Checkbox 
                            checked={statusFilter.includes(status)} 
                            onCheckedChange={() => toggleStatusFilter(status)}
                            className="flex-shrink-0"
                          />
                          <span className="text-sm truncate flex-1 min-w-0">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Serviço (múltipla seleção)</Label>
                      {servicoFilter.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{servicoFilter.length}</Badge>
                      )}
                    </div>
                    <div className="border rounded-md max-h-32 overflow-y-auto overflow-x-hidden">
                      {servicosUnicos.map(servico => (
                        <label
                          key={servico}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 min-w-0"
                          data-testid={`checkbox-servico-${servico}`}
                        >
                          <Checkbox 
                            checked={servicoFilter.includes(servico)} 
                            onCheckedChange={() => toggleServicoFilter(servico)}
                            className="flex-shrink-0"
                          />
                          <span className="text-sm truncate flex-1 min-w-0">{servico}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Responsável (múltipla seleção)</Label>
                      {responsavelFilter.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{responsavelFilter.length}</Badge>
                      )}
                    </div>
                    <div className="border rounded-md max-h-32 overflow-y-auto overflow-x-hidden">
                      {responsaveisUnicos.map(responsavel => (
                        <label
                          key={responsavel}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 min-w-0"
                          data-testid={`checkbox-responsavel-${responsavel}`}
                        >
                          <Checkbox 
                            checked={responsavelFilter.includes(responsavel)} 
                            onCheckedChange={() => toggleResponsavelFilter(responsavel)}
                            className="flex-shrink-0"
                          />
                          <span className="text-sm truncate flex-1 min-w-0">{responsavel}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Cluster</Label>
                    <Select
                      value={clusterFilter}
                      onValueChange={setClusterFilter}
                    >
                      <SelectTrigger className="w-full" data-testid="select-filter-cluster">
                        <SelectValue placeholder="Todos os clusters" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os clusters</SelectItem>
                        {clustersUnicos.map(cluster => (
                          <SelectItem key={cluster} value={cluster}>{mapClusterToName(cluster)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">LT (meses)</Label>
                    <div className="flex gap-2">
                      <Select
                        value={ltOperator}
                        onValueChange={setLtOperator}
                      >
                        <SelectTrigger className="w-28" data-testid="select-filter-lt-operator">
                          <SelectValue placeholder="Operador" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="maior">Maior que</SelectItem>
                          <SelectItem value="menor">Menor que</SelectItem>
                          <SelectItem value="igual">Igual a</SelectItem>
                        </SelectContent>
                      </Select>
                      {ltOperator !== "all" && (
                        <Input
                          type="number"
                          placeholder="Valor"
                          value={ltValue}
                          onChange={(e) => setLtValue(e.target.value)}
                          className="flex-1"
                          data-testid="input-filter-lt-value"
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">AOV (R$)</Label>
                    <div className="flex gap-2">
                      <Select
                        value={aovOperator}
                        onValueChange={setAovOperator}
                      >
                        <SelectTrigger className="w-28" data-testid="select-filter-aov-operator">
                          <SelectValue placeholder="Operador" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="maior">Maior que</SelectItem>
                          <SelectItem value="menor">Menor que</SelectItem>
                          <SelectItem value="igual">Igual a</SelectItem>
                        </SelectContent>
                      </Select>
                      {aovOperator !== "all" && (
                        <Input
                          type="number"
                          placeholder="Valor"
                          value={aovValue}
                          onChange={(e) => setAovValue(e.target.value)}
                          className="flex-1"
                          data-testid="input-filter-aov-value"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1 min-h-0">
          <ClientsTable
            clients={paginatedClients}
            onClientClick={(id) => setLocation(`/cliente/${id}`)}
            ltvMap={ltvMap}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </div>

        <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground border-t mt-3">
          <div className="flex items-center gap-4">
            <span>
              {startIndex + 1}-{Math.min(endIndex, filteredClients.length)} de {filteredClients.length}
            </span>
            <div className="flex items-center gap-2">
              <span>Por página:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => setItemsPerPage(Number(value))}
              >
                <SelectTrigger className="h-7 w-16 text-xs" data-testid="select-items-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="mr-2">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  data-testid="button-first-page"
                >
                  Primeira
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Próxima
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  data-testid="button-last-page"
                >
                  Última
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
