import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown, FileText, FileCheck, DollarSign } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
}

type SortField = "service" | "clientName" | "status" | "squad" | "createdDate";
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

export default function Contracts() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [servicoFilter, setServicoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoContratoFilter, setTipoContratoFilter] = useState<string>("ambos");
  const [sortField, setSortField] = useState<SortField>("createdDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { data: contratos = [], isLoading, error } = useQuery<ContratoCompleto[]>({
    queryKey: ["/api/contratos"],
  });

  const contracts: Contract[] = useMemo(() => {
    return contratos.map(c => ({
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
    }));
  }, [contratos]);

  const servicosUnicos = useMemo(() => {
    const servicosSet = new Set<string>();
    contracts.forEach(contract => {
      if (contract.produto && contract.produto !== "") {
        servicosSet.add(contract.produto);
      }
    });
    return Array.from(servicosSet).sort();
  }, [contracts]);

  const statusUnicos = useMemo(() => {
    const statusSet = new Set<string>();
    contracts.forEach(contract => {
      if (contract.status && contract.status !== "Desconhecido") {
        statusSet.add(contract.status);
      }
    });
    return Array.from(statusSet).sort();
  }, [contracts]);

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
      
      const matchesServico = servicoFilter === "all" || contract.produto === servicoFilter;
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      
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
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredContracts, sortField, sortDirection]);

  const kpis = useMemo(() => {
    if (!filteredContracts || filteredContracts.length === 0) {
      return { totalContratos: 0, contratosAtivos: 0, aovMedio: 0 };
    }
    
    const totalContratos = filteredContracts.length;
    const contratosAtivos = filteredContracts.filter(c => {
      const status = c.status.toLowerCase();
      return status === "ativo" || status === "onboarding" || status === "triagem";
    }).length;
    
    const somaValorTotal = filteredContracts.reduce((acc, contract) => {
      return acc + contract.recurringValue + contract.oneTimeValue;
    }, 0);
    
    const aovMedio = totalContratos > 0 ? somaValorTotal / totalContratos : 0;
    
    return { totalContratos, contratosAtivos, aovMedio };
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
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold mb-2">Contratos</h1>
            <p className="text-muted-foreground">Carregando contratos...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold mb-2">Contratos</h1>
            <p className="text-red-500">Erro ao carregar contratos. Tente novamente mais tarde.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Contratos</h1>
          <p className="text-muted-foreground">Gerencie contratos e acompanhe status de serviços</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card data-testid="card-total-contratos">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Contratos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-contratos">
                {kpis.totalContratos}
              </div>
              <p className="text-xs text-muted-foreground">
                Contratos {servicoFilter !== "all" || statusFilter !== "all" ? "filtrados" : "cadastrados"}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-contratos-ativos">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contratos Ativos</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-contratos-ativos">
                {kpis.contratosAtivos}
              </div>
              <p className="text-xs text-muted-foreground">
                Ativo, onboarding e triagem
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-aov-medio">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AOV Médio</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-aov-medio">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.aovMedio)}
              </div>
              <p className="text-xs text-muted-foreground">
                Ticket médio por contrato
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
          <div className="flex-1 w-full">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar por serviço ou cliente..."
              data-testid="input-search-contracts"
            />
          </div>
          <Select value={servicoFilter} onValueChange={setServicoFilter}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-servico-filter">
              <SelectValue placeholder="Todos os serviços" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {servicosUnicos.map(servico => (
                <SelectItem key={servico} value={servico}>{servico}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-status-filter">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusUnicos.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipoContratoFilter} onValueChange={setTipoContratoFilter}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-tipo-contrato-filter">
              <SelectValue placeholder="Tipo de contrato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ambos">Ambos</SelectItem>
              <SelectItem value="recorrente">Recorrente</SelectItem>
              <SelectItem value="pontual">Pontual</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="default" 
            data-testid="button-add-contract"
            onClick={() => window.open('https://contratos.turbopartners.com.br/index.php?page=contratos&action=new', '_blank')}
          >
            + Novo Contrato
          </Button>
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
                <TableHead className="text-right bg-background">Valor R</TableHead>
                <TableHead className="text-right bg-background">Valor P</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
