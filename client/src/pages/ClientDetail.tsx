import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatsCard from "@/components/StatsCard";
import RevenueChart from "@/components/RevenueChart";
import { ArrowLeft, DollarSign, TrendingUp, Receipt, Loader2 } from "lucide-react";

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
}

interface RevenueData {
  mes: string;
  valor: number;
}

export default function ClientDetail() {
  const [, params] = useRoute("/cliente/:id");
  const clientId = params?.id || "";

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

  const totalReceitas = receitas?.reduce((sum, r) => sum + parseFloat(r.pago || "0"), 0) || 0;
  const totalFaturas = receitas?.length || 0;
  const ticketMedio = totalFaturas > 0 ? totalReceitas / totalFaturas : 0;

  const chartData = (revenueHistory || []).map((item) => ({
    month: item.mes,
    revenue: item.valor,
  }));

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
        return <Badge variant="default" className="bg-green-600">Pago</Badge>;
      case "PENDENTE":
        return <Badge variant="secondary">Pendente</Badge>;
      case "VENCIDO":
        return <Badge variant="destructive">Vencido</Badge>;
      default:
        return <Badge variant="outline">{status || "N/A"}</Badge>;
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
              <h1 className="text-3xl font-semibold mb-2">{cliente.nome}</h1>
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
              <Badge className={getSquadColor("Performance")} variant="outline">
                Performance
              </Badge>
              <Badge variant={cliente.ativo === "SIM" ? "default" : "secondary"}>
                {cliente.ativo === "SIM" ? "Ativo" : "Inativo"}
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
            title="Total de Faturas"
            value={totalFaturas.toString()}
            icon={Receipt}
          />
        </div>

        {isLoadingRevenue ? (
          <div className="mb-8 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="mb-8">
            <RevenueChart data={chartData} />
          </div>
        ) : null}

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">Contas a Receber</h2>
          <Card>
            {isLoadingReceitas ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Pendente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receitas && receitas.length > 0 ? (
                    receitas.slice(0, 10).map((receita, idx) => (
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
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma conta a receber encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
