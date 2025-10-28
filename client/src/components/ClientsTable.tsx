import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClienteCompleto } from "../../../server/storage";

interface ClientsTableProps {
  clients: ClienteCompleto[];
  onClientClick: (clientId: string) => void;
}

type SortField = "name" | "cnpj" | "status" | "startDate";
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
      const nameA = a.nomeClickup || a.nome || "";
      const nameB = b.nomeClickup || b.nome || "";
      comparison = nameA.localeCompare(nameB);
    } else if (sortField === "cnpj") {
      const cnpjA = a.cnpjCliente || a.cnpj || "";
      const cnpjB = b.cnpjCliente || b.cnpj || "";
      comparison = cnpjA.localeCompare(cnpjB);
    } else if (sortField === "status") {
      const statusA = a.statusClickup || "";
      const statusB = b.statusClickup || "";
      comparison = statusA.localeCompare(statusB);
    } else if (sortField === "startDate") {
      const dateA = a.dataInicio ? new Date(a.dataInicio).getTime() : 0;
      const dateB = b.dataInicio ? new Date(b.dataInicio).getTime() : 0;
      comparison = dateA - dateB;
    }
    
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const getStatusColor = (status: string | null) => {
    if (!status) return "bg-muted text-muted-foreground";
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes("ativo") || statusLower.includes("active")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    } else if (statusLower.includes("pausado") || statusLower.includes("paused")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    } else if (statusLower.includes("cancelado") || statusLower.includes("canceled")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    }
    return "bg-muted text-muted-foreground";
  };

  const formatCNPJ = (cnpj: string | null) => {
    if (!cnpj) return "-";
    const cleaned = cnpj.replace(/\D/g, "");
    if (cleaned.length === 14) {
      return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
    return cnpj;
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-20 shadow-sm">
            <TableRow className="bg-background border-b">
            <TableHead className="w-[300px] bg-background">
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
            <TableHead className="bg-background">Serviços</TableHead>
            <TableHead className="bg-background">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleSort("cnpj")}
                className="hover-elevate -ml-3"
                data-testid="sort-cnpj"
              >
                CNPJ
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
                onClick={() => handleSort("startDate")}
                className="hover-elevate -ml-3"
                data-testid="sort-date"
              >
                Data Início
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedClients.map((client) => (
            <TableRow 
              key={client.ids || client.id} 
              className="cursor-pointer hover-elevate"
              onClick={() => onClientClick(client.ids || String(client.id))}
              data-testid={`client-row-${client.ids || client.id}`}
            >
              <TableCell className="font-medium" data-testid={`text-client-name-${client.ids || client.id}`}>
                {client.nomeClickup || client.nome || "-"}
              </TableCell>
              <TableCell data-testid={`text-services-${client.ids || client.id}`}>
                <div className="text-sm text-muted-foreground max-w-[300px] truncate" title={client.servicos || undefined}>
                  {client.servicos || "-"}
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm" data-testid={`text-cnpj-${client.ids || client.id}`}>
                {formatCNPJ(client.cnpjCliente || client.cnpj)}
              </TableCell>
              <TableCell data-testid={`text-status-${client.ids || client.id}`}>
                <Badge className={`${getStatusColor(client.statusClickup)}`} variant="outline">
                  {client.statusClickup || "N/A"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground" data-testid={`text-date-${client.ids || client.id}`}>
                {client.dataInicio ? new Date(client.dataInicio).toLocaleDateString('pt-BR') : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
