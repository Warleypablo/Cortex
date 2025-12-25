import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ClientsTable from "@/components/ClientsTable";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, TrendingUp, Clock, DollarSign, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import StatsCard from "@/components/StatsCard";
import { ClientsTableSkeleton } from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyWithDecimals, formatDecimal, formatPercent } from "@/lib/utils";
import type { ClienteCompleto } from "../../../server/storage";

type SortField = "name" | "cnpj" | "ltv" | "lt" | "aov" | "status" | "startDate";
type SortDirection = "asc" | "desc";

interface ClientsProps {
  searchQuery: string;
  servicoFilter: string[];
  statusFilter: string[];
  tipoContratoFilter: string;
  responsavelFilter: string[];
  clusterFilter: string;
  ltOperator: string;
  ltValue: string;
  aovOperator: string;
  aovValue: string;
}

export default function Clients({
  searchQuery,
  servicoFilter,
  statusFilter,
  tipoContratoFilter,
  responsavelFilter,
  clusterFilter,
  ltOperator,
  ltValue,
  aovOperator,
  aovValue,
}: ClientsProps) {
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField>("ltv");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: clientes, isLoading, error } = useQuery<ClienteCompleto[]>({
    queryKey: ["/api/clientes"],
  });

  const { data: ltvMap } = useQuery<Record<string, number>>({
    queryKey: ["/api/clientes-ltv"],
  });

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
    const getStatusPriority = (status: string) => {
      const s = status.toLowerCase();
      if (s === "ativo") return 0;
      if (s === "onboarding") return 1;
      if (s === "triagem") return 2;
      if (s === "em cancelamento") return 3;
      return 4;
    };

    return [...filteredClients].sort((a, b) => {
      const statusPriorityA = getStatusPriority(a.statusClickup || "");
      const statusPriorityB = getStatusPriority(b.statusClickup || "");
      if (statusPriorityA !== statusPriorityB) {
        return statusPriorityA - statusPriorityB;
      }

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
      } else if (sortField === "aov") {
        const ltvA = ltvMap?.[a.ids || String(a.id)] || 0;
        const ltvB = ltvMap?.[b.ids || String(b.id)] || 0;
        const ltA = a.ltMeses || 0;
        const ltB = b.ltMeses || 0;
        const aovA = ltA > 0 ? ltvA / ltA : 0;
        const aovB = ltB > 0 ? ltvB / ltB : 0;
        comparison = aovA - aovB;
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
      return { totalClientes: 0, clientesOperando: 0, clientesAtivos: 0, ltvMedio: 0, ltMedio: 0, aov: 0 };
    }
    
    const totalClientes = filteredClients.length;
    const clientesOperando = filteredClients.filter(c => {
      const status = (c.statusClickup || "").toLowerCase();
      return status === "ativo" || status === "onboarding" || status === "triagem" || status === "em cancelamento";
    }).length;
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
    
    return { totalClientes, clientesOperando, clientesAtivos, ltvMedio, ltMedio, aov };
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

  if (error) {
    return (
      <div className="bg-background">
        <div className="w-full px-6 py-8">
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
      <div className="bg-background h-full">
        <div className="w-full px-6 py-4 h-full flex flex-col" data-testid="loading-clients">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl p-4 bg-white/60 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="w-7 h-7 rounded-md" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="pl-9">
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            <ClientsTableSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background h-full">
      <div className="w-full px-6 py-4 h-full flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <StatsCard
            title="Total de Clientes"
            value={String(kpis.totalClientes)}
            icon={Users}
            subtitle="Quantidade de clientes cadastrados no ClickUp (ativos + inativos)"
            tooltipType="help"
            animateValue
            rawValue={kpis.totalClientes}
            formatValue={(v) => String(Math.round(v))}
          />
          <StatsCard
            title="Clientes Operando"
            value={String(kpis.clientesOperando)}
            icon={Activity}
            variant="info"
            subtitle={`${kpis.totalClientes > 0 ? formatPercent((kpis.clientesOperando / kpis.totalClientes) * 100) : '0%'} dos clientes estão com status Triagem, Onboarding, Ativo ou Em Cancelamento`}
            tooltipType="help"
            animateValue
            rawValue={kpis.clientesOperando}
            formatValue={(v) => String(Math.round(v))}
          />
          <StatsCard
            title="Clientes Ativos"
            value={String(kpis.clientesAtivos)}
            icon={UserCheck}
            variant="success"
            subtitle={`${kpis.totalClientes > 0 ? formatPercent((kpis.clientesAtivos / kpis.totalClientes) * 100) : '0%'} dos clientes estão com status Ativo, Onboarding ou Triagem`}
            tooltipType="help"
            animateValue
            rawValue={kpis.clientesAtivos}
            formatValue={(v) => String(Math.round(v))}
          />
          <StatsCard
            title="LTV Médio"
            value={formatCurrencyWithDecimals(kpis.ltvMedio)}
            icon={TrendingUp}
            variant="info"
            subtitle="Soma de toda a receita paga dividida pelo número de clientes. Quanto maior, mais valor cada cliente gerou."
            tooltipType="help"
            animateValue
            rawValue={kpis.ltvMedio}
            formatValue={(v) => formatCurrencyWithDecimals(v)}
          />
          <StatsCard
            title="LT Médio"
            value={formatDecimal(kpis.ltMedio)}
            icon={Clock}
            subtitle="Média de meses que os clientes permanecem pagando. Quanto maior, mais tempo de relacionamento."
            tooltipType="help"
            animateValue
            rawValue={kpis.ltMedio}
            formatValue={(v) => formatDecimal(v)}
          />
          <StatsCard
            title="AOV"
            value={formatCurrencyWithDecimals(kpis.aov)}
            icon={DollarSign}
            variant="success"
            subtitle="Ticket médio mensal por cliente. É o LTV dividido pelo LT (tempo de vida)."
            tooltipType="help"
            animateValue
            rawValue={kpis.aov}
            formatValue={(v) => formatCurrencyWithDecimals(v)}
          />
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
