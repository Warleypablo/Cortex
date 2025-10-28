import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ClientsTable from "@/components/ClientsTable";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClienteCompleto } from "../../../server/storage";

export default function Clients() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [servicoFilter, setServicoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { data: clientes, isLoading, error } = useQuery<ClienteCompleto[]>({
    queryKey: ["/api/clientes"],
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

      return matchesSearch && matchesServico && matchesStatus;
    });
  }, [clientes, searchQuery, servicoFilter, statusFilter]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClients = filteredClients.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, servicoFilter, statusFilter, itemsPerPage]);

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
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
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
