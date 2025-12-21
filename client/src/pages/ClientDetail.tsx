import { useState, useEffect, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePageInfo } from "@/contexts/PageContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatsCard from "@/components/StatsCard";
import RevenueChart from "@/components/RevenueChart";
import { ArrowLeft, DollarSign, TrendingUp, Receipt, Loader2, ExternalLink } from "lucide-react";
import type { ContratoCompleto } from "@shared/schema";

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

interface ContaReceber {
  id: number;
  status: string | null;
  total: string | null;
  descricao: string | null;
  dataVencimento: string | null;
  naoPago: string | null;
  pago: string | null;
  dataCriacao: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  empresa: string | null;
  urlCobranca: string | null;
}

interface RevenueData {
  mes: string;
  valor: number;
}

export default function ClientDetail() {
  const { setPageInfo } = usePageInfo();
  const [, params] = useRoute("/cliente/:id");
  const clientId = params?.id || "";
  const [receitasCurrentPage, setReceitasCurrentPage] = useState(1);
  const [receitasItemsPerPage, setReceitasItemsPerPage] = useState(10);
  const [monthsFilter, setMonthsFilter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const { data: cliente, isLoading: isLoadingCliente, error: clienteError } = useQuery<ClienteDb>({
    queryKey: ["/api/cliente", clientId],
    enabled: !!clientId,
  });

  const { data: receitas, isLoading: isLoadingReceitas } = useQuery<ContaReceber[]>({
    queryKey: ["/api/cliente", clientId, "receitas"],
    enabled: !!clientId && !!cliente,
  });

  const { data: revenueHistory, isLoading: isLoadingRevenue } = useQuery<RevenueData[]>({
    queryKey: ["/api/cliente", clientId, "revenue"],
    enabled: !!clientId && !!cliente,
  });

  const { data: contratos, isLoading: isLoadingContratos } = useQuery<ContratoCompleto[]>({
    queryKey: ["/api/cliente", clientId, "contratos"],
    enabled: !!clientId && !!cliente,
  });

  const sortedReceitas = useMemo(() => {
    if (!receitas) return [];
    
    return [...receitas].sort((a, b) => {
      const dateA = a.dataVencimento ? new Date(a.dataVencimento).getTime() : 0;
      const dateB = b.dataVencimento ? new Date(b.dataVencimento).getTime() : 0;
      return dateB - dateA;
    });
  }, [receitas]);

  const filteredReceitas = useMemo(() => {
    if (!selectedMonth) return sortedReceitas;
    
    return sortedReceitas.filter(r => {
      const dataParaUsar = r.dataVencimento || r.dataCriacao;
      if (!dataParaUsar) return false;
      
      const data = new Date(dataParaUsar);
      if (isNaN(data.getTime())) return false;
      
      const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      return mesAno === selectedMonth;
    });
  }, [sortedReceitas, selectedMonth]);

  const lt = useMemo(() => {
    if (!sortedReceitas || sortedReceitas.length === 0) return 0;
    
    const mesesUnicos = new Set<string>();
    
    sortedReceitas.forEach(r => {
      const statusUpper = r.status?.toUpperCase();
      if (statusUpper === "PAGO" || statusUpper === "ACQUITTED") {
        const dataParaUsar = r.dataVencimento || r.dataCriacao;
        if (dataParaUsar) {
          const data = new Date(dataParaUsar);
          if (!isNaN(data.getTime())) {
            const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            mesesUnicos.add(mesAno);
          }
        }
      }
    });
    
    return mesesUnicos.size;
  }, [sortedReceitas]);

  const totalReceitas = sortedReceitas?.reduce((sum, r) => sum + parseFloat(r.pago || "0"), 0) || 0;
  const ticketMedio = lt > 0 ? totalReceitas / lt : 0;
  
  const temContratoAtivo = contratos?.some(c => {
    const statusLower = c.status?.toLowerCase() || "";
    if (statusLower.includes("inativo") || statusLower.includes("inactive") || 
        statusLower.includes("cancelado") || statusLower.includes("canceled")) {
      return false;
    }
    return statusLower.includes("ativo") || statusLower.includes("active");
  }) || false;
  
  const temInadimplencia = sortedReceitas?.some(r => {
    if (!r.dataVencimento || r.status?.toUpperCase() === "PAGO") return false;
    const vencimento = new Date(r.dataVencimento);
    const hoje = new Date();
    const valorPendente = parseFloat(r.naoPago || "0");
    return vencimento < hoje && valorPendente > 0;
  }) || false;

  const handleBarClick = (month: string) => {
    setSelectedMonth(prevMonth => prevMonth === month ? null : month);
    setReceitasCurrentPage(1);
  };

  const receitasStartIndex = (receitasCurrentPage - 1) * receitasItemsPerPage;
  const receitasEndIndex = receitasStartIndex + receitasItemsPerPage;
  const paginatedReceitas = filteredReceitas?.slice(receitasStartIndex, receitasEndIndex) || [];

  const chartData = useMemo(() => {
    if (!revenueHistory || revenueHistory.length === 0) return [];
    
    const allData = revenueHistory.map((item) => ({
      month: item.mes,
      revenue: item.valor,
    })).sort((a, b) => a.month.localeCompare(b.month));
    
    if (monthsFilter === "all") {
      return allData;
    }
    
    const numMonths = parseInt(monthsFilter);
    return allData.slice(-numMonths);
  }, [revenueHistory, monthsFilter]);

  const receitasTotalPages = Math.ceil((filteredReceitas?.length || 0) / receitasItemsPerPage);
  
  useEffect(() => {
    if (receitasTotalPages > 0 && receitasCurrentPage > receitasTotalPages) {
      setReceitasCurrentPage(receitasTotalPages);
    }
  }, [receitasTotalPages, receitasCurrentPage]);

  useEffect(() => {
    if (cliente?.nome) {
      setPageInfo(cliente.nome, `CNPJ: ${cliente.cnpj || "N/A"}`);
    } else {
      setPageInfo("Detalhes do Cliente", "Carregando...");
    }
  }, [cliente, setPageInfo]);

  const isLoading = isLoadingCliente;

  if (isLoading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (clienteError || !cliente) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="p-8">
            <div className="text-center">
              <p className="text-destructive font-semibold mb-2">Cliente não encontrado</p>
              <p className="text-sm text-muted-foreground">
                {clienteError instanceof Error ? clienteError.message : "O cliente solicitado não existe"}
              </p>
              <Link href="/">
                <Button variant="default" className="mt-4">
                  Voltar para lista de clientes
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

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

  const getStatusBadge = (status: string | null) => {
    const normalizedStatus = status?.toUpperCase();
    switch (normalizedStatus) {
      case "PAGO":
      case "ACQUITTED":
        return <Badge variant="default" className="bg-green-600" data-testid="badge-pago">Quitado</Badge>;
      case "PENDENTE":
      case "PENDING":
        return <Badge variant="secondary" data-testid="badge-pendente">Pendente</Badge>;
      case "VENCIDO":
      case "OVERDUE":
        return <Badge variant="destructive" data-testid="badge-vencido">Vencido</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status">{status || "N/A"}</Badge>;
    }
  };

  const getContractStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("ativo") || statusLower.includes("active")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    } else if (statusLower.includes("onboard") || statusLower.includes("início")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    } else if (statusLower.includes("triagem") || statusLower.includes("análise")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    } else if (statusLower.includes("cancelamento") || statusLower.includes("pausa")) {
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    } else if (statusLower.includes("cancelado") || statusLower.includes("inativo")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  };

  const getSquadColorForContract = (squad: string) => {
    switch (squad) {
      case "Supreme":
      case "Performance":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "Forja":
      case "Comunicação":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "Squadra":
      case "Tech":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";
      case "Chama":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const mapSquadCodeToName = (code: string | null): string => {
    if (!code) return "Não definido";
    switch (code) {
      case "0": return "Supreme";
      case "1": return "Forja";
      case "2": return "Squadra";
      case "3": return "Chama";
      default: return code;
    }
  };

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="hover-elevate -ml-2 mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para clientes
            </Button>
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>CNPJ: {cliente.cnpj || "N/A"}</span>
                {cliente.endereco && (
                  <>
                    <span>•</span>
                    <span>{cliente.endereco}</span>
                  </>
                )}
                {cliente.createdAt && (
                  <>
                    <span>•</span>
                    <span>Cadastro: {new Date(cliente.createdAt).toLocaleDateString('pt-BR')}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {temInadimplencia && (
                <Badge variant="destructive" data-testid="badge-inadimplente">
                  Inadimplente
                </Badge>
              )}
              <Badge variant={temContratoAtivo ? "default" : "secondary"} data-testid="badge-status-cliente">
                {temContratoAtivo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Receita Total"
            value={new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0
            }).format(totalReceitas)}
            icon={DollarSign}
          />
          <StatsCard
            title="Ticket Médio"
            value={new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0
            }).format(ticketMedio)}
            icon={TrendingUp}
          />
          <StatsCard
            title="LT"
            value={lt.toString()}
            icon={Receipt}
          />
        </div>

        {isLoadingRevenue ? (
          <div className="mb-8 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="mb-8">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Histórico de Faturamento</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Período:</span>
                    <Select
                      value={monthsFilter}
                      onValueChange={setMonthsFilter}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-months-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 meses</SelectItem>
                        <SelectItem value="6">6 meses</SelectItem>
                        <SelectItem value="12">12 meses</SelectItem>
                        <SelectItem value="all">Todos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <RevenueChart 
                  data={chartData} 
                  onBarClick={handleBarClick}
                  selectedMonth={selectedMonth}
                />
              </div>
            </Card>
          </div>
        ) : null}

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">Contratos</h2>
          <Card className="overflow-hidden">
            {isLoadingContratos ? (
              <div className="flex items-center justify-center py-8" data-testid="loading-contratos">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-sm">
                    <TableRow className="bg-background border-b">
                    <TableHead className="bg-background" data-testid="header-service">Serviço</TableHead>
                    <TableHead className="bg-background" data-testid="header-status">Status</TableHead>
                    <TableHead className="bg-background" data-testid="header-squad">Squad</TableHead>
                    <TableHead className="bg-background" data-testid="header-responsavel">Responsável</TableHead>
                    <TableHead className="bg-background" data-testid="header-cs">CS</TableHead>
                    <TableHead className="bg-background" data-testid="header-date">Data Início</TableHead>
                    <TableHead className="text-right bg-background" data-testid="header-recurring">Valor Recorrente</TableHead>
                    <TableHead className="text-right bg-background" data-testid="header-onetime">Valor Pontual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratos && contratos.length > 0 ? (
                    contratos.map((contrato) => (
                      <TableRow key={contrato.idSubtask} data-testid={`contract-row-${contrato.idSubtask}`}>
                        <TableCell className="font-medium" data-testid={`text-service-${contrato.idSubtask}`}>
                          {contrato.servico || "Sem serviço"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={getContractStatusColor(contrato.status || "")} 
                            variant="outline"
                            data-testid={`badge-status-${contrato.idSubtask}`}
                          >
                            {contrato.status || "Desconhecido"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={getSquadColorForContract(mapSquadCodeToName(contrato.squad))} 
                            variant="outline"
                            data-testid={`badge-squad-${contrato.idSubtask}`}
                          >
                            {mapSquadCodeToName(contrato.squad)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-testid={`text-responsavel-${contrato.idSubtask}`}>
                          {contrato.responsavel || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-testid={`text-cs-${contrato.idSubtask}`}>
                          {contrato.csResponsavel || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-testid={`text-date-${contrato.idSubtask}`}>
                          {contrato.dataInicio ? new Date(contrato.dataInicio).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold" data-testid={`text-recurring-${contrato.idSubtask}`}>
                          {contrato.valorr && parseFloat(contrato.valorr) > 0
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(contrato.valorr))
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right font-semibold" data-testid={`text-onetime-${contrato.idSubtask}`}>
                          {contrato.valorp && parseFloat(contrato.valorp) > 0
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(contrato.valorp))
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8" data-testid="text-no-contracts">
                        Nenhum contrato encontrado para este cliente
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            )}
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Contas a Receber</h2>
            {selectedMonth && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="badge-month-filter">
                  Filtrado por: {selectedMonth}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedMonth(null)}
                  data-testid="button-clear-month-filter"
                >
                  Limpar filtro
                </Button>
              </div>
            )}
          </div>
          <Card className="overflow-hidden">
            {isLoadingReceitas ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-sm">
                    <TableRow className="bg-background border-b">
                    <TableHead className="bg-background">Descrição</TableHead>
                    <TableHead className="bg-background">Status</TableHead>
                    <TableHead className="bg-background">Vencimento</TableHead>
                    <TableHead className="bg-background">Valor Total</TableHead>
                    <TableHead className="bg-background">Pago</TableHead>
                    <TableHead className="bg-background">Pendente</TableHead>
                    <TableHead className="bg-background">Link Cobrança</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReceitas.length > 0 ? (
                    paginatedReceitas.map((receita, idx) => (
                      <TableRow key={`receita-${receita.id}-${idx}`}>
                        <TableCell className="font-medium">
                          {receita.descricao || "Sem descrição"}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(receita.status)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {receita.dataVencimento 
                            ? new Date(receita.dataVencimento).toLocaleDateString('pt-BR')
                            : "N/A"
                          }
                        </TableCell>
                        <TableCell className="font-semibold">
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          }).format(parseFloat(receita.total || "0"))}
                        </TableCell>
                        <TableCell className="text-green-600">
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          }).format(parseFloat(receita.pago || "0"))}
                        </TableCell>
                        <TableCell className="text-orange-600">
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          }).format(parseFloat(receita.naoPago || "0"))}
                        </TableCell>
                        <TableCell>
                          {receita.urlCobranca ? (
                            <a 
                              href={receita.urlCobranca} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                              data-testid={`link-cobranca-${receita.id}`}
                            >
                              Acessar
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm" data-testid={`text-no-link-${receita.id}`}>-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma conta a receber encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                  </Table>
                </div>

                {receitasTotalPages > 1 && (
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Itens por página:</span>
                      <Select
                        value={receitasItemsPerPage.toString()}
                        onValueChange={(value) => {
                          setReceitasItemsPerPage(Number(value));
                          setReceitasCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[100px]" data-testid="select-receitas-items-per-page">
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

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Página {receitasCurrentPage} de {receitasTotalPages}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(1)}
                          disabled={receitasCurrentPage === 1}
                          data-testid="button-receitas-first-page"
                        >
                          Primeira
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(receitasCurrentPage - 1)}
                          disabled={receitasCurrentPage === 1}
                          data-testid="button-receitas-prev-page"
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(receitasCurrentPage + 1)}
                          disabled={receitasCurrentPage === receitasTotalPages}
                          data-testid="button-receitas-next-page"
                        >
                          Próxima
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(receitasTotalPages)}
                          disabled={receitasCurrentPage === receitasTotalPages}
                          data-testid="button-receitas-last-page"
                        >
                          Última
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
