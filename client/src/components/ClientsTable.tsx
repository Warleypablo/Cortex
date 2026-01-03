import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Info, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ServiceIcons } from "@/components/ServiceIcons";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { ClienteCompleto } from "../../../server/storage";

type SortField = "name" | "cnpj" | "ltv" | "lt" | "aov" | "status" | "startDate" | "cluster" | "financeiro" | "firstPayment";
type SortDirection = "asc" | "desc";

interface ContratoInfo {
  id: number;
  numero_contrato: string;
  status: string;
  valor_negociado: number;
}

interface ClientsTableProps {
  clients: ClienteCompleto[];
  onClientClick: (clientId: string) => void;
  ltvMap?: Record<string, number>;
  contratosMap?: Record<string, ContratoInfo>;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

const clusterConfig: Record<string, { label: string; color: string }> = {
  "1": { label: "NFNC", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  "2": { label: "Regulares", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  "3": { label: "Chaves", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  "4": { label: "Imperdíveis", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
};

export default function ClientsTable({ clients, onClientClick, ltvMap, contratosMap, sortField, sortDirection, onSort }: ClientsTableProps) {

  const getClusterBadge = (cluster: string | null) => {
    if (!cluster) return null;
    const config = clusterConfig[cluster];
    if (!config) return cluster;
    return config;
  };

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

  const getFinanceiroColor = (ltMeses: number, ltvMap: Record<string, number> | undefined, clientId: string) => {
    const ltv = ltvMap?.[clientId] || 0;
    if (ltMeses === 0 && ltv === 0) return "bg-muted text-muted-foreground";
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  };

  const getFinanceiroLabel = (ltMeses: number, ltvMap: Record<string, number> | undefined, clientId: string) => {
    const ltv = ltvMap?.[clientId] || 0;
    if (ltMeses === 0 && ltv === 0) return "-";
    return "Em dia";
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
        <div className="grid grid-cols-[minmax(220px,2fr)_minmax(150px,1.2fr)_minmax(80px,0.6fr)_minmax(90px,0.7fr)_minmax(100px,0.8fr)_minmax(60px,0.5fr)_minmax(90px,0.7fr)_minmax(80px,0.6fr)_minmax(80px,0.6fr)_minmax(95px,0.75fr)_minmax(95px,0.75fr)_minmax(160px,1.3fr)] text-sm font-medium text-muted-foreground">
          {/* Nome do Cliente */}
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
          {/* CNPJ */}
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
          {/* Contrato */}
          <div className="h-12 flex items-center px-4">
            Contrato
          </div>
          {/* Status */}
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
          {/* LTV */}
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
          {/* LT */}
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
          {/* AOV */}
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
          {/* Cluster */}
          <div className="h-12 flex items-center px-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onSort("cluster")}
              className="hover-elevate -ml-3"
              data-testid="sort-cluster"
            >
              Cluster
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {/* Financeiro */}
          <div className="h-12 flex items-center px-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onSort("financeiro")}
              className="hover-elevate -ml-3"
              data-testid="sort-financeiro"
            >
              Financeiro
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {/* Data Início */}
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
          {/* Data 1° Pagamento */}
          <div className="h-12 flex items-center px-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onSort("firstPayment")}
              className="hover-elevate -ml-3"
              data-testid="sort-first-payment"
            >
              1° Pgto
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {/* Serviços */}
          <div className="h-12 flex items-center px-4">
            Serviços
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div>
        {clients.map((client, index) => {
          const ltv = ltvMap?.[client.ids || String(client.id)] || 0;
          const ltMeses = typeof client.ltMeses === 'number' ? client.ltMeses : 0;
          const clientId = client.ids || String(client.id);
          const cnpjLimpo = (client.cnpjCliente || client.cnpj || '').replace(/\D/g, '');
          const contratoInfo = cnpjLimpo ? contratosMap?.[cnpjLimpo] : undefined;
          return (
            <div 
              key={`${clientId}-${index}`} 
              className="grid grid-cols-[minmax(220px,2fr)_minmax(150px,1.2fr)_minmax(80px,0.6fr)_minmax(90px,0.7fr)_minmax(100px,0.8fr)_minmax(60px,0.5fr)_minmax(90px,0.7fr)_minmax(80px,0.6fr)_minmax(80px,0.6fr)_minmax(95px,0.75fr)_minmax(95px,0.75fr)_minmax(160px,1.3fr)] cursor-pointer hover-elevate"
              onClick={() => onClientClick(clientId)}
              data-testid={`client-row-${clientId}`}
            >
              {/* Nome do Cliente */}
              <div className="px-4 py-3 font-medium text-sm" data-testid={`text-client-name-${clientId}`}>
                {client.nomeClickup || client.nome || "-"}
              </div>
              {/* CNPJ */}
              <div className="px-4 py-3 text-sm text-muted-foreground" data-testid={`text-cnpj-${clientId}`}>
                {formatCNPJ(client.cnpjCliente || client.cnpj)}
              </div>
              {/* Contrato */}
              <div className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()} data-testid={`text-contrato-${clientId}`}>
                {contratoInfo ? (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-1.5 text-xs"
                    onClick={() => window.open(`/api/contratos/${contratoInfo.id}/gerar-pdf`, '_blank')}
                    data-testid={`button-ver-contrato-${clientId}`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Ver
                  </Button>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
              {/* Status */}
              <div className="px-4 py-3 text-sm" data-testid={`text-status-${clientId}`}>
                <Badge className={`${getStatusColor(client.statusClickup)} text-xs`} variant="outline">
                  {client.statusClickup || "N/A"}
                </Badge>
              </div>
              {/* LTV */}
              <div className="px-4 py-3 font-medium text-sm" data-testid={`text-ltv-${clientId}`}>
                {ltv > 0 ? formatCurrencyNoDecimals(ltv) : "-"}
              </div>
              {/* LT */}
              <div className="px-4 py-3 font-medium text-sm" data-testid={`text-lt-${clientId}`}>
                {ltMeses > 0 ? `${Math.round(ltMeses)} m` : "-"}
              </div>
              {/* AOV */}
              <div className="px-4 py-3 font-medium text-sm" data-testid={`text-aov-${clientId}`}>
                {ltMeses > 0 && ltv > 0 ? formatCurrencyNoDecimals(ltv / ltMeses) : "-"}
              </div>
              {/* Cluster */}
              <div className="px-4 py-3 text-sm" data-testid={`text-cluster-${clientId}`}>
                {(() => {
                  const config = getClusterBadge(client.cluster);
                  if (!config) return "-";
                  if (typeof config === 'string') return config;
                  return (
                    <Badge className={`${config.color} text-xs`} variant="outline">
                      {config.label}
                    </Badge>
                  );
                })()}
              </div>
              {/* Financeiro */}
              <div className="px-4 py-3 text-sm" data-testid={`text-financeiro-${clientId}`}>
                <Badge className={`${getFinanceiroColor(ltMeses, ltvMap, clientId)} text-xs`} variant="outline">
                  {getFinanceiroLabel(ltMeses, ltvMap, clientId)}
                </Badge>
              </div>
              {/* Data Início */}
              <div className="px-4 py-3 text-muted-foreground text-sm" data-testid={`text-date-${clientId}`}>
                {client.dataInicio ? new Date(client.dataInicio).toLocaleDateString('pt-BR') : "-"}
              </div>
              {/* Data 1° Pagamento */}
              <div className="px-4 py-3 text-muted-foreground text-sm" data-testid={`text-first-payment-${clientId}`}>
                {client.dataPrimeiroPagamento ? new Date(client.dataPrimeiroPagamento).toLocaleDateString('pt-BR') : "-"}
              </div>
              {/* Serviços */}
              <div className="px-4 py-3 text-sm" data-testid={`text-services-${clientId}`}>
                <ServiceIcons services={client.servicos} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
