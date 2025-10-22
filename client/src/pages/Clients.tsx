import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ClientsTable, { type Client } from "@/components/ClientsTable";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ClienteDb {
  id: number;
  nome: string | null;
  cnpj: string | null;
  endereco: string | null;
  ativo: string | null;
  createdAt: string | null;
  empresa: string | null;
  ids: string | null;
}

function transformCliente(cliente: ClienteDb): Client {
  return {
    id: cliente.ids || cliente.id.toString(),
    name: cliente.nome || "Cliente sem nome",
    cnpj: cliente.cnpj || undefined,
    squad: "Performance",
    services: ["Performance"],
    ltv: 0,
    status: cliente.ativo === "SIM" ? "active" : "inactive",
    startDate: cliente.createdAt || new Date().toISOString(),
  };
}

export default function Clients() {
  const [, setLocation] = useLocation();

  const { data: clientes, isLoading, error } = useQuery<ClienteDb[]>({
    queryKey: ["/api/clientes"],
  });

  const transformedClients = useMemo(() => {
    if (!clientes) return [];
    return clientes.map(transformCliente);
  }, [clientes]);

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
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {transformedClients.length} {transformedClients.length === 1 ? 'cliente' : 'clientes'} encontrados
            </div>
            <Button variant="default" data-testid="button-add-client">
              + Novo Cliente
            </Button>
          </div>

          <ClientsTable
            clients={transformedClients}
            onClientClick={(id) => setLocation(`/cliente/${id}`)}
          />
        </div>
      </div>
    </div>
  );
}
