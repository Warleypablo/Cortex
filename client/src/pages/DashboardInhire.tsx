import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, UserCheck, FileText, Target, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface InhireMetrics {
  totalCandidaturas: number;
  candidatosAtivos: number;
  totalVagas: number;
  vagasAbertas: number;
  taxaConversao: number;
  tempoMedioContratacao: number;
}

interface InhireStatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

interface InhireStageDistribution {
  stage: string;
  count: number;
  percentage: number;
}

interface InhireSourceDistribution {
  source: string;
  count: number;
  percentage: number;
}

interface InhireFunnel {
  stage: string;
  count: number;
  conversionRate: number;
}

interface InhireVagaComCandidaturas {
  vagaId: string;
  titulo: string;
  departamento: string | null;
  status: string;
  totalCandidaturas: number;
  candidatosAtivos: number;
  candidatosContratados: number;
  dataAbertura: string;
}

const COLORS = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  accent: 'hsl(var(--accent))',
  muted: 'hsl(var(--muted))',
  chart1: '#8884d8',
  chart2: '#82ca9d',
  chart3: '#ffc658',
  chart4: '#ff8042',
  chart5: '#0088FE',
};

export default function DashboardInhire() {
  const { data: metrics, isLoading: isLoadingMetrics } = useQuery<InhireMetrics>({
    queryKey: ['/api/inhire/metrics'],
  });

  const { data: statusDistribution, isLoading: isLoadingStatus } = useQuery<InhireStatusDistribution[]>({
    queryKey: ['/api/inhire/status-distribution'],
  });

  const { data: stageDistribution, isLoading: isLoadingStage } = useQuery<InhireStageDistribution[]>({
    queryKey: ['/api/inhire/stage-distribution'],
  });

  const { data: sourceDistribution, isLoading: isLoadingSource } = useQuery<InhireSourceDistribution[]>({
    queryKey: ['/api/inhire/source-distribution'],
  });

  const { data: funnel, isLoading: isLoadingFunnel } = useQuery<InhireFunnel[]>({
    queryKey: ['/api/inhire/funnel'],
  });

  const { data: vagas, isLoading: isLoadingVagas } = useQuery<InhireVagaComCandidaturas[]>({
    queryKey: ['/api/inhire/vagas-com-candidaturas', { limit: 10 }],
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Dashboard Inhire</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Análise de recrutamento e seleção
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card data-testid="card-total-candidaturas">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Candidaturas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <Skeleton className="h-8 w-24" data-testid="skeleton-total-candidaturas" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-candidaturas">
                {(metrics?.totalCandidaturas ?? 0).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-candidatos-ativos">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Candidatos Ativos</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <Skeleton className="h-8 w-24" data-testid="skeleton-candidatos-ativos" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-candidatos-ativos">
                {(metrics?.candidatosAtivos ?? 0).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-total-vagas">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vagas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <Skeleton className="h-8 w-24" data-testid="skeleton-total-vagas" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-vagas">
                {(metrics?.totalVagas ?? 0).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-vagas-abertas">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vagas Abertas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <Skeleton className="h-8 w-24" data-testid="skeleton-vagas-abertas" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-vagas-abertas">
                {(metrics?.vagasAbertas ?? 0).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-taxa-conversao">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <Skeleton className="h-8 w-24" data-testid="skeleton-taxa-conversao" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-taxa-conversao">
                {(metrics?.taxaConversao ?? 0).toFixed(1)}%
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-tempo-medio-contratacao">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio de Contratação</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <Skeleton className="h-8 w-24" data-testid="skeleton-tempo-medio" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-tempo-medio">
                {(metrics?.tempoMedioContratacao ?? 0).toFixed(0)} dias
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Distribuição por Status */}
        <Card data-testid="card-status-distribution">
          <CardHeader>
            <CardTitle data-testid="text-status-title">Distribuição por Status</CardTitle>
            <CardDescription>Status dos candidatos no processo seletivo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStatus ? (
              <Skeleton className="h-[300px] w-full" data-testid="skeleton-status-chart" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ talentStatus, percentual }) => `${talentStatus}: ${percentual.toFixed(1)}%`}
                    outerRadius={100}
                    fill={COLORS.chart1}
                    dataKey="total"
                    nameKey="talentStatus"
                  >
                    {(statusDistribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Distribuição por Estágio */}
        <Card data-testid="card-stage-distribution">
          <CardHeader>
            <CardTitle data-testid="text-stage-title">Distribuição por Estágio</CardTitle>
            <CardDescription>Estágios atuais dos candidatos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStage ? (
              <Skeleton className="h-[300px] w-full" data-testid="skeleton-stage-chart" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stageDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stageName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill={COLORS.chart1} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Distribuição por Fonte */}
        <Card data-testid="card-source-distribution">
          <CardHeader>
            <CardTitle data-testid="text-source-title">Top Fontes de Candidatos</CardTitle>
            <CardDescription>Principais canais de aquisição</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSource ? (
              <Skeleton className="h-[300px] w-full" data-testid="skeleton-source-chart" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sourceDistribution || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="source" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="total" fill={COLORS.chart2} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Funil de Conversão */}
        <Card data-testid="card-funnel">
          <CardHeader>
            <CardTitle data-testid="text-funnel-title">Funil de Conversão</CardTitle>
            <CardDescription>Taxa de conversão por etapa</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingFunnel ? (
              <Skeleton className="h-[300px] w-full" data-testid="skeleton-funnel-chart" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={funnel || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stageName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill={COLORS.chart3} name="Total" />
                  <Bar dataKey="percentual" fill={COLORS.chart4} name="%" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Vagas */}
      <Card data-testid="card-vagas-table">
        <CardHeader>
          <CardTitle data-testid="text-vagas-title">Vagas com Candidaturas</CardTitle>
          <CardDescription>Top 10 vagas por número de candidaturas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingVagas ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" data-testid={`skeleton-vaga-${i}`} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-vagas">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium" data-testid="header-titulo">Vaga</th>
                    <th className="text-left p-2 font-medium" data-testid="header-status">Status</th>
                    <th className="text-right p-2 font-medium" data-testid="header-candidaturas">Total Candidaturas</th>
                    <th className="text-left p-2 font-medium" data-testid="header-distribuicao">Distribuição por Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(vagas || []).map((vaga, index) => (
                    <tr key={vaga.vagaId} className="border-b" data-testid={`row-vaga-${index}`}>
                      <td className="p-2" data-testid={`text-titulo-${index}`}>{vaga.vagaNome}</td>
                      <td className="p-2" data-testid={`text-status-${index}`}>{vaga.vagaStatus}</td>
                      <td className="text-right p-2" data-testid={`text-candidaturas-${index}`}>{vaga.totalCandidaturas}</td>
                      <td className="p-2" data-testid={`text-distribuicao-${index}`}>
                        <div className="flex gap-2 flex-wrap">
                          {vaga.candidatosPorStatus.slice(0, 3).map((item, idx) => (
                            <span key={idx} className="text-xs bg-muted px-2 py-1 rounded">
                              {item.status}: {item.total}
                            </span>
                          ))}
                          {vaga.candidatosPorStatus.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{vaga.candidatosPorStatus.length - 3} mais
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
