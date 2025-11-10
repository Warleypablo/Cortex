import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClienteCompleto } from "../../../server/storage";

interface ClientsTableProps {
  clients: ClienteCompleto[];
  onClientClick: (clientId: string) => void;
  ltvMap?: Record<string, number>;
}

type SortField = "name" | "cnpj" | "ltv" | "lt" | "status" | "startDate";
type SortDirection = "asc" | "desc";

export default function ClientsTable({ clients, onClientClick, ltvMap }: ClientsTableProps) {
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
    } else if (sortField === "ltv") {
      const ltvA = ltvMap?.[a.ids || String(a.id)] || 0;
      const ltvB = ltvMap?.[b.ids || String(b.id)] || 0;
      comparison = ltvA - ltvB;
    } else if (sortField === "lt") {
      const ltA = a.ltMeses || 0;
      const ltB = b.ltMeses || 0;
      comparison = ltA - ltB;
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
    
    if (statusLower.includes("pausado") || statusLower.includes("paused")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    } else if (statusLower.includes("cancelado") || statusLower.includes("canceled") || statusLower.includes("inativo") || statusLower.includes("inactive")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    } else if (statusLower.includes("ativo") || statusLower.includes("active")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
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

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-auto h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="grid grid-cols-[minmax(300px,2fr)_minmax(180px,1.5fr)_minmax(200px,2fr)_minmax(140px,1fr)_minmax(120px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)] text-sm font-medium text-muted-foreground">
          <div className="h-12 flex items-center px-4">
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
          </div>
          <div className="h-12 flex items-center px-4">
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
          </div>
          <div className="h-12 flex items-center px-4">
            Serviços
          </div>
          <div className="h-12 flex items-center px-4">
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
          </div>
          <div className="h-12 flex items-center px-4">
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
          </div>
          <div className="h-12 flex items-center px-4">
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
          </div>
          <div className="h-12 flex items-center px-4">
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
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div>
        {sortedClients.map((client) => {
          const ltv = ltvMap?.[client.ids || String(client.id)] || 0;
          const ltMeses = typeof client.ltMeses === 'number' ? client.ltMeses : 0;
          return (
            <div 
              key={client.ids || client.id} 
              className="grid grid-cols-[minmax(300px,2fr)_minmax(180px,1.5fr)_minmax(200px,2fr)_minmax(140px,1fr)_minmax(120px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)] cursor-pointer hover-elevate"
              onClick={() => onClientClick(client.ids || String(client.id))}
              data-testid={`client-row-${client.ids || client.id}`}
            >
              <div className="px-4 py-3 font-medium text-sm" data-testid={`text-client-name-${client.ids || client.id}`}>
                {client.nomeClickup || client.nome || "-"}
              </div>
              <div className="px-4 py-3 font-mono text-sm" data-testid={`text-cnpj-${client.ids || client.id}`}>
                {formatCNPJ(client.cnpjCliente || client.cnpj)}
              </div>
              <div className="px-4 py-3 text-sm" data-testid={`text-services-${client.ids || client.id}`}>
                <div className="text-muted-foreground max-w-[300px] truncate" title={client.servicos || undefined}>
                  {client.servicos || "-"}
                </div>
              </div>
              <div className="px-4 py-3 font-medium text-sm" data-testid={`text-ltv-${client.ids || client.id}`}>
                {ltv > 0 ? formatCurrency(ltv) : "-"}
              </div>
              <div className="px-4 py-3 font-medium text-sm" data-testid={`text-lt-${client.ids || client.id}`}>
                {ltMeses > 0 ? `${ltMeses.toFixed(1)} m` : "-"}
              </div>
              <div className="px-4 py-3 text-sm" data-testid={`text-status-${client.ids || client.id}`}>
                <Badge className={`${getStatusColor(client.statusClickup)}`} variant="outline">
                  {client.statusClickup || "N/A"}
                </Badge>
              </div>
              <div className="px-4 py-3 text-muted-foreground text-sm" data-testid={`text-date-${client.ids || client.id}`}>
                {client.dataInicio ? new Date(client.dataInicio).toLocaleDateString('pt-BR') : "-"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
