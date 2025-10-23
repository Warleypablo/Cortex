import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import avatar1 from '@assets/generated_images/Marketing_executive_avatar_male_fff2f919.png';
import avatar2 from '@assets/generated_images/Marketing_manager_avatar_female_d414a5e8.png';
import avatar3 from '@assets/generated_images/Tech_developer_avatar_male_029e9424.png';

//todo: remove mock functionality
interface Contract {
  id: string;
  service: string;
  clientName: string;
  clientId: string;
  status: "Ativo" | "Onboard" | "Triagem" | "Cancelamento" | "Cancelado";
  responsible: {
    name: string;
    avatar?: string;
  };
  squad: "Performance" | "Comunicação" | "Tech";
  createdDate: string;
  recurringValue: number;
  oneTimeValue: number;
}

const mockContracts: Contract[] = [
  {
    id: "1",
    service: "Growth Marketing Advisory",
    clientName: "Ensinando Tecnologia e Intermediação Ltda",
    clientId: "1",
    status: "Ativo",
    responsible: { name: "Murilo Carvalho", avatar: avatar1 },
    squad: "Performance",
    createdDate: "2024-06-04",
    recurringValue: 6200,
    oneTimeValue: 0
  },
  {
    id: "2",
    service: "Landing Page - Portugal",
    clientName: "Ensinando Tecnologia e Intermediação Ltda",
    clientId: "1",
    status: "Ativo",
    responsible: { name: "Ana Silva", avatar: avatar2 },
    squad: "Comunicação",
    createdDate: "2024-06-04",
    recurringValue: 5281,
    oneTimeValue: 0
  },
  {
    id: "3",
    service: "Consultoria Tech",
    clientName: "Tech Solutions Brasil",
    clientId: "2",
    status: "Onboard",
    responsible: { name: "Carlos Santos", avatar: avatar3 },
    squad: "Tech",
    createdDate: "2024-03-15",
    recurringValue: 8500,
    oneTimeValue: 15000
  },
  {
    id: "4",
    service: "Gestão de Mídias Sociais",
    clientName: "Marketing Pro Agency",
    clientId: "3",
    status: "Triagem",
    responsible: { name: "Ana Silva", avatar: avatar2 },
    squad: "Comunicação",
    createdDate: "2024-08-20",
    recurringValue: 4200,
    oneTimeValue: 0
  },
  {
    id: "5",
    service: "SEO e Performance",
    clientName: "Digital Innovations Corp",
    clientId: "4",
    status: "Ativo",
    responsible: { name: "Murilo Carvalho", avatar: avatar1 },
    squad: "Performance",
    createdDate: "2024-01-10",
    recurringValue: 7800,
    oneTimeValue: 5000
  }
];

type SortField = "service" | "clientName" | "status" | "squad" | "createdDate";
type SortDirection = "asc" | "desc";

export default function Contracts() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredContracts = useMemo(() => {
    return mockContracts.filter(contract => {
      const matchesSearch = 
        contract.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.clientName.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });
  }, [searchQuery]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ativo":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "Onboard":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "Triagem":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "Cancelamento":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      case "Cancelado":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "";
    }
  };

  const getSquadColor = (squad: string) => {
    switch (squad) {
      case "Performance":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "Comunicação":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "Tech":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";
      default:
        return "";
    }
  };

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Contratos</h1>
          <p className="text-muted-foreground">Gerencie contratos e acompanhe status de serviços</p>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar por serviço ou cliente..."
            />
          </div>
          <Button 
            variant="default" 
            data-testid="button-add-contract"
            onClick={() => window.open('https://contratos.turbopartners.com.br/index.php?page=contratos&action=new', '_blank')}
          >
            + Novo Contrato
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>
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
                <TableHead>
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
                <TableHead>
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
                <TableHead>Responsável</TableHead>
                <TableHead>
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
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("createdDate")}
                    className="hover-elevate -ml-3"
                    data-testid="sort-date"
                  >
                    Data Criação
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Valor R</TableHead>
                <TableHead className="text-right">Valor P</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedContracts.map((contract) => (
                <TableRow 
                  key={contract.id} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => setLocation(`/cliente/${contract.clientId}`)}
                  data-testid={`contract-row-${contract.id}`}
                >
                  <TableCell className="font-medium">{contract.service}</TableCell>
                  <TableCell>{contract.clientName}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(contract.status)} variant="outline">
                      {contract.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={contract.responsible.avatar} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {contract.responsible.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{contract.responsible.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getSquadColor(contract.squad)} variant="outline">
                      {contract.squad}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(contract.createdDate).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {contract.recurringValue > 0 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.recurringValue)
                      : '-'
                    }
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {contract.oneTimeValue > 0 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.oneTimeValue)
                      : '-'
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}