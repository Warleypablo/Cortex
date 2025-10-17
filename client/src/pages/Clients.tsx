import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import ClientsTable, { type Client } from "@/components/ClientsTable";
import FilterPanel from "@/components/FilterPanel";
import SearchBar from "@/components/SearchBar";
import StatsCard from "@/components/StatsCard";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

//todo: remove mock functionality
const mockClients: Client[] = [
  {
    id: "1",
    name: "Ensinando Tecnologia e Intermediação Ltda",
    cnpj: "33.406.825/0001-60",
    squad: "Performance",
    services: ["Performance", "Comunicação", "Tech"],
    ltv: 43400,
    status: "active",
    startDate: "2024-06-04"
  },
  {
    id: "2",
    name: "Tech Solutions Brasil",
    cnpj: "12.345.678/0001-90",
    squad: "Tech",
    services: ["Tech", "Performance"],
    ltv: 65000,
    status: "active",
    startDate: "2024-03-15"
  },
  {
    id: "3",
    name: "Marketing Pro Agency",
    cnpj: "98.765.432/0001-10",
    squad: "Comunicação",
    services: ["Comunicação"],
    ltv: 28500,
    status: "active",
    startDate: "2024-08-20"
  },
  {
    id: "4",
    name: "Digital Innovations Corp",
    cnpj: "45.678.901/0001-23",
    squad: "Performance",
    services: ["Performance", "Tech"],
    ltv: 52000,
    status: "active",
    startDate: "2024-01-10"
  },
  {
    id: "5",
    name: "Creative Media Group",
    cnpj: "78.901.234/0001-45",
    squad: "Comunicação",
    services: ["Comunicação", "Performance"],
    ltv: 38900,
    status: "active",
    startDate: "2024-05-22"
  },
  {
    id: "6",
    name: "Smart Tech Systems",
    cnpj: "23.456.789/0001-67",
    squad: "Tech",
    services: ["Tech"],
    ltv: 71200,
    status: "inactive",
    startDate: "2023-11-05"
  }
];

export default function Clients() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSquads, setSelectedSquads] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handleSquadChange = (squad: string, checked: boolean) => {
    if (checked) {
      setSelectedSquads([...selectedSquads, squad]);
    } else {
      setSelectedSquads(selectedSquads.filter(s => s !== squad));
    }
  };

  const handleServiceChange = (service: string, checked: boolean) => {
    if (checked) {
      setSelectedServices([...selectedServices, service]);
    } else {
      setSelectedServices(selectedServices.filter(s => s !== service));
    }
  };

  const handleClearFilters = () => {
    setSelectedSquads([]);
    setSelectedServices([]);
    setSearchQuery("");
  };

  const filteredClients = useMemo(() => {
    return mockClients.filter(client => {
      const matchesSearch = 
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.cnpj && client.cnpj.includes(searchQuery.replace(/\D/g, '')));
      
      const matchesSquad = selectedSquads.length === 0 || selectedSquads.includes(client.squad);
      const matchesService = selectedServices.length === 0 || 
        selectedServices.some(service => client.services.includes(service as any));
      
      return matchesSearch && matchesSquad && matchesService;
    });
  }, [searchQuery, selectedSquads, selectedServices]);

  //todo: remove mock functionality
  const stats = useMemo(() => {
    const activeClients = filteredClients.filter(c => c.status === "active");
    const totalLTV = activeClients.reduce((sum, c) => sum + c.ltv, 0);
    const avgTicket = activeClients.length > 0 ? totalLTV / activeClients.length : 0;

    return {
      totalClients: activeClients.length,
      totalLTV,
      avgTicket
    };
  }, [filteredClients]);

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Clientes</h1>
          <p className="text-muted-foreground">Gerencie seus clientes e visualize informações contratuais</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Total de Clientes"
            value={stats.totalClients.toString()}
            icon={Users}
            trend={{ value: "8% vs mês anterior", isPositive: true }}
          />
          <StatsCard
            title="LTV Total"
            value={new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(stats.totalLTV)}
            icon={DollarSign}
            trend={{ value: "12% vs mês anterior", isPositive: true }}
          />
          <StatsCard
            title="Ticket Médio"
            value={new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(stats.avgTicket)}
            icon={TrendingUp}
            trend={{ value: "5% vs mês anterior", isPositive: true }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <FilterPanel
              selectedSquads={selectedSquads}
              selectedServices={selectedServices}
              onSquadChange={handleSquadChange}
              onServiceChange={handleServiceChange}
              onClearFilters={handleClearFilters}
            />
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Buscar por nome ou CNPJ..."
                />
              </div>
              <Button variant="default" data-testid="button-add-client">
                + Novo Cliente
              </Button>
            </div>

            <ClientsTable
              clients={filteredClients}
              onClientClick={(id) => setLocation(`/cliente/${id}`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}