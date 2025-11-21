import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  FileSearch,
  DollarSign,
  TrendingDown,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import type { AuditoriaSistemas } from "@shared/schema";

type SortField = 'nomeCliente' | 'cnpj' | 'valorClickUp' | 'valorContaAzul' | 'diferenca' | 'status';
type SortOrder = 'asc' | 'desc';

export default function AuditoriaSistemasPage() {
  const [mesAno, setMesAno] = useState<string>(new Date().toISOString().slice(0, 7));
  const [squad, setSquad] = useState<string>('todos');
  const [statusDivergencia, setStatusDivergencia] = useState<string>('todos');
  const [threshold, setThreshold] = useState<number>(5);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortField>('diferenca');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { data, isLoading } = useQuery<AuditoriaSistemas[]>({
    queryKey: ['/api/auditoria-sistemas', mesAno, squad, statusDivergencia, threshold],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (mesAno) params.append('mesAno', mesAno);
      if (squad !== 'todos') params.append('squad', squad);
      if (statusDivergencia !== 'todos') params.append('statusFiltro', statusDivergencia);
      if (threshold) params.append('threshold', threshold.toString());
      
      const res = await fetch(`/api/auditoria-sistemas?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const formatMoney = (value: number) => 
    new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);

  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];

    let filtered = [...data];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.nomeCliente.toLowerCase().includes(term) ||
        item.cnpj.includes(term)
      );
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];

      if (sortBy === 'diferenca' || sortBy === 'valorClickUp' || sortBy === 'valorContaAzul') {
        aVal = Number(aVal);
        bVal = Number(bVal);
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data, searchTerm, sortBy, sortOrder]);

  const kpis = useMemo(() => {
    if (!filteredAndSortedData || filteredAndSortedData.length === 0) {
      return {
        totalAuditados: 0,
        comDivergencia: 0,
        divergenciaTotal: 0,
        taxaProblematica: 0,
      };
    }

    const totalAuditados = filteredAndSortedData.length;
    const comDivergencia = filteredAndSortedData.filter(item => item.status !== 'ok').length;
    const divergenciaTotal = filteredAndSortedData.reduce((sum, item) => sum + Math.abs(item.diferenca), 0);
    const taxaProblematica = totalAuditados > 0 ? (comDivergencia / totalAuditados) * 100 : 0;

    return {
      totalAuditados,
      comDivergencia,
      divergenciaTotal,
      taxaProblematica,
    };
  }, [filteredAndSortedData]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const getStatusBadge = (status: 'ok' | 'alerta' | 'critico') => {
    if (status === 'ok') {
      return (
        <Badge 
          variant="default" 
          className="bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-100 border-green-300 dark:border-green-700"
          data-testid={`badge-status-ok`}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          OK
        </Badge>
      );
    } else if (status === 'alerta') {
      return (
        <Badge 
          variant="default" 
          className="bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700"
          data-testid={`badge-status-alerta`}
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          Alerta
        </Badge>
      );
    } else {
      return (
        <Badge 
          variant="destructive"
          data-testid={`badge-status-critico`}
        >
          <XCircle className="h-3 w-3 mr-1" />
          Crítico
        </Badge>
      );
    }
  };

  const getDiferencaColor = (diferenca: number) => {
    if (diferenca > 0) {
      return "text-red-600 dark:text-red-400";
    } else if (diferenca < 0) {
      return "text-green-600 dark:text-green-400";
    }
    return "";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Auditoria de Sistemas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Comparação de valores entre ClickUp e Conta Azul
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <Card data-testid="card-filtros">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
                <CardDescription className="mt-1">
                  Configure os filtros para a análise
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="periodo">
                    Período
                  </label>
                  <Input
                    id="periodo"
                    type="month"
                    value={mesAno}
                    onChange={(e) => setMesAno(e.target.value)}
                    data-testid="input-periodo"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="squad">
                    Squad
                  </label>
                  <Select value={squad} onValueChange={setSquad}>
                    <SelectTrigger id="squad" data-testid="select-squad">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Supreme">Supreme</SelectItem>
                      <SelectItem value="Forja">Forja</SelectItem>
                      <SelectItem value="Squadra">Squadra</SelectItem>
                      <SelectItem value="Chama">Chama</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="status-divergencia">
                    Status Divergência
                  </label>
                  <Select value={statusDivergencia} onValueChange={setStatusDivergencia}>
                    <SelectTrigger id="status-divergencia" data-testid="select-status-divergencia">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="ok">Sem divergência (OK)</SelectItem>
                      <SelectItem value="alerta">Alerta (5-20%)</SelectItem>
                      <SelectItem value="critico">Crítico (&gt;20%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="threshold">
                    Tolerância (%)
                  </label>
                  <Input
                    id="threshold"
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    min="0"
                    step="1"
                    data-testid="input-threshold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="search">
                    Buscar
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      type="text"
                      placeholder="Nome ou CNPJ"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-auditados">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total Auditados</CardTitle>
                <FileSearch className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-auditados">
                  {kpis.totalAuditados}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Registros analisados
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-com-divergencia">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Com Divergência</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-com-divergencia">
                  {kpis.comDivergencia}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Registros com problemas
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-divergencia-total">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Divergência Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-divergencia-total">
                  {formatMoney(kpis.divergenciaTotal)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Soma absoluta das diferenças
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-taxa-problematica">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Taxa Problemática</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-taxa-problematica">
                  {kpis.taxaProblematica.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Percentual com divergência
                </p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-tabela">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Registros de Auditoria</CardTitle>
                  <CardDescription className="mt-1">
                    {filteredAndSortedData.length} {filteredAndSortedData.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" data-testid="button-download">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12" data-testid="loading-state">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAndSortedData.length === 0 ? (
                <div className="text-center py-12" data-testid="empty-state">
                  <FileSearch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum registro encontrado</h3>
                  <p className="text-sm text-muted-foreground">
                    Tente ajustar os filtros ou período selecionado
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer select-none hover-elevate"
                          onClick={() => handleSort('nomeCliente')}
                          data-testid="header-cliente"
                        >
                          <div className="flex items-center">
                            Cliente
                            {getSortIcon('nomeCliente')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover-elevate"
                          onClick={() => handleSort('cnpj')}
                          data-testid="header-cnpj"
                        >
                          <div className="flex items-center">
                            CNPJ
                            {getSortIcon('cnpj')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer select-none hover-elevate"
                          onClick={() => handleSort('valorClickUp')}
                          data-testid="header-clickup"
                        >
                          <div className="flex items-center justify-end">
                            ClickUp
                            {getSortIcon('valorClickUp')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer select-none hover-elevate"
                          onClick={() => handleSort('valorContaAzul')}
                          data-testid="header-conta-azul"
                        >
                          <div className="flex items-center justify-end">
                            Conta Azul
                            {getSortIcon('valorContaAzul')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer select-none hover-elevate"
                          onClick={() => handleSort('diferenca')}
                          data-testid="header-diferenca"
                        >
                          <div className="flex items-center justify-end">
                            Diferença
                            {getSortIcon('diferenca')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover-elevate"
                          onClick={() => handleSort('status')}
                          data-testid="header-status"
                        >
                          <div className="flex items-center">
                            Status
                            {getSortIcon('status')}
                          </div>
                        </TableHead>
                        <TableHead data-testid="header-acoes">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedData.map((item) => (
                        <TableRow 
                          key={item.cnpj} 
                          className="hover-elevate"
                          data-testid={`row-${item.cnpj}`}
                        >
                          <TableCell className="font-medium" data-testid={`cell-cliente-${item.cnpj}`}>
                            {item.nomeCliente}
                          </TableCell>
                          <TableCell className="font-mono text-sm" data-testid={`cell-cnpj-${item.cnpj}`}>
                            {item.cnpj}
                          </TableCell>
                          <TableCell className="text-right" data-testid={`cell-clickup-${item.cnpj}`}>
                            {formatMoney(item.valorClickUp)}
                          </TableCell>
                          <TableCell className="text-right" data-testid={`cell-conta-azul-${item.cnpj}`}>
                            {formatMoney(item.valorContaAzul)}
                          </TableCell>
                          <TableCell 
                            className={`text-right font-medium ${getDiferencaColor(item.diferenca)}`}
                            data-testid={`cell-diferenca-${item.cnpj}`}
                          >
                            {formatMoney(item.diferenca)}
                          </TableCell>
                          <TableCell data-testid={`cell-status-${item.cnpj}`}>
                            {getStatusBadge(item.status)}
                          </TableCell>
                          <TableCell data-testid={`cell-acoes-${item.cnpj}`}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-detalhes-${item.cnpj}`}
                            >
                              Ver Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
