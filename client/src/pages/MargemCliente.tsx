import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  Loader2, TrendingUp, TrendingDown, DollarSign, Users, Percent, 
  Building2, Search, ArrowUpDown, ChevronUp, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MargemClienteResumo, MargemClienteItem } from "@shared/schema";

type SortField = 'nomeCliente' | 'receita' | 'despesaTotal' | 'margem' | 'margemPercentual';
type SortDirection = 'asc' | 'desc';

export default function MargemCliente() {
  usePageTitle("Margem por Cliente");
  useSetPageInfo("Margem por Cliente", "Análise de margem e rentabilidade por cliente");
  
  const hoje = new Date();
  const [mesAno, setMesAno] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('receita');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { data, isLoading } = useQuery<MargemClienteResumo>({
    queryKey: ["/api/financeiro/margem-clientes", mesAno],
    queryFn: async () => {
      const response = await fetch(`/api/financeiro/margem-clientes?mesAno=${mesAno}`);
      if (!response.ok) throw new Error('Failed to fetch margem por cliente');
      return response.json();
    },
  });

  const mesesOpcoes = useMemo(() => {
    const opcoes = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const label = `${mesesNomes[d.getMonth()]}/${d.getFullYear()}`;
      opcoes.push({ value, label });
    }
    return opcoes;
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
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
        <Select value={mesAno} onValueChange={setMesAno}>
          <SelectTrigger className="w-[180px]" data-testid="select-mes-ano">
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent>
            {mesesOpcoes.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum dado disponível'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedClientes.map((cliente, idx) => (
                    <TableRow key={cliente.cnpj || idx} data-testid={`row-cliente-${idx}`}>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
