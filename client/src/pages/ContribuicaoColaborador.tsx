import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersRound, DollarSign, TrendingUp, Building2, Users } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";

interface ContribuicaoData {
  responsavel: string;
  faturamentoBruto: number;
  quantidadeClientes: number;
  quantidadeParcelas: number;
}

const COLORS = ['#f97316', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c'];

export default function ContribuicaoColaborador() {
  usePageTitle("Contribuição por Colaborador");
  useSetPageInfo("Contribuição por Colaborador", "Faturamento bruto atribuído a cada responsável");
  
  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  
  const { data: contribuicaoData, isLoading } = useQuery<ContribuicaoData[]>({
    queryKey: ["/api/contribuicao-colaborador", mesSelecionado, anoSelecionado],
    queryFn: async () => {
      const response = await fetch(`/api/contribuicao-colaborador?mes=${mesSelecionado}&ano=${anoSelecionado}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Falha ao buscar dados");
      return response.json();
    },
  });
  
  const totais = useMemo(() => {
    if (!contribuicaoData || contribuicaoData.length === 0) {
      return { faturamentoTotal: 0, totalClientes: 0, totalParcelas: 0, qtdResponsaveis: 0 };
    }
    
    return {
      faturamentoTotal: contribuicaoData.reduce((acc, item) => acc + item.faturamentoBruto, 0),
      totalClientes: contribuicaoData.reduce((acc, item) => acc + item.quantidadeClientes, 0),
      totalParcelas: contribuicaoData.reduce((acc, item) => acc + item.quantidadeParcelas, 0),
      qtdResponsaveis: contribuicaoData.length
    };
  }, [contribuicaoData]);
  
  const chartData = useMemo(() => {
    if (!contribuicaoData) return [];
    return contribuicaoData
      .slice(0, 10)
      .map((item, index) => ({
        name: item.responsavel.length > 15 ? item.responsavel.substring(0, 15) + '...' : item.responsavel,
        fullName: item.responsavel,
        valor: item.faturamentoBruto,
        clientes: item.quantidadeClientes,
        parcelas: item.quantidadeParcelas,
        percentual: totais.faturamentoTotal > 0 ? ((item.faturamentoBruto / totais.faturamentoTotal) * 100) : 0,
        fill: COLORS[index % COLORS.length]
      }));
  }, [contribuicaoData, totais.faturamentoTotal]);
  
  const meses = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" },
  ];
  
  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i);
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm">{data.fullName}</p>
          <p className="text-sm text-muted-foreground">
            Faturamento: <span className="font-medium text-foreground">{formatCurrency(data.valor)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Clientes: <span className="font-medium text-foreground">{data.clientes}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Parcelas: <span className="font-medium text-foreground">{data.parcelas}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Percentual: <span className="font-medium text-foreground">{data.percentual.toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Contribuição por Colaborador</h1>
          <p className="text-muted-foreground">Faturamento bruto recebido por responsável no período</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select 
            value={mesSelecionado.toString()} 
            onValueChange={(val) => setMesSelecionado(parseInt(val))}
          >
            <SelectTrigger className="w-[140px]" data-testid="select-mes">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {meses.map((mes) => (
                <SelectItem key={mes.value} value={mes.value.toString()}>
                  {mes.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select 
            value={anoSelecionado.toString()} 
            onValueChange={(val) => setAnoSelecionado(parseInt(val))}
          >
            <SelectTrigger className="w-[100px]" data-testid="select-ano">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {anos.map((ano) => (
                <SelectItem key={ano} value={ano.toString()}>
                  {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Bruto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-primary" data-testid="text-faturamento-total">
                {formatCurrencyCompact(totais.faturamentoTotal)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Valor total recebido no mês
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Responsáveis</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-responsaveis">
                {totais.qtdResponsaveis}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Com faturamento no período
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-clientes">
                {totais.totalClientes}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Clientes únicos atendidos
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-ticket-medio">
                {totais.qtdResponsaveis > 0 
                  ? formatCurrencyCompact(totais.faturamentoTotal / totais.qtdResponsaveis) 
                  : 'R$ 0'}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Média por responsável
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 10 Responsáveis por Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[350px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Nenhum dado encontrado para o período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => formatCurrencyCompact(value)}
                    fontSize={12}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={120}
                    fontSize={12}
                    tickLine={false}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição do Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[350px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Nenhum dado encontrado para o período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="valor"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={60}
                    label={({ name, percentual }) => `${name} (${percentual.toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento por Responsável</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !contribuicaoData || contribuicaoData.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum dado encontrado para o período selecionado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Faturamento Bruto</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Parcelas</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contribuicaoData.map((item, index) => {
                    const percentual = totais.faturamentoTotal > 0 
                      ? ((item.faturamentoBruto / totais.faturamentoTotal) * 100) 
                      : 0;
                    const ticketMedio = item.quantidadeClientes > 0 
                      ? item.faturamentoBruto / item.quantidadeClientes 
                      : 0;
                    
                    return (
                      <TableRow key={item.responsavel} data-testid={`row-responsavel-${index}`}>
                        <TableCell className="font-medium">
                          {index < 3 ? (
                            <Badge variant={index === 0 ? "default" : "secondary"}>
                              {index + 1}º
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{item.responsavel}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {formatCurrency(item.faturamentoBruto)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{percentual.toFixed(1)}%</Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.quantidadeClientes}</TableCell>
                        <TableCell className="text-right">{item.quantidadeParcelas}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(ticketMedio)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
