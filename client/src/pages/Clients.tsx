import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ClientsTable, { type Client } from "@/components/ClientsTable";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClienteDb {
  id: number;
  nome: string | null;
  cnpj: string | null;
  endereco: string | null;
  ativo: string | null;
  createdAt: string | null;
  empresa: string | null;
  ids: string | null;
  nomeClickup: string | null;
  statusClickup: string | null;
  telefone: string | null;
  responsavel: string | null;
  cluster: string | null;
  ltv: string | null;
}

function transformCliente(cliente: ClienteDb): Client {
  return {
    id: cliente.ids || cliente.id.toString(),
    name: cliente.nomeClickup || cliente.nome || "Cliente sem nome",
    cnpj: cliente.cnpj || undefined,
    squad: "Forja",
    services: ["Forja"],
    ltv: parseFloat(cliente.ltv || "0"),
    status: cliente.ativo === "SIM" ? "active" : "inactive",
    startDate: cliente.createdAt || new Date().toISOString(),
  };
}

export default function Clients() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { data: clientes, isLoading, error } = useQuery<ClienteDb[]>({
    queryKey: ["/api/clientes"],
  });

  const transformedClients = useMemo(() => {
    if (!clientes) return [];
    return clientes.map(transformCliente);
  }, [clientes]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return transformedClients;
    
    const query = searchQuery.toLowerCase();
    return transformedClients.filter(client => 
      client.name.toLowerCase().includes(query) ||
      client.cnpj?.toLowerCase().includes(query)
    );
  }, [transformedClients, searchQuery]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClients = filteredClients.slice(startIndex, endIndex);

  // Reset to page 1 when search query or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

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
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie seus clientes e visualize informações contratuais
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
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
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Mostrando {startIndex + 1}-{Math.min(endIndex, filteredClients.length)} de {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}
            </div>
            <div className="flex items-center gap-2">
              <span>Itens por página:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => setItemsPerPage(Number(value))}
              >
                <SelectTrigger className="w-20" data-testid="select-items-per-page">
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

          <ClientsTable
            clients={paginatedClients}
            onClientClick={(id) => setLocation(`/cliente/${id}`)}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="button-previous-page"
              >
                Anterior
              </Button>
              <div className="text-sm text-muted-foreground px-4">
                Página {currentPage} de {totalPages}
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Próximo
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
