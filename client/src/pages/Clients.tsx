import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ClientsTable from "@/components/ClientsTable";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Filter, Users, UserCheck, TrendingUp, Clock, DollarSign } from "lucide-react";
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
import { formatCurrency, formatCurrencyNoDecimals, formatDecimal, formatPercent } from "@/lib/utils";
import type { ClienteCompleto } from "../../../server/storage";

type SortField = "name" | "cnpj" | "ltv" | "lt" | "status" | "startDate";
type SortDirection = "asc" | "desc";

export default function Clients() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [servicoFilter, setServicoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoContratoFilter, setTipoContratoFilter] = useState<string>("ambos");
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

  const filteredClients = useMemo(() => {
    if (!clientes) return [];
    
    return clientes.filter(client => {
      const nome = (client.nomeClickup || client.nome || "").toLowerCase();
      const cnpj = (client.cnpjCliente || client.cnpj || "").toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || nome.includes(query) || cnpj.includes(query);

      const matchesServico = servicoFilter === "all" || 
        (client.servicos && client.servicos.toLowerCase().includes(servicoFilter.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || 
        client.statusClickup === statusFilter;

      const matchesTipoContrato = 
        tipoContratoFilter === "ambos" ||
        (tipoContratoFilter === "recorrente" && (client.totalRecorrente || 0) > 0) ||
        (tipoContratoFilter === "pontual" && (client.totalPontual || 0) > 0);

      return matchesSearch && matchesServico && matchesStatus && matchesTipoContrato;
    });
  }, [clientes, searchQuery, servicoFilter, statusFilter, tipoContratoFilter]);

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
  }, [searchQuery, servicoFilter, statusFilter, tipoContratoFilter, itemsPerPage, sortField, sortDirection]);

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
          
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select
              value={tipoContratoFilter}
              onValueChange={setTipoContratoFilter}
            >
              <SelectTrigger className="w-[140px]" data-testid="select-filter-tipo-contrato">
                <SelectValue placeholder="Tipo de contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Ambos</SelectItem>
                <SelectItem value="recorrente">Recorrente</SelectItem>
                <SelectItem value="pontual">Pontual</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={servicoFilter}
              onValueChange={setServicoFilter}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-filter-servico">
                <SelectValue placeholder="Todos os serviços" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os serviços</SelectItem>
                {servicosUnicos.map(servico => (
                  <SelectItem key={servico} value={servico}>{servico}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusUnicos.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
