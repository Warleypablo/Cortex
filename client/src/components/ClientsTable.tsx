import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Client {
  id: string;
  name: string;
  cnpj?: string;
  squad: "Performance" | "Comunicação" | "Tech";
  services: Array<"Performance" | "Comunicação" | "Tech">;
  ltv: number;
  status: "active" | "inactive";
  startDate: string;
}

interface ClientsTableProps {
  clients: Client[];
  onClientClick: (clientId: string) => void;
}

type SortField = "name" | "squad" | "startDate" | "ltv";
type SortDirection = "asc" | "desc";

export default function ClientsTable({ clients, onClientClick }: ClientsTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedClients = [...clients].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === "name") {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === "squad") {
      comparison = a.squad.localeCompare(b.squad);
    } else if (sortField === "startDate") {
      comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    } else if (sortField === "ltv") {
      comparison = a.ltv - b.ltv;
    }
    
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const getServiceEmoji = (service: string) => {
    switch (service) {
      case "Performance":
        return "📊";
      case "Comunicação":
        return "💬";
      case "Tech":
        return "💻";
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
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[300px]">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort("name")}
                className="hover-elevate -ml-3"
                data-testid="sort-name"
              >
                Nome do Cliente
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
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
            <TableHead>Serviços</TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort("ltv")}
                className="hover-elevate -ml-3"
                data-testid="sort-ltv"
              >
                LTV
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort("startDate")}
                className="hover-elevate -ml-3"
                data-testid="sort-date"
              >
                Data Início
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedClients.map((client) => (
            <TableRow 
              key={client.id} 
              className="cursor-pointer hover-elevate"
              onClick={() => onClientClick(client.id)}
              data-testid={`client-row-${client.id}`}
            >
              <TableCell className="font-medium">{client.name}</TableCell>
              <TableCell>
                <Badge className={`${getSquadColor(client.squad)}`} variant="outline">
                  {client.squad}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {client.services.map((service, idx) => (
                    <span key={idx} className="text-lg" title={service}>
                      {getServiceEmoji(service)}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell className="font-semibold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.ltv)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(client.startDate).toLocaleDateString('pt-BR')}
              </TableCell>
              <TableCell>
                <Badge variant={client.status === "active" ? "default" : "secondary"}>
                  {client.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}