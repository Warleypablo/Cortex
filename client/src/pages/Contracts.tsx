import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, FileText, FileCheck, DollarSign, Activity } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import { ContractsTableSkeleton } from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInMonths, format } from "date-fns";
import type { ContratoCompleto } from "@shared/schema";

interface Contract {
  id: string;
  service: string;
  produto: string;
  clientName: string;
  clientId: string;
  status: string;
  squad: string;
  createdDate: string;
  recurringValue: number;
  oneTimeValue: number;
  lt: number;
  dataSolicitacaoEncerramento: string;
}

interface ContractsProps {
  searchQuery: string;
  servicoFilter: string[];
  statusFilter: string[];
  tipoContratoFilter: string;
}

type SortField = "service" | "clientName" | "status" | "squad" | "createdDate" | "lt" | "dataSolicitacaoEncerramento";
type SortDirection = "asc" | "desc";

const mapSquadCodeToName = (code: string | null): string => {
  if (!code) return "Não definido";
  switch (code) {
    case "0": return "Supreme";
    case "1": return "Forja";
    case "2": return "Squadra";
    case "3": return "Chama";
    default: return code;
  }
};

export default function Contracts({
  searchQuery,
  servicoFilter,
  statusFilter,
  tipoContratoFilter,
}: ContractsProps) {
  const [, setLocation] = useLocation();
  const [sortField, setSortField] = useState<SortField>("createdDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { data: contratos = [], isLoading, error } = useQuery<ContratoCompleto[]>({
    queryKey: ["/api/contratos"],
  });

  const contracts: Contract[] = useMemo(() => {
    return contratos.map(c => {
      const endDate = c.dataEncerramento ? new Date(c.dataEncerramento) : new Date();
      const startDate = c.dataInicio ? new Date(c.dataInicio) : null;
      const lt = startDate ? differenceInMonths(endDate, startDate) : 0;
      
      const dataSolicCancel = c.dataSolicitacaoEncerramento 
        ? format(new Date(c.dataSolicitacaoEncerramento), 'dd/MM/yyyy')
        : "";

      return {
        id: c.idSubtask || "",
        service: c.servico || c.produto || "Sem serviço",
        produto: c.produto || c.servico || "",
        clientName: c.nomeCliente || "Cliente não identificado",
        clientId: c.idCliente || "",
        status: c.status || "Desconhecido",
        squad: mapSquadCodeToName(c.squad),
        createdDate: c.dataInicio ? new Date(c.dataInicio).toISOString().split('T')[0] : "",
        recurringValue: parseFloat(c.valorr || "0"),
        oneTimeValue: parseFloat(c.valorp || "0"),
        lt,
        dataSolicitacaoEncerramento: dataSolicCancel,
      };
    });
  }, [contratos]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      const matchesSearch = 
        contract.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.clientName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesServico = servicoFilter.length === 0 || servicoFilter.includes(contract.produto);
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(contract.status);
      
      const matchesTipoContrato = 
        tipoContratoFilter === "ambos" ||
        (tipoContratoFilter === "recorrente" && contract.recurringValue > 0) ||
        (tipoContratoFilter === "pontual" && contract.oneTimeValue > 0);
      
      return matchesSearch && matchesServico && matchesStatus && matchesTipoContrato;
    });
  }, [contracts, searchQuery, servicoFilter, statusFilter, tipoContratoFilter]);

  const sortedContracts = useMemo(() => {
    return [...filteredContracts].sort((a, b) => {
      let comparison = 0;
      
      if (sortField === "service") {
        comparison = a.service.localeCompare(b.service);
      } else if (sortField === "clientName") {
        comparison = a.clientName.localeCompare(b.clientName);
      } else if (sortField === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === "squad") {
        comparison = a.squad.localeCompare(b.squad);
      } else if (sortField === "createdDate") {
        comparison = new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
      } else if (sortField === "lt") {
        comparison = a.lt - b.lt;
      } else if (sortField === "dataSolicitacaoEncerramento") {
        if (!a.dataSolicitacaoEncerramento && !b.dataSolicitacaoEncerramento) {
          comparison = 0;
        } else if (!a.dataSolicitacaoEncerramento) {
          comparison = 1;
        } else if (!b.dataSolicitacaoEncerramento) {
          comparison = -1;
        } else {
          const [dayA, monthA, yearA] = a.dataSolicitacaoEncerramento.split('/').map(Number);
          const [dayB, monthB, yearB] = b.dataSolicitacaoEncerramento.split('/').map(Number);
          const dateA = new Date(yearA, monthA - 1, dayA);
          const dateB = new Date(yearB, monthB - 1, dayB);
          comparison = dateA.getTime() - dateB.getTime();
        }
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredContracts, sortField, sortDirection]);

  const kpis = useMemo(() => {
    if (!filteredContracts || filteredContracts.length === 0) {
      return { totalContratos: 0, contratosOperando: 0, contratosAtivos: 0, aovMedio: 0 };
    }
    
    const totalContratos = filteredContracts.length;
    
    const contratosOperando = filteredContracts.filter(c => {
      const status = c.status.toLowerCase();
      return status === "ativo" || status === "onboarding" || status === "triagem" || status === "em cancelamento";
    }).length;
    
    const contratosAtivos = filteredContracts.filter(c => {
      const status = c.status.toLowerCase();
      return status === "ativo" || status === "onboarding" || status === "triagem";
    }).length;
    
    const somaValorTotal = filteredContracts.reduce((acc, contract) => {
      return acc + contract.recurringValue + contract.oneTimeValue;
    }, 0);
    
    const aovMedio = totalContratos > 0 ? somaValorTotal / totalContratos : 0;
    
    return { totalContratos, contratosOperando, contratosAtivos, aovMedio };
  }, [filteredContracts]);

  const totalPages = Math.ceil(sortedContracts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContracts = sortedContracts.slice(startIndex, endIndex);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, servicoFilter, statusFilter, tipoContratoFilter]);

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("ativo") || statusLower.includes("active")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    } else if (statusLower.includes("onboard") || statusLower.includes("início")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    } else if (statusLower.includes("triagem") || statusLower.includes("análise")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    } else if (statusLower.includes("cancelamento") || statusLower.includes("pausa")) {
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    } else if (statusLower.includes("cancelado") || statusLower.includes("inativo")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  };

  const getSquadColor = (squad: string) => {
    switch (squad) {
      case "Supreme":
      case "Performance":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "Forja":
      case "Comunicação":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "Squadra":
      case "Tech":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";
      case "Chama":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl" data-testid="loading-contracts">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl p-4 bg-white/60 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="w-7 h-7 rounded-md" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="pl-9">
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            ))}
          </div>
          <ContractsTableSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-8">
            <p className="text-red-500">Erro ao carregar contratos. Tente novamente mais tarde.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="Total de Contratos"
            value={String(kpis.totalContratos)}
            icon={FileText}
            subtitle={servicoFilter.length > 0 || statusFilter.length > 0 ? "Contratos filtrados" : "Contratos cadastrados"}
            animateValue
            rawValue={kpis.totalContratos}
            formatValue={(v) => String(Math.round(v))}
          />
          <StatsCard
            title="Contratos Operando"
            value={String(kpis.contratosOperando)}
            icon={Activity}
            variant="info"
            subtitle="Triagem, onboarding, ativo ou em cancelamento"
            tooltipType="help"
            animateValue
            rawValue={kpis.contratosOperando}
            formatValue={(v) => String(Math.round(v))}
          />
          <StatsCard
            title="Contratos Ativos"
            value={String(kpis.contratosAtivos)}
            icon={FileCheck}
            variant="success"
            subtitle="Ativo, onboarding e triagem"
            animateValue
            rawValue={kpis.contratosAtivos}
            formatValue={(v) => String(Math.round(v))}
          />
          <StatsCard
            title="AOV Médio"
            value={formatCurrencyNoDecimals(kpis.aovMedio)}
            icon={DollarSign}
            variant="info"
            subtitle="Ticket médio por contrato"
            tooltipType="help"
            animateValue
            rawValue={kpis.aovMedio}
            formatValue={(v) => formatCurrencyNoDecimals(v)}
          />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-20 shadow-sm">
                <TableRow className="bg-background border-b">
                <TableHead className="bg-background">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("service")}
                    className="hover-elevate -ml-3"
                    data-testid="sort-service"
                  >
                    Serviço
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="bg-background">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("clientName")}
                    className="hover-elevate -ml-3"
                    data-testid="sort-client"
                  >
                    Cliente
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="bg-background">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("status")}
                    className="hover-elevate -ml-3"
                    data-testid="sort-status"
                  >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="bg-background">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("squad")}
                    className="hover-elevate -ml-3"
                    data-testid="sort-squad"
                  >
                    Squad
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="bg-background">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("createdDate")}
                    className="hover-elevate -ml-3"
                    data-testid="sort-date"
                  >
                    Data Início
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="bg-background">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("lt")}
                    className="hover-elevate -ml-3"
                    data-testid="sort-lt"
                  >
                    LT
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="bg-background">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("dataSolicitacaoEncerramento")}
                    className="hover-elevate -ml-3"
                    data-testid="sort-data-solic-cancel"
                  >
                    Data Solic. Cancel.
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right bg-background">Valor R</TableHead>
                <TableHead className="text-right bg-background">Valor P</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {searchQuery ? "Nenhum contrato encontrado com esse critério de busca." : "Nenhum contrato cadastrado."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedContracts.map((contract) => (
                  <TableRow 
                    key={contract.id} 
                    className="cursor-pointer hover-elevate"
                    onClick={() => contract.clientId && setLocation(`/cliente/${contract.clientId}`)}
                    data-testid={`contract-row-${contract.id}`}
                  >
                    <TableCell className="font-medium" data-testid={`text-service-${contract.id}`}>
                      {contract.service}
                    </TableCell>
                    <TableCell data-testid={`text-client-${contract.id}`}>
                      {contract.clientName}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(contract.status)} variant="outline" data-testid={`badge-status-${contract.id}`}>
                        {contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getSquadColor(contract.squad)} variant="outline" data-testid={`badge-squad-${contract.id}`}>
                        {contract.squad}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`text-date-${contract.id}`}>
                      {contract.createdDate ? new Date(contract.createdDate).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`text-lt-${contract.id}`}>
                      {contract.lt} m
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`text-data-solic-cancel-${contract.id}`}>
                      {contract.dataSolicitacaoEncerramento || '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold" data-testid={`text-recurring-${contract.id}`}>
                      {contract.recurringValue > 0 
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.recurringValue)
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right font-semibold" data-testid={`text-onetime-${contract.id}`}>
                      {contract.oneTimeValue > 0 
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.oneTimeValue)
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Itens por página:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[100px]" data-testid="select-items-per-page">
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

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  data-testid="button-first-page"
                >
                  Primeira
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Próxima
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  data-testid="button-last-page"
                >
                  Última
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
