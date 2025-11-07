import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, TrendingUp, UserPlus, UserMinus, Clock, Cake, Calendar } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GegOverview, GegHeadcountTrend, GegDemissoesBreakdown, TempoMedioPromocaoPorSquad } from "@shared/schema";

export default function DashboardGEG() {
  const [periodo, setPeriodo] = useState<string>("ytd");
  const [squad, setSquad] = useState<string>("todos");
  const [setor, setSetor] = useState<string>("todos");

  const { mesInicio, mesFim } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    switch (periodo) {
      case "mes-atual":
        return {
          mesInicio: new Date(year, month, 1).toISOString().split('T')[0],
          mesFim: new Date(year, month + 1, 0).toISOString().split('T')[0],
        };
      case "trimestre":
        const quarterStart = Math.floor(month / 3) * 3;
        return {
          mesInicio: new Date(year, quarterStart, 1).toISOString().split('T')[0],
          mesFim: new Date(year, quarterStart + 3, 0).toISOString().split('T')[0],
        };
      case "ytd":
        return {
          mesInicio: `${year}-01-01`,
          mesFim: new Date().toISOString().split('T')[0],
        };
      case "ano-passado":
        return {
          mesInicio: `${year - 1}-01-01`,
          mesFim: `${year - 1}-12-31`,
        };
      default:
        return { mesInicio: undefined, mesFim: undefined };
    }
  }, [periodo]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (mesInicio) params.append('mesInicio', mesInicio);
    if (mesFim) params.append('mesFim', mesFim);
    if (squad !== 'todos') params.append('squad', squad);
    if (setor !== 'todos') params.append('setor', setor);
    return params.toString();
  }, [mesInicio, mesFim, squad, setor]);

  const { data: overview, isLoading: isLoadingOverview } = useQuery<GegOverview>({
    queryKey: ['/api/geg/overview', queryParams],
  });

  const { data: headcountTrend, isLoading: isLoadingTrend } = useQuery<GegHeadcountTrend[]>({
    queryKey: ['/api/geg/headcount-trend', queryParams],
  });

  const { data: demissoesBreakdown, isLoading: isLoadingBreakdown } = useQuery<GegDemissoesBreakdown[]>({
    queryKey: ['/api/geg/demissoes-breakdown', queryParams],
  });

  const { data: tempoMedioPromocao, isLoading: isLoadingPromocao } = useQuery<TempoMedioPromocaoPorSquad[]>({
    queryKey: ['/api/geg/tempo-medio-promocao', queryParams],
  });

  const formatNumber = (value: number, decimals: number = 0) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const isLoading = isLoadingOverview || isLoadingTrend || isLoadingBreakdown || isLoadingPromocao;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-title">Dashboard GEG</h1>
          <p className="text-muted-foreground">Gestão Estratégica de Pessoas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Período</label>
          <Select value={periodo} onValueChange={setPeriodo} data-testid="select-periodo">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes-atual">Mês Atual</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="ytd">YTD (Ano até hoje)</SelectItem>
              <SelectItem value="ano-passado">Ano Passado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Squad</label>
          <Select value={squad} onValueChange={setSquad} data-testid="select-squad">
            <SelectTrigger>
              <SelectValue />
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
          <label className="text-sm font-medium">Setor</label>
          <Select value={setor} onValueChange={setSetor} data-testid="select-setor">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Comercial">Comercial</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="Desenvolvimento">Desenvolvimento</SelectItem>
              <SelectItem value="Atendimento">Atendimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-dashboard" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card data-testid="card-headcount-atual">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Headcount Atual</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-headcount-atual">
                  {formatNumber(overview?.headcountAtual || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Colaboradores ativos
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-turnover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Turnover</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-turnover">
                  {formatNumber(overview?.turnoverPeriodo || 0, 1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  No período selecionado
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-admissoes">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Admissões</CardTitle>
                <UserPlus className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-admissoes">
                  {formatNumber(overview?.admissoesPeriodo || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  No período selecionado
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-demissoes">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Demissões</CardTitle>
                <UserMinus className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-demissoes">
                  {formatNumber(overview?.demissoesPeriodo || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  No período selecionado
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-tempo-medio-ativo">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tempo Médio Ativo</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-tempo-medio-ativo">
                  {formatNumber(overview?.tempoMedioAtivoMeses || 0, 1)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Meses de permanência
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-headcount-trend">
              <CardHeader>
                <CardTitle>Evolução do Headcount</CardTitle>
                <CardDescription>Histórico de colaboradores, admissões e demissões</CardDescription>
              </CardHeader>
              <CardContent>
                {headcountTrend && headcountTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={headcountTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="headcount" stroke="#8884d8" name="Headcount" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <p className="text-muted-foreground">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-admissoes-demissoes">
              <CardHeader>
                <CardTitle>Admissões vs Demissões</CardTitle>
                <CardDescription>Comparação mensal de entradas e saídas</CardDescription>
              </CardHeader>
              <CardContent>
                {headcountTrend && headcountTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={headcountTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="admissoes" fill="#10b981" name="Admissões" />
                      <Bar dataKey="demissoes" fill="#ef4444" name="Demissões" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <p className="text-muted-foreground">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-tempo-medio-promocao">
            <CardHeader>
              <CardTitle>Tempo Médio de Promoção por Squad</CardTitle>
              <CardDescription>Média de meses entre admissão e última promoção</CardDescription>
            </CardHeader>
            <CardContent>
              {tempoMedioPromocao && tempoMedioPromocao.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tempoMedioPromocao} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="squad" type="category" width={100} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tempoMedioMeses" fill="#8b5cf6" name="Tempo Médio (meses)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px]">
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-aniversariantes">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Cake className="h-5 w-5" />
                  <CardTitle>Aniversariantes do Mês</CardTitle>
                </div>
                <CardDescription>Colaboradores que fazem aniversário este mês</CardDescription>
              </CardHeader>
              <CardContent>
                {overview?.aniversariantes && overview.aniversariantes.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead data-testid="header-nome">Nome</TableHead>
                          <TableHead data-testid="header-data">Data</TableHead>
                          <TableHead data-testid="header-cargo">Cargo</TableHead>
                          <TableHead data-testid="header-squad">Squad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overview.aniversariantes.map((aniv) => (
                          <TableRow key={aniv.id} data-testid={`row-aniversariante-${aniv.id}`}>
                            <TableCell className="font-medium" data-testid={`cell-nome-${aniv.id}`}>{aniv.nome}</TableCell>
                            <TableCell data-testid={`cell-data-${aniv.id}`}>{formatDate(aniv.aniversario)}</TableCell>
                            <TableCell data-testid={`cell-cargo-${aniv.id}`}>{aniv.cargo || '-'}</TableCell>
                            <TableCell data-testid={`cell-squad-${aniv.id}`}>{aniv.squad || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px]">
                    <p className="text-muted-foreground">Nenhum aniversariante este mês</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-aniversarios-empresa">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <CardTitle>Próximos Aniversários de Empresa</CardTitle>
                </div>
                <CardDescription>Colaboradores que completam tempo na Turbo</CardDescription>
              </CardHeader>
              <CardContent>
                {overview?.proximosAniversariosEmpresa && overview.proximosAniversariosEmpresa.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead data-testid="header-nome-empresa">Nome</TableHead>
                          <TableHead data-testid="header-anos">Anos</TableHead>
                          <TableHead data-testid="header-dias">Em (dias)</TableHead>
                          <TableHead data-testid="header-squad-empresa">Squad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overview.proximosAniversariosEmpresa.map((aniv) => (
                          <TableRow key={aniv.id} data-testid={`row-aniversario-empresa-${aniv.id}`}>
                            <TableCell className="font-medium" data-testid={`cell-nome-empresa-${aniv.id}`}>{aniv.nome}</TableCell>
                            <TableCell data-testid={`cell-anos-${aniv.id}`}>{aniv.anosCompletos + 1} anos</TableCell>
                            <TableCell data-testid={`cell-dias-${aniv.id}`}>{aniv.diasRestantes} dias</TableCell>
                            <TableCell data-testid={`cell-squad-empresa-${aniv.id}`}>{aniv.squad || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px]">
                    <p className="text-muted-foreground">Nenhum aniversário de empresa próximo</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
