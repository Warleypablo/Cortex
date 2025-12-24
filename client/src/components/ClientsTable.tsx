import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ServiceIcons } from "@/components/ServiceIcons";
import { formatCurrency, formatDecimal } from "@/lib/utils";
import type { ClienteCompleto } from "../../../server/storage";

type SortField = "name" | "cnpj" | "ltv" | "lt" | "aov" | "status" | "startDate";
type SortDirection = "asc" | "desc";

interface ClientsTableProps {
  clients: ClienteCompleto[];
  onClientClick: (clientId: string) => void;
  ltvMap?: Record<string, number>;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

export default function ClientsTable({ clients, onClientClick, ltvMap, sortField, sortDirection, onSort }: ClientsTableProps) {

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

  return (
    <div className="rounded-lg border border-border bg-card overflow-auto h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="grid grid-cols-[minmax(300px,2fr)_minmax(180px,1.5fr)_minmax(200px,2fr)_minmax(140px,1fr)_minmax(90px,0.8fr)_minmax(110px,1fr)_minmax(120px,1fr)_minmax(130px,1fr)] text-sm font-medium text-muted-foreground">
          <div className="h-12 flex items-center px-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onSort("name")}
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
              onClick={() => onSort("cnpj")}
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
              onClick={() => onSort("ltv")}
              className="hover-elevate -ml-3"
              data-testid="sort-ltv"
            >
              <span className="flex items-center gap-1">
                LTV
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Lifetime Value: soma de toda receita paga pelo cliente</p>
                  </TooltipContent>
                </Tooltip>
              </span>
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="h-12 flex items-center px-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onSort("lt")}
              className="hover-elevate -ml-3"
              data-testid="sort-lt"
            >
              <span className="flex items-center gap-1">
                LT
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Lifetime: meses ativos com receita paga</p>
                  </TooltipContent>
                </Tooltip>
              </span>
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="h-12 flex items-center px-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onSort("aov")}
              className="hover-elevate -ml-3"
              data-testid="sort-aov"
            >
              <span className="flex items-center gap-1">
                AOV
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Average Order Value: LTV dividido pelo LT</p>
                  </TooltipContent>
                </Tooltip>
              </span>
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="h-12 flex items-center px-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onSort("status")}
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
              onClick={() => onSort("startDate")}
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
        {clients.map((client) => {
          const ltv = ltvMap?.[client.ids || String(client.id)] || 0;
          const ltMeses = typeof client.ltMeses === 'number' ? client.ltMeses : 0;
          return (
            <div 
              key={client.ids || client.id} 
              className="grid grid-cols-[minmax(300px,2fr)_minmax(180px,1.5fr)_minmax(200px,2fr)_minmax(140px,1fr)_minmax(90px,0.8fr)_minmax(110px,1fr)_minmax(120px,1fr)_minmax(130px,1fr)] cursor-pointer hover-elevate"
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
                <ServiceIcons services={client.servicos} />
              </div>
              <div className="px-4 py-3 font-medium text-sm" data-testid={`text-ltv-${client.ids || client.id}`}>
                {ltv > 0 ? formatCurrency(ltv) : "-"}
              </div>
              <div className="px-4 py-3 font-medium text-sm" data-testid={`text-lt-${client.ids || client.id}`}>
                {ltMeses > 0 ? `${Math.round(ltMeses)} m` : "-"}
              </div>
              <div className="px-4 py-3 font-medium text-sm" data-testid={`text-aov-${client.ids || client.id}`}>
                {ltMeses > 0 && ltv > 0 ? formatCurrency(ltv / ltMeses) : "-"}
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
