import { useMemo, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, FileText, FileCheck, DollarSign, Activity, Edit2, Check, ChevronsUpDown } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import { ContractsTableSkeleton } from "@/components/ui/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInMonths, differenceInDays, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { ContratoCompleto } from "@shared/schema";

interface Contract {
  id: string;
  service: string;
  produto: string;
  clientName: string;
  clientId: string;
  status: string;
  squad: string;
  squadCode: string;
  responsavel: string;
  csResponsavel: string;
  createdDate: string;
  dataEntrega: string;
  recurringValue: number;
  oneTimeValue: number;
  lt: number;
  ltDays: number;
  dataSolicitacaoEncerramento: string;
  rawDataInicio: string | null;
  rawDataEncerramento: string | null;
}

interface ContractsProps {
  searchQuery: string;
  servicoFilter: string[];
  statusFilter: string[];
  tipoContratoFilter: string;
  produtoFilter: string[];
}

type SortField = "service" | "status" | "squad" | "responsavel" | "csResponsavel" | "createdDate" | "recurringValue" | "oneTimeValue" | "lt" | "dataSolicitacaoEncerramento" | "dataEntrega";
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
  produtoFilter,
}: ContractsProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sortField, setSortField] = useState<SortField>("createdDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    servico: "",
    produto: "",
    status: "",
    squad: "",
    valorr: "",
    valorp: "",
    dataInicio: "",
    dataEncerramento: "",
    responsavel: "",
    csResponsavel: "",
  });

  const { data: contratos = [], isLoading, error } = useQuery<ContratoCompleto[]>({
    queryKey: ["/api/contratos"],
  });

  const { data: colaboradores = [] } = useQuery<{ id: number; nome: string; status: string | null }[]>({
    queryKey: ["/api/colaboradores/dropdown"],
  });

  const { data: squads = [] } = useQuery<{ id: number; nome: string; codigo: string | null }[]>({
    queryKey: ["/api/rh/squads"],
  });

  const { data: produtos = [] } = useQuery<string[]>({
    queryKey: ["/api/contratos/produtos-distintos"],
  });

  const [produtoOpen, setProdutoOpen] = useState(false);
  const [responsavelOpen, setResponsavelOpen] = useState(false);
  const [csResponsavelOpen, setCsResponsavelOpen] = useState(false);

  const sortedColaboradores = useMemo(() => {
    return [...colaboradores].sort((a, b) => {
      const aAtivo = a.status?.toLowerCase() === "ativo" ? 0 : 1;
      const bAtivo = b.status?.toLowerCase() === "ativo" ? 0 : 1;
      if (aAtivo !== bAtivo) return aAtivo - bAtivo;
      return a.nome.localeCompare(b.nome);
    });
  }, [colaboradores]);

  const updateContractMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/contratos/${data.id}`, data.updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contratos"] });
      toast({ title: "Contrato atualizado", description: "As alterações foram salvas com sucesso." });
      setIsEditDialogOpen(false);
      setEditingContract(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar o contrato.", variant: "destructive" });
    }
  });

  const contracts: Contract[] = useMemo(() => {
    return contratos.map(c => {
      const endDate = c.dataEncerramento ? new Date(c.dataEncerramento) : new Date();
      const startDate = c.dataInicio ? new Date(c.dataInicio) : null;
      const lt = startDate ? differenceInMonths(endDate, startDate) : 0;
      const ltDays = startDate ? differenceInDays(endDate, startDate) : 0;
      
      const dataSolicCancel = c.dataSolicitacaoEncerramento 
        ? format(new Date(c.dataSolicitacaoEncerramento), 'dd/MM/yyyy')
        : "";

      const dataEntrega = c.dataEncerramento
        ? format(new Date(c.dataEncerramento), 'dd/MM/yyyy')
        : "";

      return {
        id: c.idSubtask || "",
        service: c.servico || c.produto || "Sem serviço",
        produto: c.produto || c.servico || "",
        clientName: c.nomeCliente || "Cliente não identificado",
        clientId: c.idCliente || "",
        status: c.status || "Desconhecido",
        squad: mapSquadCodeToName(c.squad),
        squadCode: c.squad || "",
        responsavel: c.responsavel || "",
        csResponsavel: c.csResponsavel || "",
        createdDate: c.dataInicio ? new Date(c.dataInicio).toISOString().split('T')[0] : "",
        dataEntrega,
        recurringValue: parseFloat(c.valorr || "0"),
        oneTimeValue: parseFloat(c.valorp || "0"),
        lt,
        ltDays,
        dataSolicitacaoEncerramento: dataSolicCancel,
        rawDataInicio: c.dataInicio ? new Date(c.dataInicio).toISOString().split('T')[0] : null,
        rawDataEncerramento: c.dataEncerramento ? new Date(c.dataEncerramento).toISOString().split('T')[0] : null,
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

  const handleEditClick = (contract: Contract, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingContract(contract);
    setEditForm({
      servico: contract.service,
      produto: contract.produto,
      status: contract.status,
      squad: contract.squadCode,
      valorr: contract.recurringValue.toString(),
      valorp: contract.oneTimeValue.toString(),
      dataInicio: contract.rawDataInicio || "",
      dataEncerramento: contract.rawDataEncerramento || "",
      responsavel: contract.responsavel,
      csResponsavel: contract.csResponsavel,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingContract) return;
    updateContractMutation.mutate({
      id: editingContract.id,
      updates: {
        servico: editForm.servico,
        produto: editForm.produto,
        status: editForm.status,
        squad: editForm.squad,
        valorr: editForm.valorr,
        valorp: editForm.valorp,
        dataInicio: editForm.dataInicio || null,
        dataEncerramento: editForm.dataEncerramento || null,
        responsavel: editForm.responsavel,
        csResponsavel: editForm.csResponsavel,
      },
    });
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      const matchesSearch = 
        contract.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.clientName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesServico = servicoFilter.length === 0 || servicoFilter.includes(contract.produto);
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(contract.status);
      const matchesProduto = produtoFilter.length === 0 || produtoFilter.includes(contract.produto);
      
      const matchesTipoContrato = 
        tipoContratoFilter === "ambos" ||
        (tipoContratoFilter === "recorrente" && contract.recurringValue > 0) ||
        (tipoContratoFilter === "pontual" && contract.oneTimeValue > 0);
      
      return matchesSearch && matchesServico && matchesStatus && matchesProduto && matchesTipoContrato;
    });
  }, [contracts, searchQuery, servicoFilter, statusFilter, produtoFilter, tipoContratoFilter]);

  const sortedContracts = useMemo(() => {
    return [...filteredContracts].sort((a, b) => {
      let comparison = 0;
      
      if (sortField === "service") {
        comparison = a.service.localeCompare(b.service);
      } else if (sortField === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === "squad") {
        comparison = a.squad.localeCompare(b.squad);
      } else if (sortField === "responsavel") {
        comparison = a.responsavel.localeCompare(b.responsavel);
      } else if (sortField === "csResponsavel") {
        comparison = a.csResponsavel.localeCompare(b.csResponsavel);
      } else if (sortField === "createdDate") {
        comparison = new Date(a.createdDate || 0).getTime() - new Date(b.createdDate || 0).getTime();
      } else if (sortField === "recurringValue") {
        comparison = a.recurringValue - b.recurringValue;
      } else if (sortField === "oneTimeValue") {
        comparison = a.oneTimeValue - b.oneTimeValue;
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
      } else if (sortField === "dataEntrega") {
        if (!a.dataEntrega && !b.dataEntrega) {
          comparison = 0;
        } else if (!a.dataEntrega) {
          comparison = 1;
        } else if (!b.dataEntrega) {
          comparison = -1;
        } else {
          const [dayA, monthA, yearA] = a.dataEntrega.split('/').map(Number);
          const [dayB, monthB, yearB] = b.dataEntrega.split('/').map(Number);
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
      return { totalContratos: 0, contratosOperando: 0, contratosAtivos: 0, aovMedio: 0, ativosRecorrentes: 0, ativosPontuais: 0 };
    }
    
    const totalContratos = filteredContracts.length;
    
    const contratosOperando = filteredContracts.filter(c => {
      const status = c.status.toLowerCase();
      return status === "ativo" || status === "onboarding" || status === "triagem" || status === "em cancelamento";
    }).length;
    
    const contratosAtivosArray = filteredContracts.filter(c => {
      const status = c.status.toLowerCase();
      return status === "ativo" || status === "onboarding" || status === "triagem";
    });
    
    const contratosAtivos = contratosAtivosArray.length;
    
    const ativosRecorrentes = contratosAtivosArray.filter(c => c.recurringValue > 0).length;
    
    const ativosPontuais = contratosAtivosArray.filter(c => c.oneTimeValue > 0 && c.recurringValue === 0).length;
    
    const somaValorTotal = filteredContracts.reduce((acc, contract) => {
      return acc + contract.recurringValue + contract.oneTimeValue;
    }, 0);
    
    const aovMedio = totalContratos > 0 ? somaValorTotal / totalContratos : 0;
    
    return { totalContratos, contratosOperando, contratosAtivos, aovMedio, ativosRecorrentes, ativosPontuais };
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
  }, [searchQuery, servicoFilter, statusFilter, tipoContratoFilter, produtoFilter]);

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
    } else if (statusLower.includes("entregue")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
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

  const formatLT = (months: number, days: number) => {
    if (months >= 1) {
      return `${months} m`;
    }
    return `${days} d`;
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
            subtitle={`Recorrentes: ${kpis.ativosRecorrentes} | Pontuais: ${kpis.ativosPontuais}`}
            tooltipType="help"
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
          <div className="max-h-[calc(100vh-400px)] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-20 shadow-sm">
                <TableRow className="bg-background border-b">
                  <TableHead className="bg-background w-[40px]"></TableHead>
                  <TableHead className="bg-background">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleSort("service")}
                      className="hover-elevate -ml-3"
                      data-testid="sort-produto"
                    >
                      Produto
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="bg-background">
                    <span className="text-sm font-medium">Cliente</span>
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
                      onClick={() => handleSort("responsavel")}
                      className="hover-elevate -ml-3"
                      data-testid="sort-responsavel"
                    >
                      Responsável
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="bg-background">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleSort("csResponsavel")}
                      className="hover-elevate -ml-3"
                      data-testid="sort-cs"
                    >
                      CS
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
                      data-testid="sort-solic-cancel"
                    >
                      Solic. Cancel.
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="bg-background">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleSort("dataEntrega")}
                      className="hover-elevate -ml-3"
                      data-testid="sort-data-entrega"
                    >
                      Data Entrega
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
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
                      <TableCell className="w-[40px]">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleEditClick(contract, e)}
                          className="h-8 w-8"
                          data-testid={`button-edit-${contract.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-produto-${contract.id}`}>
                        {contract.produto || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate" data-testid={`text-cliente-${contract.id}`}>
                        {contract.clientName || '-'}
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
                      <TableCell className="text-muted-foreground" data-testid={`text-responsavel-${contract.id}`}>
                        {contract.responsavel || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-cs-${contract.id}`}>
                        {contract.csResponsavel || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-date-${contract.id}`}>
                        {contract.createdDate ? new Date(contract.createdDate).toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold" data-testid={`text-recurring-${contract.id}`}>
                        {contract.recurringValue > 0 
                          ? formatCurrencyNoDecimals(contract.recurringValue)
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right font-semibold" data-testid={`text-onetime-${contract.id}`}>
                        {contract.oneTimeValue > 0 
                          ? formatCurrencyNoDecimals(contract.oneTimeValue)
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-lt-${contract.id}`}>
                        {formatLT(contract.lt, contract.ltDays)}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-solic-cancel-${contract.id}`}>
                        {contract.dataSolicitacaoEncerramento || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-data-entrega-${contract.id}`}>
                        {contract.dataEntrega || '-'}
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

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Contrato</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="servico">Serviço</Label>
                <Input
                  id="servico"
                  value={editForm.servico}
                  onChange={(e) => setEditForm({ ...editForm, servico: e.target.value })}
                  data-testid="input-edit-servico"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="produto">Produto</Label>
                <Popover open={produtoOpen} onOpenChange={setProdutoOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={produtoOpen}
                      className="w-full justify-between font-normal"
                      data-testid="combobox-edit-produto"
                    >
                      {editForm.produto || "Selecione o produto..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar produto..." />
                      <CommandList>
                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                        <CommandGroup>
                          {produtos.map((produto) => (
                            <CommandItem
                              key={produto}
                              value={produto}
                              onSelect={(value) => {
                                setEditForm({ ...editForm, produto: value });
                                setProdutoOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", editForm.produto === produto ? "opacity-100" : "opacity-0")} />
                              {produto}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                >
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Onboarding">Onboarding</SelectItem>
                    <SelectItem value="Triagem">Triagem</SelectItem>
                    <SelectItem value="Em Cancelamento">Em Cancelamento</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="squad">Squad</Label>
                <Select
                  value={editForm.squad}
                  onValueChange={(value) => setEditForm({ ...editForm, squad: value })}
                >
                  <SelectTrigger data-testid="select-edit-squad">
                    <SelectValue placeholder="Selecione o squad" />
                  </SelectTrigger>
                  <SelectContent>
                    {squads.length > 0 ? (
                      squads.map((squad) => (
                        <SelectItem key={squad.id} value={squad.codigo || squad.id.toString()}>
                          {squad.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="0">Supreme</SelectItem>
                        <SelectItem value="1">Forja</SelectItem>
                        <SelectItem value="2">Squadra</SelectItem>
                        <SelectItem value="3">Chama</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valorr">Valor Recorrente</Label>
                <Input
                  id="valorr"
                  type="number"
                  step="0.01"
                  value={editForm.valorr}
                  onChange={(e) => setEditForm({ ...editForm, valorr: e.target.value })}
                  data-testid="input-edit-valorr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valorp">Valor Pontual</Label>
                <Input
                  id="valorp"
                  type="number"
                  step="0.01"
                  value={editForm.valorp}
                  onChange={(e) => setEditForm({ ...editForm, valorp: e.target.value })}
                  data-testid="input-edit-valorp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataInicio">Data Início</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={editForm.dataInicio}
                  onChange={(e) => setEditForm({ ...editForm, dataInicio: e.target.value })}
                  data-testid="input-edit-data-inicio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataEncerramento">Data Encerramento</Label>
                <Input
                  id="dataEncerramento"
                  type="date"
                  value={editForm.dataEncerramento}
                  onChange={(e) => setEditForm({ ...editForm, dataEncerramento: e.target.value })}
                  data-testid="input-edit-data-encerramento"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável</Label>
                <Popover open={responsavelOpen} onOpenChange={setResponsavelOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={responsavelOpen}
                      className="w-full justify-between font-normal"
                      data-testid="combobox-edit-responsavel"
                    >
                      {editForm.responsavel || "Selecione o responsável..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar colaborador..." />
                      <CommandList>
                        <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setEditForm({ ...editForm, responsavel: "" });
                              setResponsavelOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", !editForm.responsavel ? "opacity-100" : "opacity-0")} />
                            Nenhum
                          </CommandItem>
                          {sortedColaboradores.map((colab) => (
                            <CommandItem
                              key={colab.id}
                              value={colab.nome}
                              onSelect={(value) => {
                                setEditForm({ ...editForm, responsavel: value });
                                setResponsavelOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", editForm.responsavel === colab.nome ? "opacity-100" : "opacity-0")} />
                              {colab.nome} {colab.status?.toLowerCase() !== "ativo" ? "(Inativo)" : ""}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="csResponsavel">CS Responsável</Label>
                <Popover open={csResponsavelOpen} onOpenChange={setCsResponsavelOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={csResponsavelOpen}
                      className="w-full justify-between font-normal"
                      data-testid="combobox-edit-cs"
                    >
                      {editForm.csResponsavel || "Selecione o CS..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar colaborador..." />
                      <CommandList>
                        <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setEditForm({ ...editForm, csResponsavel: "" });
                              setCsResponsavelOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", !editForm.csResponsavel ? "opacity-100" : "opacity-0")} />
                            Nenhum
                          </CommandItem>
                          {sortedColaboradores.map((colab) => (
                            <CommandItem
                              key={colab.id}
                              value={colab.nome}
                              onSelect={(value) => {
                                setEditForm({ ...editForm, csResponsavel: value });
                                setCsResponsavelOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", editForm.csResponsavel === colab.nome ? "opacity-100" : "opacity-0")} />
                              {colab.nome} {colab.status?.toLowerCase() !== "ativo" ? "(Inativo)" : ""}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                data-testid="button-cancel-edit"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateContractMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateContractMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
