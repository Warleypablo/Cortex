import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cake, Briefcase, TrendingUp, Clock, Users, Loader2 } from "lucide-react";
import { Link } from "wouter";

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

const squadColors: Record<string, string> = {
  Performance: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Vendas: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Comunicação: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Tech: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  Commerce: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

export default function ColaboradoresAnalise() {
  const { data, isLoading } = useQuery<DashboardAnaliseData>({
    queryKey: ["/api/colaboradores/analise"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-analise" />
      </div>
    );
  }

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
          <h1 className="text-3xl font-semibold mb-2">Análise de Colaboradores</h1>
          <p className="text-muted-foreground">
            Dashboard com métricas e indicadores de recursos humanos
          </p>
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
                  {tempoMedioPromocao.tempoMedioMeses.toFixed(1)} meses
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
                  {tempoPermanencia.tempoPermanenciaAtivos.toFixed(1)} meses
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
                  {tempoPermanencia.tempoPermanenciaDesligados.toFixed(1)} meses
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
                            {pessoa.squad && squadColors[pessoa.squad] ? (
                              <Badge className={squadColors[pessoa.squad]} variant="outline">
                                {pessoa.squad}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {pessoa.squad || "-"}
                              </span>
                            )}
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
              {aniversarioEmpresaMes.length === 0 ? (
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
                      {aniversarioEmpresaMes.map((pessoa) => (
                        <TableRow key={pessoa.id} data-testid={`row-aniversario-empresa-${pessoa.id}`}>
                          <TableCell className="font-medium">{pessoa.nome}</TableCell>
                          <TableCell>{formatDate(pessoa.admissao)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pessoa.cargo || "-"}
                          </TableCell>
                          <TableCell>
                            {pessoa.squad && squadColors[pessoa.squad] ? (
                              <Badge className={squadColors[pessoa.squad]} variant="outline">
                                {pessoa.squad}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {pessoa.squad || "-"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{pessoa.anosDeEmpresa} anos</Badge>
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
                        <TableHead>Nome</TableHead>
                        <TableHead>Cargo Atual</TableHead>
                        <TableHead>Squad</TableHead>
                        <TableHead>Última Promoção</TableHead>
                        <TableHead className="text-right">Meses Desde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ultimasPromocoes.map((pessoa) => (
                        <TableRow key={pessoa.id} data-testid={`row-promocao-${pessoa.id}`}>
                          <TableCell className="font-medium">{pessoa.nome}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {pessoa.cargo || "-"}
                          </TableCell>
                          <TableCell>
                            {pessoa.squad && squadColors[pessoa.squad] ? (
                              <Badge className={squadColors[pessoa.squad]} variant="outline">
                                {pessoa.squad}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {pessoa.squad || "-"}
                              </span>
                            )}
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
        </div>
      </div>
    </div>
  );
}
