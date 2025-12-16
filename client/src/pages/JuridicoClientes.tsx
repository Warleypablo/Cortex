import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Scale,
  Users,
  DollarSign,
  Clock,
  Search,
  AlertTriangle,
  Phone,
  Mail,
  Building2,
  User,
  Receipt,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClienteInadimplente {
  idCliente: string;
  nomeCliente: string;
  valorTotal: number;
  quantidadeParcelas: number;
  parcelaMaisAntiga: string;
  diasAtrasoMax: number;
  empresa: string;
  cnpj: string | null;
  statusClickup: string | null;
  responsavel: string | null;
  cluster: string | null;
  servicos: string | null;
  telefone: string | null;
}

interface Contexto {
  contexto: string | null;
  evidencias: string | null;
  acao: string | null;
  statusFinanceiro: string | null;
  detalheFinanceiro: string | null;
  atualizadoPor: string | null;
  atualizadoEm: string | null;
}

interface Parcela {
  id: number;
  descricao: string;
  valorBruto: number;
  naoPago: number;
  dataVencimento: string;
  diasAtraso: number;
  empresa: string;
  status: string;
  urlCobranca: string | null;
}

interface ClienteJuridico {
  cliente: ClienteInadimplente;
  contexto: Contexto;
  parcelas: Parcela[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDate = (date: string | null) => {
  if (!date) return "-";
  try {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
};

export default function JuridicoClientes() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery<{ clientes: ClienteJuridico[] }>({
    queryKey: ["/api/juridico/clientes"],
  });

  const clientes = data?.clientes || [];

  const filteredClientes = useMemo(() => {
    return clientes.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        item.cliente.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente.cnpj?.includes(searchTerm);

      return matchesSearch;
    });
  }, [clientes, searchTerm]);

  const totals = useMemo(() => {
    const total = filteredClientes.reduce((acc, item) => acc + item.cliente.valorTotal, 0);
    const totalParcelas = filteredClientes.reduce((acc, item) => acc + item.cliente.quantidadeParcelas, 0);
    return { total, totalParcelas, count: filteredClientes.length };
  }, [filteredClientes]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Scale className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">
                Jurídico - Clientes Inadimplentes
              </h1>
              <p className="text-muted-foreground text-sm">
                Clientes com ação "Cobrar" para tratamento jurídico
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2" data-testid="badge-total-clients">
            {totals.count} clientes
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total Inadimplente</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-total-value">
                {formatCurrency(totals.total)}
              </div>
              <p className="text-xs text-muted-foreground">{totals.totalParcelas} parcelas em atraso</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes em Cobrança</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-client-count">
                {totals.count}
              </div>
              <p className="text-xs text-muted-foreground">Com ação "Cobrar" definida</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-average-ticket">
                {formatCurrency(totals.count > 0 ? totals.total / totals.count : 0)}
              </div>
              <p className="text-xs text-muted-foreground">Por cliente inadimplente</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, empresa ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            {filteredClientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4" />
                <p className="text-lg">Nenhum cliente encontrado com os filtros aplicados</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {filteredClientes.map((item, index) => (
                  <AccordionItem
                    key={item.cliente.idCliente}
                    value={item.cliente.idCliente}
                    className="border rounded-lg px-4"
                    data-testid={`accordion-client-${index}`}
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center justify-between w-full pr-4 flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-start">
                            <span className="font-semibold text-left" data-testid={`text-client-name-${index}`}>
                              {item.cliente.nomeCliente}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {item.cliente.empresa} {item.cliente.cnpj && `• ${item.cliente.cnpj}`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="destructive" className="gap-1">
                                <Clock className="h-3 w-3" />
                                {item.cliente.diasAtrasoMax} dias
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Dias de atraso máximo</TooltipContent>
                          </Tooltip>
                          <span className="font-bold text-destructive" data-testid={`text-client-value-${index}`}>
                            {formatCurrency(item.cliente.valorTotal)}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pt-4 pb-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Informações do Cliente
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {item.cliente.telefone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{item.cliente.telefone}</span>
                              </div>
                            )}
                            {item.cliente.responsavel && (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>Responsável: {item.cliente.responsavel}</span>
                              </div>
                            )}
                            {item.cliente.servicos && (
                              <div className="flex items-center gap-2 col-span-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>Serviços: {item.cliente.servicos}</span>
                              </div>
                            )}
                            {item.cliente.cluster && (
                              <div>
                                <Badge variant="outline">{item.cliente.cluster}</Badge>
                              </div>
                            )}
                          </div>

                          {item.contexto && (
                            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                              <h5 className="font-medium mb-2 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                Contexto CS
                              </h5>
                              {item.contexto.contexto && (
                                <p className="text-sm mb-2">{item.contexto.contexto}</p>
                              )}
                              {item.contexto.statusFinanceiro && (
                                <Badge variant="secondary" className="mr-2">
                                  {item.contexto.statusFinanceiro}
                                </Badge>
                              )}
                              {item.contexto.detalheFinanceiro && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  {item.contexto.detalheFinanceiro}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Receipt className="h-4 w-4" />
                            Parcelas em Atraso ({item.parcelas.length})
                          </h4>
                          <div className="max-h-[300px] overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Descrição</TableHead>
                                  <TableHead>Vencimento</TableHead>
                                  <TableHead>Dias Atraso</TableHead>
                                  <TableHead className="text-right">Valor</TableHead>
                                  <TableHead></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {item.parcelas.map((parcela, pIndex) => (
                                  <TableRow key={parcela.id} data-testid={`row-parcela-${index}-${pIndex}`}>
                                    <TableCell className="font-medium max-w-[200px] truncate">
                                      {parcela.descricao}
                                    </TableCell>
                                    <TableCell>{formatDate(parcela.dataVencimento)}</TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          parcela.diasAtraso > 90
                                            ? "destructive"
                                            : parcela.diasAtraso > 30
                                            ? "secondary"
                                            : "outline"
                                        }
                                      >
                                        {parcela.diasAtraso}d
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-destructive">
                                      {formatCurrency(parcela.naoPago)}
                                    </TableCell>
                                    <TableCell>
                                      {parcela.urlCobranca && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <a
                                              href={parcela.urlCobranca}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-primary hover:text-primary/80"
                                            >
                                              <ExternalLink className="h-4 w-4" />
                                            </a>
                                          </TooltipTrigger>
                                          <TooltipContent>Abrir cobrança</TooltipContent>
                                        </Tooltip>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
