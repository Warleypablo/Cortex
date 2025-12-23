import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Search, Package, Filter, ChevronUp, ChevronDown, 
  DollarSign, TrendingUp, CheckCircle, X, Users, Phone, Pencil, Check, ChevronsUpDown, Info
} from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Telefone } from "@shared/schema";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ColaboradorDropdown {
  id: number;
  nome: string;
}

interface PatrimonioDb {
  id: number;
  numeroAtivo: string | null;
  ativo: string | null;
  marca: string | null;
  estadoConservacao: string | null;
  responsavelAtual: string | null;
  responsavelId: number | null;
  valorPago: string | null;
  valorMercado: string | null;
  valorVenda: string | null;
  descricao: string | null;
}

type SortField = "numeroAtivo" | "ativo" | "marca" | "descricao" | "estadoConservacao" | "responsavelAtual" | "valorPago" | "valorMercado";
type SortDirection = "asc" | "desc";
type TelefonesSortField = "conta" | "planoOperadora" | "telefone" | "responsavelNome" | "setor" | "ultimaRecarga" | "status";

export default function Patrimonio() {
  useSetPageInfo("Patrimônio", "Gerencie os bens e ativos da empresa");
  
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filterTipoBem, setFilterTipoBem] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterMarca, setFilterMarca] = useState<string>("todos");
  const [filterResponsavel, setFilterResponsavel] = useState<string>("todos");
  const [sortField, setSortField] = useState<SortField | "default">("default");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("patrimonios");
  
  // Telefones state
  const [telefonesSearchQuery, setTelefonesSearchQuery] = useState("");
  const [filterSetor, setFilterSetor] = useState<string>("todos");
  const [filterPlano, setFilterPlano] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [telefonesSortField, setTelefonesSortField] = useState<TelefonesSortField | null>(null);
  const [telefonesSortDirection, setTelefonesSortDirection] = useState<SortDirection>("asc");
  const [editingTelefone, setEditingTelefone] = useState<Telefone | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [responsavelOpen, setResponsavelOpen] = useState(false);
  
  const { toast } = useToast();

  const { data: patrimonios, isLoading, error } = useQuery<PatrimonioDb[]>({
    queryKey: ["/api/patrimonio"],
  });

  const { data: telefones, isLoading: isLoadingTelefones } = useQuery<Telefone[]>({
    queryKey: ["/api/telefones"],
  });

  const { data: colaboradoresDropdown } = useQuery<ColaboradorDropdown[]>({
    queryKey: ["/api/colaboradores/dropdown"],
  });

  const uniqueTiposBem = useMemo(() => {
    if (!patrimonios) return [];
    const tipos = new Set<string>();
    patrimonios.forEach(p => {
      if (p.ativo) tipos.add(p.ativo);
    });
    return Array.from(tipos).sort();
  }, [patrimonios]);

  const uniqueEstados = useMemo(() => {
    if (!patrimonios) return [];
    const estados = new Set<string>();
    patrimonios.forEach(p => {
      if (p.estadoConservacao) estados.add(p.estadoConservacao);
    });
    return Array.from(estados).sort();
  }, [patrimonios]);

  const uniqueMarcas = useMemo(() => {
    if (!patrimonios) return [];
    const marcas = new Set<string>();
    patrimonios.forEach(p => {
      if (p.marca) marcas.add(p.marca);
    });
    return Array.from(marcas).sort();
  }, [patrimonios]);

  const uniqueResponsaveis = useMemo(() => {
    if (!patrimonios) return [];
    const responsaveis = new Set<string>();
    patrimonios.forEach(p => {
      if (p.responsavelAtual) responsaveis.add(p.responsavelAtual);
    });
    return Array.from(responsaveis).sort();
  }, [patrimonios]);

  const stats = useMemo(() => {
    if (!patrimonios) return { totalAtivos: 0, ativosBom: 0, computadoresNotebooksBom: 0, computadoresNotebooksAtribuidos: 0, valorPago: 0, valorMercado: 0 };
    
    let ativosBom = 0;
    let computadoresNotebooksBom = 0;
    let computadoresNotebooksAtribuidos = 0;
    let valorPago = 0;
    let valorMercado = 0;
    
    patrimonios.forEach(p => {
      const estado = p.estadoConservacao?.toLowerCase() || "";
      const ativo = p.ativo?.toLowerCase() || "";
      const isBomEstado = estado.includes("bom") || estado.includes("novo") || estado.includes("ótimo");
      const isBomOuEstoque = isBomEstado || estado.includes("estoque");
      const isComputadorNotebook = ativo.includes("computador") || ativo.includes("notebook");
      
      if (isBomEstado) {
        ativosBom++;
      }
      if (isComputadorNotebook && isBomOuEstoque) {
        computadoresNotebooksBom++;
      }
      const temResponsavel = p.responsavelAtual && p.responsavelAtual !== "-" && p.responsavelAtual.trim() !== "";
      if (isComputadorNotebook && isBomOuEstoque && temResponsavel) {
        computadoresNotebooksAtribuidos++;
      }
      if (p.valorPago) {
        const val = parseFloat(p.valorPago);
        if (!isNaN(val)) valorPago += val;
      }
      if (p.valorMercado) {
        const val = parseFloat(p.valorMercado);
        if (!isNaN(val)) valorMercado += val;
      }
    });
    
    return {
      totalAtivos: patrimonios.length,
      ativosBom,
      computadoresNotebooksBom,
      computadoresNotebooksAtribuidos,
      valorPago,
      valorMercado,
    };
  }, [patrimonios]);

  const filteredAndSortedPatrimonios = useMemo(() => {
    if (!patrimonios) return [];
    
    let result = [...patrimonios];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.numeroAtivo?.toLowerCase().includes(query) ||
        p.ativo?.toLowerCase().includes(query) ||
        p.marca?.toLowerCase().includes(query) ||
        p.responsavelAtual?.toLowerCase().includes(query) ||
        p.descricao?.toLowerCase().includes(query)
      );
    }
    
    if (filterTipoBem !== "todos") {
      result = result.filter(p => p.ativo === filterTipoBem);
    }
    
    if (filterEstado !== "todos") {
      result = result.filter(p => p.estadoConservacao === filterEstado);
    }

    if (filterMarca !== "todos") {
      result = result.filter(p => p.marca === filterMarca);
    }

    if (filterResponsavel !== "todos") {
      if (filterResponsavel === "sem_responsavel") {
        result = result.filter(p => !p.responsavelAtual);
      } else {
        result = result.filter(p => p.responsavelAtual === filterResponsavel);
      }
    }
    
    result.sort((a, b) => {
      // Ordenação padrão: Notebooks/Computadores primeiro, depois bom estado
      if (sortField === "default") {
        const ativoA = a.ativo?.toLowerCase() || "";
        const ativoB = b.ativo?.toLowerCase() || "";
        const estadoA = a.estadoConservacao?.toLowerCase() || "";
        const estadoB = b.estadoConservacao?.toLowerCase() || "";
        
        const isNotebookComputadorA = ativoA.includes("notebook") || ativoA.includes("computador");
        const isNotebookComputadorB = ativoB.includes("notebook") || ativoB.includes("computador");
        const isBomA = estadoA.includes("bom") || estadoA.includes("novo") || estadoA.includes("ótimo");
        const isBomB = estadoB.includes("bom") || estadoB.includes("novo") || estadoB.includes("ótimo");
        
        // Prioridade 1: Notebooks/Computadores primeiro
        if (isNotebookComputadorA && !isNotebookComputadorB) return -1;
        if (!isNotebookComputadorA && isNotebookComputadorB) return 1;
        
        // Prioridade 2: Bom estado primeiro
        if (isBomA && !isBomB) return -1;
        if (!isBomA && isBomB) return 1;
        
        // Desempate por número do ativo
        return (a.numeroAtivo || "").localeCompare(b.numeroAtivo || "", undefined, { numeric: true });
      }
      
      let valA: string | number = "";
      let valB: string | number = "";
      
      if (sortField === "valorPago" || sortField === "valorMercado") {
        valA = parseFloat(a[sortField] || "0") || 0;
        valB = parseFloat(b[sortField] || "0") || 0;
        return sortDirection === "asc" ? valA - valB : valB - valA;
      } else {
        valA = a[sortField] || "";
        valB = b[sortField] || "";
        if (sortField === "numeroAtivo") {
          return sortDirection === "asc" 
            ? valA.localeCompare(valB, undefined, { numeric: true })
            : valB.localeCompare(valA, undefined, { numeric: true });
        }
        return sortDirection === "asc" 
          ? valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' })
          : valB.localeCompare(valA, 'pt-BR', { sensitivity: 'base' });
      }
    });
    
    return result;
  }, [patrimonios, searchQuery, filterTipoBem, filterEstado, filterMarca, filterResponsavel, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedPatrimonios.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPatrimonios = filteredAndSortedPatrimonios.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField === "default" || sortField !== field) return null;
    return sortDirection === "asc" 
      ? <ChevronUp className="w-4 h-4 ml-1" />
      : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  const getEstadoColor = (estado: string | null) => {
    if (!estado) return "";
    const estadoLower = estado.toLowerCase();
    if (estadoLower.includes("bom") || estadoLower.includes("novo") || estadoLower.includes("ótimo")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    }
    if (estadoLower.includes("regular") || estadoLower.includes("médio") || estadoLower.includes("medio")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    }
    if (estadoLower.includes("ruim") || estadoLower.includes("péssimo") || estadoLower.includes("pessimo")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return "-";
    const num = parseFloat(value);
    if (isNaN(num)) return "-";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const formatCurrencyNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const clearFilters = () => {
    setFilterTipoBem("todos");
    setFilterEstado("todos");
    setFilterMarca("todos");
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Telefones filtering
  const uniqueSetores = useMemo(() => {
    if (!telefones) return [];
    const setores = new Set<string>();
    telefones.forEach(t => {
      if (t.setor) setores.add(t.setor);
    });
    return Array.from(setores).sort();
  }, [telefones]);

  const uniquePlanos = useMemo(() => {
    if (!telefones) return [];
    const planos = new Set<string>();
    telefones.forEach(t => {
      if (t.planoOperadora) planos.add(t.planoOperadora);
    });
    return Array.from(planos).sort();
  }, [telefones]);

  const filteredTelefones = useMemo(() => {
    if (!telefones) return [];
    
    let result = telefones.filter(t => {
      const matchesSearch = telefonesSearchQuery === "" ||
        (t.telefone && t.telefone.toLowerCase().includes(telefonesSearchQuery.toLowerCase())) ||
        (t.responsavelNome && t.responsavelNome.toLowerCase().includes(telefonesSearchQuery.toLowerCase())) ||
        (t.conta && t.conta.toLowerCase().includes(telefonesSearchQuery.toLowerCase()));
      
      const matchesSetor = filterSetor === "todos" || t.setor === filterSetor;
      const matchesPlano = filterPlano === "todos" || t.planoOperadora === filterPlano;
      const matchesStatus = filterStatus === "todos" || t.status === filterStatus;
      
      return matchesSearch && matchesSetor && matchesPlano && matchesStatus;
    });
    
    if (telefonesSortField) {
      result = [...result].sort((a, b) => {
        let valA: string = "";
        let valB: string = "";
        
        if (telefonesSortField === "ultimaRecarga") {
          valA = a.ultimaRecarga || "";
          valB = b.ultimaRecarga || "";
        } else {
          valA = (a[telefonesSortField] || "") as string;
          valB = (b[telefonesSortField] || "") as string;
        }
        
        const comparison = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' });
        return telefonesSortDirection === "asc" ? comparison : -comparison;
      });
    }
    
    return result;
  }, [telefones, telefonesSearchQuery, filterSetor, filterPlano, filterStatus, telefonesSortField, telefonesSortDirection]);

  const telefonesStats = useMemo(() => {
    if (!telefones) return { total: 0, ativos: 0, cancelados: 0, posTotal: 0, preTotal: 0 };
    
    return {
      total: telefones.length,
      ativos: telefones.filter(t => t.status === "Ativo").length,
      cancelados: telefones.filter(t => t.status === "Cancelado").length,
      posTotal: telefones.filter(t => t.planoOperadora?.includes("PÓS")).length,
      preTotal: telefones.filter(t => t.planoOperadora?.includes("PRÉ")).length,
    };
  }, [telefones]);

  const getPlanoColor = (plano: string | null) => {
    if (!plano) return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    const planoUpper = plano.toUpperCase();
    if (planoUpper.includes("PÓS")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    }
    if (planoUpper.includes("PRÉ")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    }
    if (planoUpper.includes("FLEX")) {
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  };

  const getStatusColor = (status: string | null) => {
    if (status === "Ativo") {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    }
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const clearTelefonesFilters = () => {
    setTelefonesSearchQuery("");
    setFilterSetor("todos");
    setFilterPlano("todos");
    setFilterStatus("todos");
  };

  const hasTelefonesActiveFilters = filterSetor !== "todos" || filterPlano !== "todos" || filterStatus !== "todos" || telefonesSearchQuery !== "";

  const handleTelefoneSort = (field: TelefonesSortField) => {
    if (telefonesSortField === field) {
      setTelefonesSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setTelefonesSortField(field);
      setTelefonesSortDirection("asc");
    }
  };

  const getTelefoneSortIcon = (field: TelefonesSortField) => {
    if (telefonesSortField !== field) return null;
    return telefonesSortDirection === "asc" 
      ? <ChevronUp className="w-4 h-4 ml-1" />
      : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  const updateTelefoneMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<Telefone> }) => {
      return await apiRequest("PATCH", `/api/telefones/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telefones"] });
      setIsEditDialogOpen(false);
      setEditingTelefone(null);
      toast({
        title: "Sucesso",
        description: "Linha telefônica atualizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a linha telefônica.",
        variant: "destructive",
      });
    },
  });

  const handleEditTelefone = (telefone: Telefone) => {
    setEditingTelefone({ ...telefone });
    setIsEditDialogOpen(true);
  };

  const handleSaveEditTelefone = () => {
    if (!editingTelefone) return;
    updateTelefoneMutation.mutate({
      id: editingTelefone.id,
      updates: {
        conta: editingTelefone.conta,
        planoOperadora: editingTelefone.planoOperadora,
        telefone: editingTelefone.telefone,
        responsavelNome: editingTelefone.responsavelNome,
        setor: editingTelefone.setor,
        ultimaRecarga: editingTelefone.ultimaRecarga,
        status: editingTelefone.status,
      },
    });
  };

  const hasActiveFilters = filterTipoBem !== "todos" || filterEstado !== "todos" || filterMarca !== "todos" || filterResponsavel !== "todos" || searchQuery !== "";

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="error-patrimonio">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
            <CardDescription>Não foi possível carregar os dados do patrimônio.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2" data-testid="tabs-patrimonio">
              <TabsTrigger value="patrimonios" className="gap-2" data-testid="tab-patrimonios">
                <Package className="w-4 h-4" />
                Patrimônios
              </TabsTrigger>
              <TabsTrigger value="telefones" className="gap-2" data-testid="tab-telefones">
                <Phone className="w-4 h-4" />
                Linhas Telefônicas
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="patrimonios" className="space-y-6 mt-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card data-testid="card-total-ativos">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      Total de Ativos
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Total de itens cadastrados no patrimônio</p>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <p className="text-2xl font-bold">{stats.totalAtivos}</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-ativos-bom">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ativos em Bom Estado</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.ativosBom}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.computadoresNotebooksBom} notebooks
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-atribuidos">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      Computadores Atribuídos
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Itens com responsável definido</p>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.computadoresNotebooksAtribuidos}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      de {stats.computadoresNotebooksBom} disponíveis
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-valor-pago">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Pago Total</p>
                    <p className="text-xl font-bold">{formatCurrencyNumber(stats.valorPago)}</p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-valor-mercado">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor de Mercado</p>
                    <p className="text-xl font-bold">{formatCurrencyNumber(stats.valorMercado)}</p>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-4">
              <div className="space-y-1">
                <CardTitle>Listagem de Patrimônio</CardTitle>
                <CardDescription>
                  Total de {filteredAndSortedPatrimonios.length} {filteredAndSortedPatrimonios.length === 1 ? "item" : "itens"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter Button Row */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[250px] relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar por número, bem, marca, responsável ou modelo..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                    data-testid="input-search-patrimonio"
                  />
                </div>
                
                <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant={hasActiveFilters ? "default" : "outline"} 
                      className="gap-2"
                      data-testid="button-toggle-filters"
                    >
                      <Filter className="w-4 h-4" />
                      Filtros
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {[filterTipoBem !== "todos", filterEstado !== "todos", filterMarca !== "todos", filterResponsavel !== "todos"].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="gap-1 text-muted-foreground"
                    data-testid="button-clear-filters"
                  >
                    <X className="w-4 h-4" />
                    Limpar Filtros
                  </Button>
                )}
              </div>

              {/* Collapsible Filters */}
              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <CollapsibleContent>
                  <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg border">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Tipo de Bem</label>
                      <Select
                        value={filterTipoBem}
                        onValueChange={(value) => {
                          setFilterTipoBem(value);
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[180px]" data-testid="select-filter-tipo-bem">
                          <SelectValue placeholder="Tipo de Bem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          {uniqueTiposBem.map(tipo => (
                            <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Estado</label>
                      <Select
                        value={filterEstado}
                        onValueChange={(value) => {
                          setFilterEstado(value);
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[180px]" data-testid="select-filter-estado">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          {uniqueEstados.map(estado => (
                            <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Marca</label>
                      <Select
                        value={filterMarca}
                        onValueChange={(value) => {
                          setFilterMarca(value);
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[180px]" data-testid="select-filter-marca">
                          <SelectValue placeholder="Marca" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todas</SelectItem>
                          {uniqueMarcas.map(marca => (
                            <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Responsável</label>
                      <Select
                        value={filterResponsavel}
                        onValueChange={(value) => {
                          setFilterResponsavel(value);
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[180px]" data-testid="select-filter-responsavel">
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="sem_responsavel">Sem responsável</SelectItem>
                          {uniqueResponsaveis.map(resp => (
                            <SelectItem key={resp} value={resp}>{resp}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {isLoading ? (
                <div className="flex items-center justify-center py-12" data-testid="loading-patrimonio">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="max-h-[calc(100vh-500px)] overflow-y-auto overflow-x-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-20 shadow-sm">
                          <TableRow className="bg-muted/50 border-b">
                            <TableHead 
                              className="min-w-[120px] cursor-pointer select-none hover:bg-muted/70 transition-colors"
                              onClick={() => handleSort("numeroAtivo")}
                              data-testid="header-numero"
                            >
                              <div className="flex items-center">
                                Num. Patrimônio
                                {getSortIcon("numeroAtivo")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="min-w-[200px] cursor-pointer select-none hover:bg-muted/70 transition-colors"
                              onClick={() => handleSort("ativo")}
                              data-testid="header-bem"
                            >
                              <div className="flex items-center">
                                Qual é o Bem
                                {getSortIcon("ativo")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="min-w-[150px] cursor-pointer select-none hover:bg-muted/70 transition-colors"
                              onClick={() => handleSort("marca")}
                              data-testid="header-marca"
                            >
                              <div className="flex items-center">
                                Marca
                                {getSortIcon("marca")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="min-w-[180px] cursor-pointer select-none hover:bg-muted/70 transition-colors"
                              onClick={() => handleSort("descricao")}
                              data-testid="header-modelo"
                            >
                              <div className="flex items-center">
                                Modelo
                                {getSortIcon("descricao")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="min-w-[140px] cursor-pointer select-none hover:bg-muted/70 transition-colors"
                              onClick={() => handleSort("estadoConservacao")}
                              data-testid="header-estado"
                            >
                              <div className="flex items-center">
                                Estado
                                {getSortIcon("estadoConservacao")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="min-w-[180px] cursor-pointer select-none hover:bg-muted/70 transition-colors"
                              onClick={() => handleSort("responsavelAtual")}
                              data-testid="header-responsavel"
                            >
                              <div className="flex items-center">
                                Responsável
                                {getSortIcon("responsavelAtual")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="min-w-[140px] cursor-pointer select-none hover:bg-muted/70 transition-colors"
                              onClick={() => handleSort("valorPago")}
                              data-testid="header-valor-pago"
                            >
                              <div className="flex items-center">
                                Valor Pago
                                {getSortIcon("valorPago")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="min-w-[140px] cursor-pointer select-none hover:bg-muted/70 transition-colors"
                              onClick={() => handleSort("valorMercado")}
                              data-testid="header-valor-mercado"
                            >
                              <div className="flex items-center">
                                Valor Mercado
                                {getSortIcon("valorMercado")}
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedPatrimonios.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                Nenhum patrimônio encontrado.
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedPatrimonios.map((item) => (
                              <TableRow 
                                key={item.id} 
                                className="hover:bg-muted/30 cursor-pointer transition-colors"
                                onClick={() => setLocation(`/patrimonio/${item.id}`)}
                                data-testid={`patrimonio-row-${item.id}`}
                              >
                                <TableCell className="font-medium" data-testid={`numero-${item.id}`}>
                                  {item.numeroAtivo || "-"}
                                </TableCell>
                                <TableCell data-testid={`bem-${item.id}`}>
                                  {item.ativo || "-"}
                                </TableCell>
                                <TableCell data-testid={`marca-${item.id}`}>
                                  {item.marca || "-"}
                                </TableCell>
                                <TableCell data-testid={`modelo-${item.id}`}>
                                  <span className="text-sm text-muted-foreground">
                                    {item.descricao || "-"}
                                  </span>
                                </TableCell>
                                <TableCell data-testid={`estado-${item.id}`}>
                                  {item.estadoConservacao ? (
                                    <Badge 
                                      variant="outline" 
                                      className={getEstadoColor(item.estadoConservacao)}
                                    >
                                      {item.estadoConservacao}
                                    </Badge>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell data-testid={`responsavel-${item.id}`}>
                                  {item.responsavelAtual && item.responsavelId ? (
                                    <Link 
                                      href={`/colaboradores/${item.responsavelId}`}
                                      className="text-primary hover:underline cursor-pointer"
                                      data-testid={`link-responsavel-${item.id}`}
                                    >
                                      {item.responsavelAtual}
                                    </Link>
                                  ) : (
                                    item.responsavelAtual || "-"
                                  )}
                                </TableCell>
                                <TableCell className="font-semibold" data-testid={`valor-pago-${item.id}`}>
                                  {formatCurrency(item.valorPago)}
                                </TableCell>
                                <TableCell className="font-semibold" data-testid={`valor-mercado-${item.id}`}>
                                  {formatCurrency(item.valorMercado)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
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
                </>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="telefones" className="space-y-6 mt-6">
              {/* Telefones Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-total-telefones">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Linhas</p>
                        <p className="text-2xl font-bold">{telefonesStats.total}</p>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Phone className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-linhas-ativas">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Linhas Ativas</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{telefonesStats.ativos}</p>
                      </div>
                      <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-linhas-pos">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Planos Pós-Pago</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{telefonesStats.posTotal}</p>
                      </div>
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-linhas-pre">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Planos Pré-Pago</p>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{telefonesStats.preTotal}</p>
                      </div>
                      <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                        <Phone className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Telefones Table Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-4">
                  <div className="space-y-1">
                    <CardTitle>Linhas Telefônicas</CardTitle>
                    <CardDescription>
                      Total de {filteredTelefones.length} {filteredTelefones.length === 1 ? "linha" : "linhas"}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search and Filters */}
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[250px] relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Buscar por telefone, responsável ou conta..."
                        value={telefonesSearchQuery}
                        onChange={(e) => setTelefonesSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-search-telefones"
                      />
                    </div>

                    <Select value={filterSetor} onValueChange={setFilterSetor}>
                      <SelectTrigger className="w-[180px]" data-testid="select-filter-setor">
                        <SelectValue placeholder="Setor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os setores</SelectItem>
                        {uniqueSetores.map(setor => (
                          <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterPlano} onValueChange={setFilterPlano}>
                      <SelectTrigger className="w-[180px]" data-testid="select-filter-plano">
                        <SelectValue placeholder="Plano" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os planos</SelectItem>
                        {uniquePlanos.map(plano => (
                          <SelectItem key={plano} value={plano}>{plano}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os status</SelectItem>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>

                    {hasTelefonesActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearTelefonesFilters}
                        className="gap-1 text-muted-foreground"
                        data-testid="button-clear-telefones-filters"
                      >
                        <X className="w-4 h-4" />
                        Limpar
                      </Button>
                    )}
                  </div>

                  {/* Table */}
                  {isLoadingTelefones ? (
                    <div className="flex items-center justify-center py-8" data-testid="loading-telefones">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleTelefoneSort("telefone")}
                              data-testid="th-telefone"
                            >
                              <div className="flex items-center">
                                Telefone
                                {getTelefoneSortIcon("telefone")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleTelefoneSort("responsavelNome")}
                              data-testid="th-responsavel"
                            >
                              <div className="flex items-center">
                                Responsável
                                {getTelefoneSortIcon("responsavelNome")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleTelefoneSort("status")}
                              data-testid="th-status"
                            >
                              <div className="flex items-center">
                                Status
                                {getTelefoneSortIcon("status")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleTelefoneSort("conta")}
                              data-testid="th-conta"
                            >
                              <div className="flex items-center">
                                Conta
                                {getTelefoneSortIcon("conta")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleTelefoneSort("planoOperadora")}
                              data-testid="th-plano"
                            >
                              <div className="flex items-center">
                                Plano/Operadora
                                {getTelefoneSortIcon("planoOperadora")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleTelefoneSort("setor")}
                              data-testid="th-setor"
                            >
                              <div className="flex items-center">
                                Setor
                                {getTelefoneSortIcon("setor")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => handleTelefoneSort("ultimaRecarga")}
                              data-testid="th-recarga"
                            >
                              <div className="flex items-center">
                                Última Recarga
                                {getTelefoneSortIcon("ultimaRecarga")}
                              </div>
                            </TableHead>
                            <TableHead className="w-[60px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTelefones.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                Nenhuma linha telefônica encontrada
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredTelefones.map((telefone) => (
                              <TableRow key={telefone.id} data-testid={`row-telefone-${telefone.id}`}>
                                <TableCell className="font-medium" data-testid={`text-telefone-${telefone.id}`}>
                                  {telefone.telefone}
                                </TableCell>
                                <TableCell data-testid={`text-responsavel-${telefone.id}`}>
                                  {telefone.responsavelId ? (
                                    <Link 
                                      href={`/colaboradores`}
                                      className="text-primary hover:underline"
                                      data-testid={`link-responsavel-${telefone.id}`}
                                    >
                                      {telefone.responsavelNome || "-"}
                                    </Link>
                                  ) : (
                                    telefone.responsavelNome || "-"
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge className={getStatusColor(telefone.status)} data-testid={`badge-status-${telefone.id}`}>
                                    {telefone.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-sm" data-testid={`text-conta-${telefone.id}`}>
                                  {telefone.conta || "-"}
                                </TableCell>
                                <TableCell>
                                  {telefone.planoOperadora ? (
                                    <Badge className={getPlanoColor(telefone.planoOperadora)} data-testid={`badge-plano-${telefone.id}`}>
                                      {telefone.planoOperadora}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell data-testid={`text-setor-${telefone.id}`}>
                                  {telefone.setor}
                                </TableCell>
                                <TableCell data-testid={`text-recarga-${telefone.id}`}>
                                  {formatDate(telefone.ultimaRecarga)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditTelefone(telefone)}
                                    data-testid={`button-edit-telefone-${telefone.id}`}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Linha Telefônica</DialogTitle>
            <DialogDescription>
              Atualize as informações da linha telefônica abaixo.
            </DialogDescription>
          </DialogHeader>
          {editingTelefone && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-conta" className="text-right">
                  Conta
                </Label>
                <Input
                  id="edit-conta"
                  value={editingTelefone.conta || ""}
                  onChange={(e) => setEditingTelefone({ ...editingTelefone, conta: e.target.value })}
                  className="col-span-3"
                  data-testid="input-edit-conta"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-plano" className="text-right">
                  Plano/Operadora
                </Label>
                <Input
                  id="edit-plano"
                  value={editingTelefone.planoOperadora || ""}
                  onChange={(e) => setEditingTelefone({ ...editingTelefone, planoOperadora: e.target.value })}
                  className="col-span-3"
                  data-testid="input-edit-plano"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-telefone" className="text-right">
                  Telefone
                </Label>
                <Input
                  id="edit-telefone"
                  value={editingTelefone.telefone || ""}
                  onChange={(e) => setEditingTelefone({ ...editingTelefone, telefone: e.target.value })}
                  className="col-span-3"
                  data-testid="input-edit-telefone"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-responsavel" className="text-right">
                  Responsável
                </Label>
                <Popover open={responsavelOpen} onOpenChange={setResponsavelOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={responsavelOpen}
                      className="col-span-3 justify-between"
                      data-testid="combobox-edit-responsavel"
                    >
                      {editingTelefone.responsavelNome || "Selecione um colaborador..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar colaborador..." data-testid="input-search-responsavel" />
                      <CommandList>
                        <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value=""
                            onSelect={() => {
                              setEditingTelefone({ ...editingTelefone, responsavelId: null, responsavelNome: null });
                              setResponsavelOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", !editingTelefone.responsavelId ? "opacity-100" : "opacity-0")} />
                            Nenhum
                          </CommandItem>
                          {colaboradoresDropdown?.map((col) => (
                            <CommandItem
                              key={col.id}
                              value={col.nome}
                              onSelect={() => {
                                setEditingTelefone({ ...editingTelefone, responsavelId: col.id, responsavelNome: col.nome });
                                setResponsavelOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", editingTelefone.responsavelId === col.id ? "opacity-100" : "opacity-0")} />
                              {col.nome}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-setor" className="text-right">
                  Setor
                </Label>
                <Select
                  value={editingTelefone.setor || ""}
                  onValueChange={(value) => setEditingTelefone({ ...editingTelefone, setor: value })}
                >
                  <SelectTrigger className="col-span-3" data-testid="select-edit-setor">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tech">Tech</SelectItem>
                    <SelectItem value="Growth Interno">Growth Interno</SelectItem>
                    <SelectItem value="Commerce">Commerce</SelectItem>
                    <SelectItem value="CX">CX</SelectItem>
                    <SelectItem value="Financeiro">Financeiro</SelectItem>
                    <SelectItem value="RH">RH</SelectItem>
                    <SelectItem value="Jurídico">Jurídico</SelectItem>
                    <SelectItem value="Administrativo">Administrativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-recarga" className="text-right">
                  Última Recarga
                </Label>
                <Input
                  id="edit-recarga"
                  type="date"
                  value={editingTelefone.ultimaRecarga || ""}
                  onChange={(e) => setEditingTelefone({ ...editingTelefone, ultimaRecarga: e.target.value })}
                  className="col-span-3"
                  data-testid="input-edit-recarga"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">
                  Status
                </Label>
                <Select
                  value={editingTelefone.status || ""}
                  onValueChange={(value) => setEditingTelefone({ ...editingTelefone, status: value })}
                >
                  <SelectTrigger className="col-span-3" data-testid="select-edit-status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEditTelefone}
              disabled={updateTelefoneMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateTelefoneMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
