import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Search,
  ExternalLink,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import type { TurbodashListResponse } from "@shared/schema";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function VariationBadge({ value }: { value: number }) {
  if (value === 0) return null;
  
  const isPositive = value >= 0;
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-xs font-medium ml-2",
        isPositive 
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" 
          : "border-rose-500/30 bg-rose-500/10 text-rose-500"
      )}
    >
      {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
      {Math.abs(value).toFixed(1)}%
    </Badge>
  );
}

export default function TurbodashOverview() {
  const [search, setSearch] = useState("");
  
  const { data, isLoading, isError, refetch, isFetching } = useQuery<TurbodashListResponse>({
    queryKey: ['/api/integrations/turbodash/overview'],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  
  const filteredClientes = useMemo(() => {
    if (!data?.clientes) return [];
    
    const searchLower = search.toLowerCase();
    return data.clientes.filter(cliente => 
      cliente.nome_cliente.toLowerCase().includes(searchLower) ||
      cliente.cnpj.includes(search.replace(/\D/g, ''))
    );
  }, [data?.clientes, search]);
  
  const totals = useMemo(() => {
    if (!data?.clientes) return null;
    
    return data.clientes.reduce((acc, cliente) => ({
      faturamento: acc.faturamento + cliente.kpis.faturamento,
      investimento: acc.investimento + cliente.kpis.investimento,
      compras: acc.compras + cliente.kpis.compras,
    }), { faturamento: 0, investimento: 0, compras: 0 });
  }, [data?.clientes]);
  
  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isError) {
    return (
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Erro ao carregar dados</h3>
            <p className="text-muted-foreground mt-1">Não foi possível conectar ao TurboDash.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => refetch()}
              data-testid="button-retry-overview"
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto" data-testid="page-turbodash-overview">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="title-turbodash">
              Performance TurboDash
            </h1>
            <p className="text-sm text-muted-foreground">
              {data && `${data.total} clientes · ${new Date(data.periodo_inicio).toLocaleDateString('pt-BR')} a ${new Date(data.periodo_fim).toLocaleDateString('pt-BR')}`}
            </p>
          </div>
        </div>
        <Button 
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-overview"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>
      
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Faturamento Total</p>
              <p className="text-2xl font-bold text-foreground mt-1" data-testid="total-faturamento">
                {formatCurrency(totals.faturamento)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Investimento Total</p>
              <p className="text-2xl font-bold text-foreground mt-1" data-testid="total-investimento">
                {formatCurrency(totals.investimento)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total de Compras</p>
              <p className="text-2xl font-bold text-foreground mt-1" data-testid="total-compras">
                {formatNumber(totals.compras)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>Performance individual de cada cliente</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-cliente"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">Compras</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search ? "Nenhum cliente encontrado" : "Nenhum dado disponível"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClientes.map((cliente) => (
                    <TableRow key={cliente.cnpj} data-testid={`row-cliente-${cliente.cnpj}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{cliente.nome_cliente}</p>
                          <p className="text-xs text-muted-foreground">{cliente.cnpj}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          {formatCurrency(cliente.kpis.faturamento)}
                          <VariationBadge value={cliente.kpis.faturamento_variacao} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          {formatCurrency(cliente.kpis.investimento)}
                          <VariationBadge value={cliente.kpis.investimento_variacao} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          {cliente.kpis.roas.toFixed(2)}x
                          <VariationBadge value={cliente.kpis.roas_variacao} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          {formatNumber(cliente.kpis.compras)}
                          <VariationBadge value={cliente.kpis.compras_variacao} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          {formatCurrency(cliente.kpis.cpa)}
                          <VariationBadge value={cliente.kpis.cpa_variacao} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          {formatCurrency(cliente.kpis.ticket_medio)}
                          <VariationBadge value={cliente.kpis.ticket_medio_variacao} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/cliente/${cliente.cnpj}`}>
                          <Button variant="ghost" size="icon" data-testid={`button-view-${cliente.cnpj}`}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
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
