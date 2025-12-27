import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Cake, Briefcase, TrendingUp, Clock, Users, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Heart, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { formatDecimal } from "@/lib/utils";

type SortDirection = "asc" | "desc";
type PromocaoSortColumn = "nome" | "cargo" | "squad" | "ultimoAumento" | "mesesDesdeAumento";

interface AniversariantesMes {
  id: number;
  nome: string;
  aniversario: string;
  cargo: string | null;
  squad: string | null;
  diasAteAniversario: number;
}

interface AniversarioEmpresaMes {
  id: number;
  nome: string;
  admissao: string;
  cargo: string | null;
  squad: string | null;
  anosDeEmpresa: number;
  diasAteAniversarioEmpresa: number;
}

interface UltimaPromocao {
  id: number;
  nome: string;
  cargo: string | null;
  squad: string | null;
  ultimoAumento: string | null;
  mesesDesdeAumento: number | null;
}

interface TempoMedioPromocao {
  tempoMedioMeses: number;
  totalColaboradores: number;
}

interface TempoPermanencia {
  tempoPermanenciaAtivos: number;
  totalAtivos: number;
  tempoPermanenciaDesligados: number;
  totalDesligados: number;
}

interface ColaboradorSaude {
  id: number;
  nome: string;
  cargo: string | null;
  squad: string | null;
  healthScore: number;
  lastEnpsScore: number | null;
  daysSinceOneOnOne: number | null;
  pdiProgress: number | null;
  pendingActions: number;
}

interface DashboardAnaliseData {
  aniversariantesMes: AniversariantesMes[];
  aniversarioEmpresaMes: AniversarioEmpresaMes[];
  ultimasPromocoes: UltimaPromocao[];
  tempoMedioPromocao: TempoMedioPromocao;
  tempoPermanencia: TempoPermanencia;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

const squadIcons: Record<string, string> = {
  'Vendas': '💰 Vendas',
  'Selva': '🪖 Selva',
  'Squadra': '⚓️ Squadra',
  'Pulse': '💠 Pulse',
  'Squad X': '👾 Squad X',
  'Tech': '🖥️ Tech',
  'CX&CS': '📊 CX&CS',
  'Turbo Interno': '🚀 Turbo Interno',
  'Ventures': '⭐️ Ventures',
  'Chama': '🔥 Chama (OFF)',
  'Hunters': '🏹 Hunters (OFF)',
  'Fragmentados': '🧩 Fragmentados (OFF)',
  'Makers': '🛠️ Makers',
};

const squadColors: Record<string, string> = {
  '💰 Vendas': "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  '🪖 Selva': "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  '⚓️ Squadra': "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  '💠 Pulse': "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  '👾 Squad X': "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  '🖥️ Tech': "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  '📊 CX&CS': "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  '🚀 Turbo Interno': "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  '⭐️ Ventures': "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  '🔥 Chama (OFF)': "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  '🏹 Hunters (OFF)': "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  '🧩 Fragmentados (OFF)': "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  '🛠️ Makers': "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const formatSquadName = (squad: string | null | undefined): string => {
  if (!squad) return "-";
  const cleanSquad = squad.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u2693]/gu, '').trim();
  return squadIcons[cleanSquad] || squad;
};

function getInitials(nome: string) {
  if (!nome) return "??";
  return nome
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";
  const bgColor = score >= 80 ? "stroke-green-500" : score >= 50 ? "stroke-yellow-500" : "stroke-red-500";
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative w-20 h-20">
      <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          className="text-muted/20"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className={bgColor}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center font-bold text-lg ${color}`}>
        {score}
      </div>
    </div>
  );
}

export default function ColaboradoresAnalise() {
  usePageTitle("Análise de Colaboradores");
  useSetPageInfo("Análise de Colaboradores", "Dashboard com métricas e indicadores de recursos humanos");
  const { data, isLoading } = useQuery<DashboardAnaliseData>({
    queryKey: ["/api/colaboradores/analise"],
  });

  const { data: healthData = [], isLoading: isLoadingHealth } = useQuery<ColaboradorSaude[]>({
    queryKey: ["/api/colaboradores/saude"],
  });

  const [sortColumn, setSortColumn] = useState<PromocaoSortColumn>("mesesDesdeAumento");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [healthSquadFilter, setHealthSquadFilter] = useState<string>("all");
  const [healthSortOrder, setHealthSortOrder] = useState<"asc" | "desc">("asc");

  const uniqueSquads = useMemo(() => {
    const squads = new Set<string>();
    healthData.forEach((c) => {
      if (c.squad) squads.add(c.squad);
    });
    return Array.from(squads).sort();
  }, [healthData]);

  const filteredHealthData = useMemo(() => {
    let filtered = [...healthData];
    if (healthSquadFilter !== "all") {
      filtered = filtered.filter((c) => c.squad === healthSquadFilter);
    }
    filtered.sort((a, b) => 
      healthSortOrder === "asc" ? a.healthScore - b.healthScore : b.healthScore - a.healthScore
    );
    return filtered;
  }, [healthData, healthSquadFilter, healthSortOrder]);

  const criticalColabs = useMemo(() => 
    filteredHealthData.filter((c) => c.healthScore < 50).sort((a, b) => a.healthScore - b.healthScore), 
  [filteredHealthData]);

  const criticalCount = criticalColabs.length;

  const healthStats = useMemo(() => ({
    total: filteredHealthData.length,
    healthy: filteredHealthData.filter((c) => c.healthScore >= 80).length,
    attention: filteredHealthData.filter((c) => c.healthScore >= 50 && c.healthScore < 80).length,
    critical: criticalCount,
  }), [filteredHealthData, criticalCount]);

  const handleSort = (column: PromocaoSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: PromocaoSortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-4 h-4 ml-1" />;
    return sortDirection === "asc" ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  const aniversariantesMes = data?.aniversariantesMes || [];
  const aniversarioEmpresaMes = data?.aniversarioEmpresaMes || [];
  const ultimasPromocoes = data?.ultimasPromocoes || [];
  const tempoMedioPromocao = data?.tempoMedioPromocao || { tempoMedioMeses: 0, totalColaboradores: 0 };
  const tempoPermanencia = data?.tempoPermanencia || {
    tempoPermanenciaAtivos: 0,
    totalAtivos: 0,
    tempoPermanenciaDesligados: 0,
    totalDesligados: 0,
  };

  const sortedPromocoes = useMemo(() => {
    const sorted = [...ultimasPromocoes].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case "nome":
          aVal = a.nome?.toLowerCase() || "";
          bVal = b.nome?.toLowerCase() || "";
          break;
        case "cargo":
          aVal = a.cargo?.toLowerCase() || "";
          bVal = b.cargo?.toLowerCase() || "";
          break;
        case "squad":
          aVal = a.squad?.toLowerCase() || "";
          bVal = b.squad?.toLowerCase() || "";
          break;
        case "ultimoAumento":
          aVal = a.ultimoAumento ? new Date(a.ultimoAumento).getTime() : 0;
          bVal = b.ultimoAumento ? new Date(b.ultimoAumento).getTime() : 0;
          break;
        case "mesesDesdeAumento":
          aVal = a.mesesDesdeAumento ?? 999;
          bVal = b.mesesDesdeAumento ?? 999;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [ultimasPromocoes, sortColumn, sortDirection]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-analise" />
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <Link href="/colaboradores">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Colaboradores
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          {/* Métricas de Tempo Médio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-tempo-medio-promocao">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  Tempo Médio de Promoção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDecimal(tempoMedioPromocao.tempoMedioMeses, 1)} meses
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tempoMedioPromocao.totalColaboradores} colaboradores com histórico
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-tempo-permanencia-ativos">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Tempo Médio - Ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDecimal(tempoPermanencia.tempoPermanenciaAtivos, 1)} meses
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tempoPermanencia.totalAtivos} colaboradores ativos
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-tempo-permanencia-desligados">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Tempo Médio - Desligados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDecimal(tempoPermanencia.tempoPermanenciaDesligados, 1)} meses
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tempoPermanencia.totalDesligados} colaboradores desligados
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Aniversariantes do Mês */}
          <Card data-testid="card-aniversariantes-mes">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cake className="w-5 h-5" />
                Aniversariantes do Mês
              </CardTitle>
              <CardDescription>
                Colaboradores que fazem aniversário este mês
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aniversariantesMes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum aniversariante este mês
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Aniversário</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Squad</TableHead>
                        <TableHead className="text-right">Dias até</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aniversariantesMes.map((pessoa) => (
                        <TableRow key={pessoa.id} data-testid={`row-aniversariante-${pessoa.id}`}>
                          <TableCell className="font-medium">{pessoa.nome}</TableCell>
                          <TableCell>{formatDate(pessoa.aniversario)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pessoa.cargo || "-"}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const formattedSquad = formatSquadName(pessoa.squad);
                              return formattedSquad !== "-" && squadColors[formattedSquad] ? (
                                <Badge className={squadColors[formattedSquad]} variant="outline">
                                  {formattedSquad}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {formattedSquad}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            {pessoa.diasAteAniversario === 0 ? (
                              <Badge variant="default">Hoje</Badge>
                            ) : pessoa.diasAteAniversario < 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {Math.abs(pessoa.diasAteAniversario)}d atrás
                              </span>
                            ) : (
                              <span className="text-sm">
                                {pessoa.diasAteAniversario}d
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aniversário de Empresa do Mês */}
          <Card data-testid="card-aniversario-empresa-mes">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Aniversário de Empresa do Mês
              </CardTitle>
              <CardDescription>
                Colaboradores que completam anos de empresa este mês
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aniversarioEmpresaMes.filter(a => a.anosDeEmpresa > 0).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum aniversário de empresa este mês
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Admissão</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Squad</TableHead>
                        <TableHead className="text-right">Anos</TableHead>
                        <TableHead className="text-right">Dias até</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aniversarioEmpresaMes.filter(a => a.anosDeEmpresa > 0).map((pessoa) => (
                        <TableRow key={pessoa.id} data-testid={`row-aniversario-empresa-${pessoa.id}`}>
                          <TableCell className="font-medium">{pessoa.nome}</TableCell>
                          <TableCell>{formatDate(pessoa.admissao)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pessoa.cargo || "-"}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const formattedSquad = formatSquadName(pessoa.squad);
                              return formattedSquad !== "-" && squadColors[formattedSquad] ? (
                                <Badge className={squadColors[formattedSquad]} variant="outline">
                                  {formattedSquad}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {formattedSquad}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            {pessoa.anosDeEmpresa > 0 && (
                              <Badge variant="secondary">{pessoa.anosDeEmpresa} {pessoa.anosDeEmpresa === 1 ? 'ano' : 'anos'}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {pessoa.diasAteAniversarioEmpresa === 0 ? (
                              <Badge variant="default">Hoje</Badge>
                            ) : pessoa.diasAteAniversarioEmpresa < 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {Math.abs(pessoa.diasAteAniversarioEmpresa)}d atrás
                              </span>
                            ) : (
                              <span className="text-sm">
                                {pessoa.diasAteAniversarioEmpresa}d
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Última Promoção */}
          <Card data-testid="card-ultimas-promocoes">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Última Promoção
              </CardTitle>
              <CardDescription>
                Tempo desde a última promoção de cada colaborador
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ultimasPromocoes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro de promoção encontrado
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("nome")}
                          data-testid="th-sort-nome"
                        >
                          <div className="flex items-center">
                            Nome {getSortIcon("nome")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("cargo")}
                          data-testid="th-sort-cargo"
                        >
                          <div className="flex items-center">
                            Cargo Atual {getSortIcon("cargo")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("squad")}
                          data-testid="th-sort-squad"
                        >
                          <div className="flex items-center">
                            Squad {getSortIcon("squad")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort("ultimoAumento")}
                          data-testid="th-sort-ultima-promocao"
                        >
                          <div className="flex items-center">
                            Última Promoção {getSortIcon("ultimoAumento")}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 select-none text-right"
                          onClick={() => handleSort("mesesDesdeAumento")}
                          data-testid="th-sort-meses"
                        >
                          <div className="flex items-center justify-end">
                            Meses Desde {getSortIcon("mesesDesdeAumento")}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPromocoes.map((pessoa) => (
                        <TableRow key={pessoa.id} data-testid={`row-promocao-${pessoa.id}`}>
                          <TableCell className="font-medium">{pessoa.nome}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pessoa.cargo || "-"}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const formattedSquad = formatSquadName(pessoa.squad);
                              return formattedSquad !== "-" && squadColors[formattedSquad] ? (
                                <Badge className={squadColors[formattedSquad]} variant="outline">
                                  {formattedSquad}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {formattedSquad}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>{formatDate(pessoa.ultimoAumento)}</TableCell>
                          <TableCell className="text-right">
                            {pessoa.mesesDesdeAumento !== null ? (
                              <Badge
                                variant={
                                  pessoa.mesesDesdeAumento >= 24
                                    ? "destructive"
                                    : pessoa.mesesDesdeAumento >= 18
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {pessoa.mesesDesdeAumento} meses
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saúde dos Colaboradores */}
          <Card data-testid="card-saude-colaboradores">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  <CardTitle>Saúde dos Colaboradores</CardTitle>
                  {criticalCount > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1" data-testid="badge-critical-count">
                      <AlertTriangle className="w-3 h-3" />
                      {criticalCount} crítico{criticalCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={healthSquadFilter} onValueChange={setHealthSquadFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-squad-filter">
                      <SelectValue placeholder="Filtrar por Squad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Squads</SelectItem>
                      {uniqueSquads.map((squad) => (
                        <SelectItem key={squad} value={squad}>
                          {formatSquadName(squad)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHealthSortOrder(healthSortOrder === "asc" ? "desc" : "asc")}
                    data-testid="button-sort-health"
                  >
                    {healthSortOrder === "asc" ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
                    Score
                  </Button>
                </div>
              </div>
              <CardDescription>
                Score de saúde calculado a partir de E-NPS, 1x1, PDI e ações pendentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Critical Alert Banner */}
              {criticalCount > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50" data-testid="alert-critical-banner">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-300 text-sm">
                        {criticalCount} colaborador{criticalCount !== 1 ? 'es' : ''} precisa{criticalCount === 1 ? '' : 'm'} de atenção urgente
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {criticalColabs.slice(0, 5).map((c) => (
                          <Link key={c.id} href={`/colaborador/${c.id}`}>
                            <Badge 
                              variant="outline" 
                              className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 cursor-pointer hover:bg-red-200 dark:hover:bg-red-900/60"
                              data-testid={`badge-critical-${c.id}`}
                            >
                              {c.nome.split(' ')[0]} ({c.healthScore})
                            </Badge>
                          </Link>
                        ))}
                        {criticalCount > 5 && (
                          <Badge variant="outline" className="text-xs text-red-600 dark:text-red-400">
                            +{criticalCount - 5} mais
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats Summary Row */}
              {!isLoadingHealth && healthData.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4" data-testid="stats-row">
                  <Badge variant="outline" className="text-xs px-2 py-1">
                    <Users className="w-3 h-3 mr-1" />
                    Total: {healthStats.total}
                  </Badge>
                  <Badge className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Saudáveis: {healthStats.healthy}
                  </Badge>
                  <Badge className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Atenção: {healthStats.attention}
                  </Badge>
                  <Badge className="text-xs px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    Críticos: {healthStats.critical}
                  </Badge>
                </div>
              )}
              {isLoadingHealth ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredHealthData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum colaborador encontrado
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredHealthData.map((colab) => {
                    const formattedSquad = formatSquadName(colab.squad);
                    const isCritical = colab.healthScore < 50;
                    return (
                      <Link key={colab.id} href={`/colaborador/${colab.id}`}>
                        <Card
                          className={`hover-elevate cursor-pointer transition-all relative ${isCritical ? 'ring-2 ring-red-400 dark:ring-red-600 ring-offset-2 ring-offset-background' : ''}`}
                          data-testid={`card-health-${colab.id}`}
                        >
                          {isCritical && (
                            <Badge 
                              className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0 bg-red-500 text-white border-0 z-10"
                              data-testid={`badge-critico-${colab.id}`}
                            >
                              Crítico
                            </Badge>
                          )}
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="text-xs bg-muted">
                                  {getInitials(colab.nome)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate" data-testid={`text-name-${colab.id}`}>
                                  {colab.nome}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {colab.cargo || "-"}
                                </p>
                                {formattedSquad !== "-" && squadColors[formattedSquad] && (
                                  <Badge
                                    className={`${squadColors[formattedSquad]} mt-1 text-[10px] px-1.5 py-0`}
                                    variant="outline"
                                  >
                                    {formattedSquad}
                                  </Badge>
                                )}
                              </div>
                              <HealthGauge score={colab.healthScore} />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
