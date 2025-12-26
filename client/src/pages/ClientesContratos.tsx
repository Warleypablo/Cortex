import { useState, useEffect, useMemo } from "react";
import { usePersistentFilters } from "@/hooks/use-persistent-filters";
import { usePageTitle } from "@/hooks/use-page-title";
import { Users, FileText, Search, Filter, X, Check, Save, Bookmark, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageInfo } from "@/contexts/PageContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useQuery } from "@tanstack/react-query";
import Clients from "./Clients";
import Contracts from "./Contracts";
import type { ClienteCompleto } from "../../../server/storage";
import type { ContratoCompleto } from "@shared/schema";

type Tab = "clientes" | "contratos";

type SavedFilter = {
  id: string;
  name: string;
  filters: {
    servicoFilter: string[];
    statusFilter: string[];
    tipoContratoFilter: string;
    responsavelFilter: string[];
    clusterFilter: string;
    ltOperator: string;
    ltValue: string;
    aovOperator: string;
    aovValue: string;
  };
};

type ContractSavedFilter = {
  id: string;
  name: string;
  filters: {
    servicoFilter: string[];
    statusFilter: string[];
    tipoContratoFilter: string;
    produtoFilter: string[];
  };
};

const SAVED_FILTERS_KEY = "turbo-cortex-client-filters";
const CONTRACT_SAVED_FILTERS_KEY = "turbo-cortex-contract-filters";

const TAB_TITLES: Record<Tab, { title: string; subtitle: string }> = {
  clientes: { title: "Clientes", subtitle: "Gestão de clientes ativos" },
  contratos: { title: "Contratos", subtitle: "Acompanhamento de contratos e serviços" },
};

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

export default function ClientesContratos() {
  usePageTitle("Clientes e Contratos");
  const { setPageInfo } = usePageInfo();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("clientes");
  
  const [searchQuery, setSearchQuery] = usePersistentFilters("clientes-search", "");
  const [servicoFilter, setServicoFilter] = usePersistentFilters<string[]>("clientes-servico", []);
  const [statusFilter, setStatusFilter] = usePersistentFilters<string[]>("clientes-status", []);
  const [tipoContratoFilter, setTipoContratoFilter] = usePersistentFilters("clientes-tipo-contrato", "ambos");
  const [responsavelFilter, setResponsavelFilter] = usePersistentFilters<string[]>("clientes-responsavel", []);
  const [clusterFilter, setClusterFilter] = usePersistentFilters("clientes-cluster", "all");
  const [ltOperator, setLtOperator] = usePersistentFilters("clientes-lt-operator", "all");
  const [ltValue, setLtValue] = usePersistentFilters("clientes-lt-value", "");
  const [aovOperator, setAovOperator] = usePersistentFilters("clientes-aov-operator", "all");
  const [aovValue, setAovValue] = usePersistentFilters("clientes-aov-value", "");
  
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      const stored = localStorage.getItem(SAVED_FILTERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [newFilterName, setNewFilterName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const [contractSearchQuery, setContractSearchQuery] = usePersistentFilters("contratos-search", "");
  const [contractServicoFilter, setContractServicoFilter] = usePersistentFilters<string[]>("contratos-servico", []);
  const [contractStatusFilter, setContractStatusFilter] = usePersistentFilters<string[]>("contratos-status", []);
  const [contractTipoContratoFilter, setContractTipoContratoFilter] = usePersistentFilters("contratos-tipo-contrato", "ambos");
  const [contractProdutoFilter, setContractProdutoFilter] = usePersistentFilters<string[]>("contratos-produto", []);
  
  const [contractSavedFilters, setContractSavedFilters] = useState<ContractSavedFilter[]>(() => {
    try {
      const stored = localStorage.getItem(CONTRACT_SAVED_FILTERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [contractNewFilterName, setContractNewFilterName] = useState("");
  const [contractShowSaveInput, setContractShowSaveInput] = useState(false);

  const { data: clientes } = useQuery<ClienteCompleto[]>({
    queryKey: ["/api/clientes"],
  });

  const { data: contratos } = useQuery<ContratoCompleto[]>({
    queryKey: ["/api/contratos"],
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

  const contractServicosUnicos = useMemo(() => {
    if (!contratos) return [];
    const servicosSet = new Set<string>();
    contratos.forEach(contract => {
      const produto = contract.produto || contract.servico;
      if (produto && produto.trim()) {
        servicosSet.add(produto.trim());
      }
    });
    return Array.from(servicosSet).sort();
  }, [contratos]);

  const contractStatusUnicos = useMemo(() => {
    if (!contratos) return [];
    const statusSet = new Set<string>();
    contratos.forEach(contract => {
      if (contract.status && contract.status !== "Desconhecido") {
        statusSet.add(contract.status);
      }
    });
    return Array.from(statusSet).sort();
  }, [contratos]);

  const contractProdutosUnicos = useMemo(() => {
    if (!contratos) return [];
    const produtosSet = new Set<string>();
    contratos.forEach(contract => {
      if (contract.produto && contract.produto.trim()) {
        produtosSet.add(contract.produto.trim());
      }
    });
    return Array.from(produtosSet).sort();
  }, [contratos]);

  const saveCurrentFilter = () => {
    if (!newFilterName.trim()) return;
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: newFilterName.trim(),
      filters: { servicoFilter, statusFilter, tipoContratoFilter, responsavelFilter, clusterFilter, ltOperator, ltValue, aovOperator, aovValue }
    };
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
    setNewFilterName("");
    setShowSaveInput(false);
    toast({ title: "Filtro salvo com sucesso" });
  };

  const loadSavedFilter = (filter: SavedFilter) => {
    setServicoFilter(filter.filters.servicoFilter);
    setStatusFilter(filter.filters.statusFilter);
    setTipoContratoFilter(filter.filters.tipoContratoFilter);
    setResponsavelFilter(filter.filters.responsavelFilter);
    setClusterFilter(filter.filters.clusterFilter);
    setLtOperator(filter.filters.ltOperator);
    setLtValue(filter.filters.ltValue);
    setAovOperator(filter.filters.aovOperator);
    setAovValue(filter.filters.aovValue);
  };

  const deleteSavedFilter = (id: string) => {
    const updated = savedFilters.filter(f => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
    toast({ title: "Filtro removido" });
  };

  const saveContractFilter = () => {
    if (!contractNewFilterName.trim()) return;
    const newFilter: ContractSavedFilter = {
      id: Date.now().toString(),
      name: contractNewFilterName.trim(),
      filters: { 
        servicoFilter: contractServicoFilter, 
        statusFilter: contractStatusFilter, 
        tipoContratoFilter: contractTipoContratoFilter,
        produtoFilter: contractProdutoFilter
      }
    };
    const updated = [...contractSavedFilters, newFilter];
    setContractSavedFilters(updated);
    localStorage.setItem(CONTRACT_SAVED_FILTERS_KEY, JSON.stringify(updated));
    setContractNewFilterName("");
    setContractShowSaveInput(false);
    toast({ title: "Filtro salvo com sucesso" });
  };

  const loadContractSavedFilter = (filter: ContractSavedFilter) => {
    setContractServicoFilter(filter.filters.servicoFilter);
    setContractStatusFilter(filter.filters.statusFilter);
    setContractTipoContratoFilter(filter.filters.tipoContratoFilter);
    setContractProdutoFilter(filter.filters.produtoFilter || []);
  };

  const deleteContractSavedFilter = (id: string) => {
    const updated = contractSavedFilters.filter(f => f.id !== id);
    setContractSavedFilters(updated);
    localStorage.setItem(CONTRACT_SAVED_FILTERS_KEY, JSON.stringify(updated));
    toast({ title: "Filtro removido" });
  };

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

  const hasContractActiveFilters = contractTipoContratoFilter !== "ambos" || contractServicoFilter.length > 0 || contractStatusFilter.length > 0 || contractProdutoFilter.length > 0;

  const contractActiveFilterCount = [
    contractTipoContratoFilter !== "ambos",
    contractServicoFilter.length > 0,
    contractStatusFilter.length > 0,
    contractProdutoFilter.length > 0,
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
    toast({ title: "Filtros limpos" });
  };

  const clearAllContractFilters = () => {
    setContractTipoContratoFilter("ambos");
    setContractServicoFilter([]);
    setContractStatusFilter([]);
    setContractProdutoFilter([]);
    toast({ title: "Filtros limpos" });
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

  const toggleContractServicoFilter = (servico: string) => {
    setContractServicoFilter(prev => 
      prev.includes(servico) 
        ? prev.filter(s => s !== servico)
        : [...prev, servico]
    );
  };

  const toggleContractStatusFilter = (status: string) => {
    setContractStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleContractProdutoFilter = (produto: string) => {
    setContractProdutoFilter(prev => 
      prev.includes(produto) 
        ? prev.filter(p => p !== produto)
        : [...prev, produto]
    );
  };
  
  useEffect(() => {
    const { title, subtitle } = TAB_TITLES[activeTab];
    setPageInfo(title, subtitle);
  }, [activeTab, setPageInfo]);

  const tabs = [
    { id: "clientes" as Tab, label: "Clientes", icon: Users },
    { id: "contratos" as Tab, label: "Contratos", icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-2 bg-card/50 border-b border-border mx-4 mt-4 rounded-lg">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={`gap-2 ${isActive ? "bg-muted" : ""}`}
                data-testid={`tab-${tab.id}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {activeTab === "clientes" && (
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome ou CNPJ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
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
                  <div className="flex items-center gap-1">
                    {hasActiveFilters && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={clearAllFilters}
                        data-testid="button-clear-filters"
                      >
                        Limpar
                      </Button>
                    )}
                    {hasActiveFilters && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => setShowSaveInput(!showSaveInput)}
                        data-testid="button-save-filter"
                        aria-label="Salvar filtro"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-4 p-4">
                    {showSaveInput && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <Input
                          placeholder="Nome do filtro..."
                          value={newFilterName}
                          onChange={(e) => setNewFilterName(e.target.value)}
                          className="h-8 text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && saveCurrentFilter()}
                          data-testid="input-filter-name"
                        />
                        <Button size="sm" className="h-8" onClick={saveCurrentFilter} data-testid="button-confirm-save-filter" aria-label="Confirmar salvar filtro">
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowSaveInput(false)} aria-label="Cancelar salvar filtro">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    
                    {savedFilters.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Bookmark className="w-3 h-3" />
                          Filtros Salvos
                        </Label>
                        <div className="border rounded-md divide-y">
                          {savedFilters.map(filter => (
                            <div 
                              key={filter.id} 
                              className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 group"
                            >
                              <button
                                className="text-sm text-left flex-1 truncate"
                                onClick={() => loadSavedFilter(filter)}
                                data-testid={`button-load-filter-${filter.id}`}
                              >
                                {filter.name}
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => deleteSavedFilter(filter.id)}
                                data-testid={`button-delete-filter-${filter.id}`}
                                aria-label={`Deletar filtro ${filter.name}`}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
        )}

        {activeTab === "contratos" && (
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por serviço ou cliente..."
                value={contractSearchQuery}
                onChange={(e) => setContractSearchQuery(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search-contracts"
              />
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="default" className="gap-2" data-testid="button-filter-contracts">
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filtros</span>
                  {hasContractActiveFilters && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                      {contractActiveFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0 overflow-hidden" align="end">
                <div className="flex items-center justify-between p-4 pb-2 border-b">
                  <h4 className="font-medium text-sm">Filtros</h4>
                  <div className="flex items-center gap-1">
                    {hasContractActiveFilters && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={clearAllContractFilters}
                        data-testid="button-clear-contract-filters"
                      >
                        Limpar
                      </Button>
                    )}
                    {hasContractActiveFilters && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => setContractShowSaveInput(!contractShowSaveInput)}
                        data-testid="button-save-contract-filter"
                        aria-label="Salvar filtro"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-4 p-4">
                    {contractShowSaveInput && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <Input
                          placeholder="Nome do filtro..."
                          value={contractNewFilterName}
                          onChange={(e) => setContractNewFilterName(e.target.value)}
                          className="h-8 text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && saveContractFilter()}
                          data-testid="input-contract-filter-name"
                        />
                        <Button size="sm" className="h-8" onClick={saveContractFilter} data-testid="button-confirm-save-contract-filter" aria-label="Confirmar salvar filtro">
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setContractShowSaveInput(false)} aria-label="Cancelar salvar filtro">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    
                    {contractSavedFilters.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Bookmark className="w-3 h-3" />
                          Filtros Salvos
                        </Label>
                        <div className="border rounded-md divide-y">
                          {contractSavedFilters.map(filter => (
                            <div 
                              key={filter.id} 
                              className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 group"
                            >
                              <button
                                className="text-sm text-left flex-1 truncate"
                                onClick={() => loadContractSavedFilter(filter)}
                                data-testid={`button-load-contract-filter-${filter.id}`}
                              >
                                {filter.name}
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => deleteContractSavedFilter(filter.id)}
                                data-testid={`button-delete-contract-filter-${filter.id}`}
                                aria-label={`Deletar filtro ${filter.name}`}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Tipo de Contrato</Label>
                      <Select
                        value={contractTipoContratoFilter}
                        onValueChange={setContractTipoContratoFilter}
                      >
                        <SelectTrigger className="w-full" data-testid="select-contract-filter-tipo">
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
                        {contractStatusFilter.length > 0 && (
                          <Badge variant="secondary" className="text-xs">{contractStatusFilter.length}</Badge>
                        )}
                      </div>
                      <div className="border rounded-md max-h-32 overflow-y-auto overflow-x-hidden">
                        {contractStatusUnicos.map(status => (
                          <label
                            key={status}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 min-w-0"
                            data-testid={`checkbox-contract-status-${status}`}
                          >
                            <Checkbox 
                              checked={contractStatusFilter.includes(status)} 
                              onCheckedChange={() => toggleContractStatusFilter(status)}
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
                        {contractServicoFilter.length > 0 && (
                          <Badge variant="secondary" className="text-xs">{contractServicoFilter.length}</Badge>
                        )}
                      </div>
                      <div className="border rounded-md max-h-32 overflow-y-auto overflow-x-hidden">
                        {contractServicosUnicos.map(servico => (
                          <label
                            key={servico}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 min-w-0"
                            data-testid={`checkbox-contract-servico-${servico}`}
                          >
                            <Checkbox 
                              checked={contractServicoFilter.includes(servico)} 
                              onCheckedChange={() => toggleContractServicoFilter(servico)}
                              className="flex-shrink-0"
                            />
                            <span className="text-sm truncate flex-1 min-w-0">{servico}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Produto (múltipla seleção)</Label>
                        {contractProdutoFilter.length > 0 && (
                          <Badge variant="secondary" className="text-xs">{contractProdutoFilter.length}</Badge>
                        )}
                      </div>
                      <div className="border rounded-md max-h-32 overflow-y-auto overflow-x-hidden">
                        {contractProdutosUnicos.map(produto => (
                          <label
                            key={produto}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 min-w-0"
                            data-testid={`checkbox-contract-produto-${produto}`}
                          >
                            <Checkbox 
                              checked={contractProdutoFilter.includes(produto)} 
                              onCheckedChange={() => toggleContractProdutoFilter(produto)}
                              className="flex-shrink-0"
                            />
                            <span className="text-sm truncate flex-1 min-w-0">{produto}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            
            <Button 
              variant="default" 
              data-testid="button-add-contract"
              onClick={() => window.open('https://contratos.turbopartners.com.br/index.php?page=contratos&action=new', '_blank')}
            >
              <Plus className="w-4 h-4 mr-1" />
              Novo Contrato
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-auto">
        {activeTab === "clientes" && (
          <Clients
            searchQuery={searchQuery}
            servicoFilter={servicoFilter}
            statusFilter={statusFilter}
            tipoContratoFilter={tipoContratoFilter}
            responsavelFilter={responsavelFilter}
            clusterFilter={clusterFilter}
            ltOperator={ltOperator}
            ltValue={ltValue}
            aovOperator={aovOperator}
            aovValue={aovValue}
          />
        )}
        {activeTab === "contratos" && (
          <Contracts
            searchQuery={contractSearchQuery}
            servicoFilter={contractServicoFilter}
            statusFilter={contractStatusFilter}
            tipoContratoFilter={contractTipoContratoFilter}
            produtoFilter={contractProdutoFilter}
          />
        )}
      </div>
    </div>
  );
}
