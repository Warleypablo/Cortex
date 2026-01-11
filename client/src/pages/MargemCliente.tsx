import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  TrendingDown, DollarSign, Users, Percent, 
  Building2, Search, ArrowUpDown, ChevronUp, ChevronDown, ChevronRight, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MargemClienteResumo, MargemClienteItem } from "@shared/schema";

type SortField = 'nomeCliente' | 'receita' | 'despesaTotal' | 'margem' | 'margemPercentual';
type SortDirection = 'asc' | 'desc';

function getDefaultDates() {
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    inicio: formatDate(primeiroDia),
    fim: formatDate(ultimoDia)
  };
}

export default function MargemCliente() {
  usePageTitle("Margem por Cliente");
  useSetPageInfo("Margem por Cliente", "Análise de margem e rentabilidade por cliente");
  
  const defaultDates = getDefaultDates();
  // Estados "confirmados" usados na query
  const [dataInicio, setDataInicio] = useState(defaultDates.inicio);
  const [dataFim, setDataFim] = useState(defaultDates.fim);
  // Estados "pendentes" para os inputs (atualizam em tempo real)
  const [inputInicio, setInputInicio] = useState(defaultDates.inicio);
  const [inputFim, setInputFim] = useState(defaultDates.fim);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('receita');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Valida se a data está completa (YYYY-MM-DD = 10 caracteres)
  const isValidDate = (dateStr: string) => {
    if (dateStr.length !== 10) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  };

  // Aplica as datas quando completas
  const handleInicioChange = (value: string) => {
    setInputInicio(value);
    if (isValidDate(value)) {
      setDataInicio(value);
    }
  };

  const handleFimChange = (value: string) => {
    setInputFim(value);
    if (isValidDate(value)) {
      setDataFim(value);
    }
  };

  // Ao sair do campo, força a atualização se a data for válida
  const handleBlurInicio = () => {
    if (isValidDate(inputInicio)) {
      setDataInicio(inputInicio);
    }
  };

  const handleBlurFim = () => {
    if (isValidDate(inputFim)) {
      setDataFim(inputFim);
    }
  };

  const { data, isLoading } = useQuery<MargemClienteResumo>({
    queryKey: ["/api/financeiro/margem-clientes", dataInicio, dataFim],
    queryFn: async () => {
      const response = await fetch(`/api/financeiro/margem-clientes?dataInicio=${dataInicio}&dataFim=${dataFim}`);
      if (!response.ok) throw new Error('Failed to fetch margem por cliente');
      return response.json();
    },
  });

  const handleSort = (field: SortField) => {
    setExpandedRows(new Set());
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleRow = (cnpj: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(cnpj)) {
        next.delete(cnpj);
      } else {
        next.add(cnpj);
      }
      return next;
    });
  };

  const filteredAndSortedClientes = useMemo(() => {
    if (!data?.clientes) return [];
    
    let filtered = data.clientes.filter(c => 
      c.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cnpj.includes(searchTerm)
    );

    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [data?.clientes, searchTerm, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 ml-1" />
      : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-margem-cliente">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Margem por Cliente</h1>
          <p className="text-muted-foreground">Análise de rentabilidade por cliente ativo</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="data-inicio" className="text-sm text-muted-foreground whitespace-nowrap">
              <Calendar className="h-4 w-4 inline mr-1" />
              De:
            </Label>
            <Input
              id="data-inicio"
              type="date"
              value={inputInicio}
              onChange={(e) => handleInicioChange(e.target.value)}
              onBlur={handleBlurInicio}
              className="w-[160px]"
              data-testid="input-data-inicio"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="data-fim" className="text-sm text-muted-foreground whitespace-nowrap">
              Até:
            </Label>
            <Input
              id="data-fim"
              type="date"
              value={inputFim}
              onChange={(e) => handleFimChange(e.target.value)}
              onBlur={handleBlurFim}
              className="w-[160px]"
              data-testid="input-data-fim"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-clientes">
              {data?.totalClientes || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-receita-total">
              {formatCurrency(data?.totalReceita || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesa Total</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-despesa-total">
              {formatCurrency(data?.totalDespesa || 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Salários: {formatCurrency(data?.totalDespesaSalarios || 0)} | 
              Freelancers: {formatCurrency(data?.totalDespesaFreelancers || 0)} | 
              Operacional: {formatCurrency(data?.totalDespesaOperacional || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Total</CardTitle>
            <Percent className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.totalMargem || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-margem-total">
              {formatCurrency(data?.totalMargem || 0)}
            </div>
            <div className="text-sm text-muted-foreground">
              <Badge variant={(data?.margemMediaPercentual || 0) >= 0 ? 'default' : 'destructive'}>
                {formatPercent(data?.margemMediaPercentual || 0)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Margem por Cliente
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-cliente"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-semibold hover:bg-transparent"
                      onClick={() => handleSort('nomeCliente')}
                      data-testid="button-sort-nome"
                    >
                      Cliente <SortIcon field="nomeCliente" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-semibold hover:bg-transparent"
                      onClick={() => handleSort('receita')}
                      data-testid="button-sort-receita"
                    >
                      Receita <SortIcon field="receita" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Salário Rateado</TableHead>
                  <TableHead className="text-right">Freelancers</TableHead>
                  <TableHead className="text-right">Operacional</TableHead>
                  <TableHead className="text-right">
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-semibold hover:bg-transparent"
                      onClick={() => handleSort('despesaTotal')}
                      data-testid="button-sort-despesa"
                    >
                      Despesa Total <SortIcon field="despesaTotal" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-semibold hover:bg-transparent"
                      onClick={() => handleSort('margem')}
                      data-testid="button-sort-margem"
                    >
                      Margem (R$) <SortIcon field="margem" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-semibold hover:bg-transparent"
                      onClick={() => handleSort('margemPercentual')}
                      data-testid="button-sort-margem-pct"
                    >
                      Margem (%) <SortIcon field="margemPercentual" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum dado disponível'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedClientes.map((cliente, idx) => {
                    const rowKey = `cliente-${idx}`;
                    const isExpanded = expandedRows.has(rowKey);
                    const hasDetails = (cliente.receitaDetalhes?.length > 0) || (cliente.freelancerDetalhes?.length > 0);
                    
                    return (
                      <Fragment key={rowKey}>
                        <TableRow data-testid={`row-cliente-${idx}`} className={hasDetails ? 'cursor-pointer hover:bg-muted/50' : ''} onClick={() => hasDetails && toggleRow(rowKey)}>
                          <TableCell className="w-8 p-2">
                            {hasDetails && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-expand-${idx}`} onClick={(e) => { e.stopPropagation(); toggleRow(rowKey); }}>
                                <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{cliente.nomeCliente}</div>
                              <div className="text-xs text-muted-foreground">{cliente.cnpj}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatCurrency(cliente.receita)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(cliente.despesaSalarioRateado)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(cliente.despesaFreelancers)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(cliente.despesaOperacional)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {formatCurrency(cliente.despesaTotal)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${cliente.margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(cliente.margem)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={cliente.margemPercentual >= 0 ? 'default' : 'destructive'}>
                              {formatPercent(cliente.margemPercentual)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={9} className="p-4">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Seção de Receitas */}
                                <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-4">
                                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-green-500/20">
                                    <h4 className="font-bold text-green-600 flex items-center gap-2">
                                      <DollarSign className="h-5 w-5" />
                                      RECEITAS
                                    </h4>
                                    <Badge variant="default" className="bg-green-600">
                                      {formatCurrency(cliente.receita)}
                                    </Badge>
                                  </div>
                                  {cliente.receitaDetalhes?.length > 0 ? (
                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                                      {cliente.receitaDetalhes.map((d, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm bg-green-500/10 rounded px-3 py-2">
                                          <span className="truncate max-w-[65%] text-foreground" title={d.descricao}>
                                            {d.descricao}
                                          </span>
                                          <span className="font-semibold text-green-600 whitespace-nowrap">
                                            {formatCurrency(d.valor)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-muted-foreground text-sm italic py-4 text-center">
                                      Sem detalhes de receita disponíveis
                                    </div>
                                  )}
                                </div>

                                {/* Seção de Despesas */}
                                <div className="rounded-lg border-2 border-red-500/30 bg-red-500/5 p-4">
                                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-red-500/20">
                                    <h4 className="font-bold text-red-600 flex items-center gap-2">
                                      <TrendingDown className="h-5 w-5" />
                                      DESPESAS
                                    </h4>
                                    <Badge variant="destructive">
                                      {formatCurrency(cliente.despesaTotal)}
                                    </Badge>
                                  </div>
                                  <div className="space-y-3 max-h-56 overflow-y-auto pr-2">
                                    {/* Salário Rateado */}
                                    {cliente.despesaSalarioRateado > 0 && (
                                      <div className="bg-red-500/10 rounded px-3 py-2">
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="text-foreground font-medium">Salário Rateado (Time)</span>
                                          <span className="font-semibold text-red-600">
                                            {formatCurrency(cliente.despesaSalarioRateado)}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Operacional */}
                                    {cliente.despesaOperacional > 0 && (
                                      <div className="bg-red-500/10 rounded px-3 py-2">
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="text-foreground font-medium">Despesas Operacionais</span>
                                          <span className="font-semibold text-red-600">
                                            {formatCurrency(cliente.despesaOperacional)}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Freelancers - com detalhes */}
                                    {cliente.despesaFreelancers > 0 && (
                                      <div className="bg-red-500/10 rounded px-3 py-2">
                                        <div className="flex justify-between items-center text-sm mb-2">
                                          <span className="text-foreground font-medium">Freelancers</span>
                                          <span className="font-semibold text-red-600">
                                            {formatCurrency(cliente.despesaFreelancers)}
                                          </span>
                                        </div>
                                        {cliente.freelancerDetalhes?.length > 0 && (
                                          <div className="border-t border-red-500/20 pt-2 mt-2 space-y-1">
                                            {cliente.freelancerDetalhes.map((d, i) => (
                                              <div key={i} className="flex justify-between items-center text-xs pl-3 text-muted-foreground">
                                                <span className="truncate max-w-[60%]" title={d.descricao}>
                                                  • {d.descricao}
                                                </span>
                                                <span className="text-red-500 whitespace-nowrap">
                                                  {formatCurrency(d.valor)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {cliente.despesaTotal === 0 && (
                                      <div className="text-muted-foreground text-sm italic py-4 text-center">
                                        Sem despesas registradas
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Resumo da Margem */}
                              <div className="mt-4 pt-4 border-t border-border flex items-center justify-end gap-6 text-sm">
                                <span className="text-muted-foreground">
                                  Receita: <span className="text-green-600 font-semibold">{formatCurrency(cliente.receita)}</span>
                                </span>
                                <span className="text-muted-foreground">
                                  − Despesas: <span className="text-red-600 font-semibold">{formatCurrency(cliente.despesaTotal)}</span>
                                </span>
                                <span className="text-muted-foreground">
                                  = Margem: <span className={`font-bold ${cliente.margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(cliente.margem)} ({formatPercent(cliente.margemPercentual)})
                                  </span>
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
