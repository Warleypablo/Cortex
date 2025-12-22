import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePageInfo } from "@/contexts/PageContext";
import { formatDecimal, formatPercent } from "@/lib/utils";
import { 
  Users, UserPlus, UserCheck, Target, Briefcase, TrendingUp, TrendingDown,
  Filter, BarChart3, PieChart as PieChartIcon, Activity, Clock, Search,
  ChevronRight, ArrowRight
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Cell, PieChart, Pie, LineChart, Line, FunnelChart, Funnel, LabelList,
  ComposedChart, Area
} from "recharts";
import type { 
  RecrutamentoKPIs, RecrutamentoFunilEtapa, RecrutamentoFonteDistribuicao,
  RecrutamentoEvolucaoMensal, RecrutamentoVagaDetalhe, RecrutamentoAreaDistribuicao,
  RecrutamentoFiltros, RecrutamentoConversaoPorVaga, RecrutamentoTempoMedioPorEtapa,
  RecrutamentoEntrevistasRealizadas, RecrutamentoEntrevistasPorCargo, RecrutamentoCandidaturasPorArea
} from "@shared/schema";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];
const FUNNEL_COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c', '#ffc658', '#ff7c43'];

const FONTE_LABELS: Record<string, string> = {
  'linkedin': 'LinkedIn',
  'jobPage': 'Página de Vagas',
  'indeedATSIntegration': 'Indeed',
  'netVagas': 'NetVagas',
  'manual': 'Hunting (Manual)',
};

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  "visao-geral": { title: "Recrutamento - Visão Geral", subtitle: "Panorama de candidaturas e fontes" },
  "insights": { title: "Recrutamento - Insights", subtitle: "Análise de tempo e entrevistas" },
  "funil": { title: "Recrutamento - Funil", subtitle: "Conversão por etapas do processo" },
  "vagas": { title: "Recrutamento - Vagas", subtitle: "Detalhamento de vagas abertas" },
  "conversao": { title: "Recrutamento - Conversão", subtitle: "Taxas de conversão por vaga" },
};

export default function DashboardRecrutamento() {
  const { setPageInfo } = usePageInfo();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [periodoMeses, setPeriodoMeses] = useState(6);
  const [areaFilter, setAreaFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");

  useEffect(() => {
    const { title, subtitle } = TAB_TITLES[activeTab] || TAB_TITLES["visao-geral"];
    setPageInfo(title, subtitle);
  }, [activeTab, setPageInfo]);

  const { data: kpis, isLoading: isLoadingKpis } = useQuery<RecrutamentoKPIs>({
    queryKey: ["/api/recrutamento/kpis"],
  });

  const { data: funil, isLoading: isLoadingFunil } = useQuery<RecrutamentoFunilEtapa[]>({
    queryKey: ["/api/recrutamento/funil"],
  });

  const { data: fontes, isLoading: isLoadingFontes } = useQuery<RecrutamentoFonteDistribuicao[]>({
    queryKey: ["/api/recrutamento/fontes"],
  });

  const { data: evolucao, isLoading: isLoadingEvolucao } = useQuery<RecrutamentoEvolucaoMensal[]>({
    queryKey: ["/api/recrutamento/evolucao", periodoMeses],
    queryFn: async () => {
      const response = await fetch(`/api/recrutamento/evolucao?meses=${periodoMeses}`);
      if (!response.ok) throw new Error('Failed to fetch evolucao');
      return response.json();
    },
  });

  const { data: vagas, isLoading: isLoadingVagas } = useQuery<RecrutamentoVagaDetalhe[]>({
    queryKey: ["/api/recrutamento/vagas", areaFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (areaFilter !== "todos") params.append("area", areaFilter);
      if (statusFilter !== "todos") params.append("status", statusFilter);
      const response = await fetch(`/api/recrutamento/vagas?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch vagas');
      return response.json();
    },
  });

  const { data: areas, isLoading: isLoadingAreas } = useQuery<RecrutamentoAreaDistribuicao[]>({
    queryKey: ["/api/recrutamento/areas"],
  });

  const { data: filtros } = useQuery<RecrutamentoFiltros>({
    queryKey: ["/api/recrutamento/filtros"],
  });

  const { data: conversaoPorVaga, isLoading: isLoadingConversao } = useQuery<RecrutamentoConversaoPorVaga[]>({
    queryKey: ["/api/recrutamento/conversao-por-vaga"],
  });

  const { data: tempoMedioPorEtapa, isLoading: isLoadingTempoMedio } = useQuery<RecrutamentoTempoMedioPorEtapa[]>({
    queryKey: ["/api/recrutamento/tempo-medio-por-etapa"],
  });

  const { data: entrevistasRealizadas, isLoading: isLoadingEntrevistas } = useQuery<RecrutamentoEntrevistasRealizadas>({
    queryKey: ["/api/recrutamento/entrevistas-realizadas"],
  });

  const { data: entrevistasPorCargo, isLoading: isLoadingEntrevistasCargo } = useQuery<RecrutamentoEntrevistasPorCargo[]>({
    queryKey: ["/api/recrutamento/entrevistas-por-cargo"],
  });

  const { data: candidaturasPorArea, isLoading: isLoadingCandidaturasArea } = useQuery<RecrutamentoCandidaturasPorArea[]>({
    queryKey: ["/api/recrutamento/candidaturas-por-area"],
  });

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const funilData = useMemo(() => {
    if (!funil) return [];
    return funil.map((item, index) => ({
      ...item,
      fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
    }));
  }, [funil]);

  const fontesChartData = useMemo(() => {
    if (!fontes) return [];
    return fontes.map((item, index) => ({
      ...item,
      name: FONTE_LABELS[item.fonte] || item.fonte,
      fill: COLORS[index % COLORS.length],
    }));
  }, [fontes]);

  const areasChartData = useMemo(() => {
    if (!areas) return [];
    return areas.map((item, index) => ({
      ...item,
      fill: COLORS[index % COLORS.length],
    }));
  }, [areas]);

  const tempoMedioChartData = useMemo(() => {
    if (!tempoMedioPorEtapa) return [];
    return tempoMedioPorEtapa.map((item, index) => ({
      ...item,
      fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
    }));
  }, [tempoMedioPorEtapa]);

  const entrevistasCargoData = useMemo(() => {
    if (!entrevistasPorCargo) return [];
    return entrevistasPorCargo.slice(0, 10).map((item, index) => ({
      ...item,
      fill: COLORS[index % COLORS.length],
    }));
  }, [entrevistasPorCargo]);

  const candidaturasAreaData = useMemo(() => {
    if (!candidaturasPorArea) return [];
    return candidaturasPorArea.map((item, index) => ({
      ...item,
      fill: COLORS[index % COLORS.length],
    }));
  }, [candidaturasPorArea]);

  const KPICard = ({ 
    title, value, subtitle, icon: Icon, loading, variant = 'default' 
  }: { 
    title: string; 
    value: string | number; 
    subtitle?: string; 
    icon: any;
    loading?: boolean;
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  }) => {
    const variantStyles = {
      default: 'text-foreground',
      success: 'text-green-600',
      danger: 'text-red-600',
      warning: 'text-yellow-600',
      info: 'text-blue-600'
    };

    if (loading) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card data-testid={`card-kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
              <p className={`text-2xl font-bold ${variantStyles[variant]}`}>{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
              variant === 'success' ? 'bg-green-100' :
              variant === 'danger' ? 'bg-red-100' :
              variant === 'warning' ? 'bg-yellow-100' :
              variant === 'info' ? 'bg-blue-100' :
              'bg-muted'
            }`}>
              <Icon className={`h-6 w-6 ${variantStyles[variant]}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'open': { label: 'Aberta', variant: 'default' },
      'paused': { label: 'Pausada', variant: 'secondary' },
      'closed': { label: 'Fechada', variant: 'outline' },
      'canceled': { label: 'Cancelada', variant: 'destructive' },
    };
    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 flex justify-end">
          <Select value={periodoMeses.toString()} onValueChange={(v) => setPeriodoMeses(parseInt(v))}>
            <SelectTrigger className="w-[140px]" data-testid="select-periodo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="Total de Candidaturas"
            value={formatNumber(kpis?.totalCandidaturas || 0)}
            subtitle="Todas as candidaturas registradas"
            icon={Users}
            loading={isLoadingKpis}
          />
          <KPICard
            title="Candidatos Ativos"
            value={formatNumber(kpis?.candidatosAtivos || 0)}
            subtitle={`${formatPercent(kpis?.candidatosAtivos && kpis?.totalCandidaturas ? (kpis.candidatosAtivos / kpis.totalCandidaturas) * 100 : 0)} do total`}
            icon={UserPlus}
            loading={isLoadingKpis}
            variant="success"
          />
          <KPICard
            title="Vagas Abertas"
            value={formatNumber(kpis?.vagasAbertas || 0)}
            subtitle={`${kpis?.vagasPausadas || 0} pausadas`}
            icon={Briefcase}
            loading={isLoadingKpis}
            variant="info"
          />
          <KPICard
            title="Taxa de Conversão"
            value={formatPercent(kpis?.taxaConversaoGeral || 0)}
            subtitle="Candidaturas até Oferta"
            icon={Target}
            loading={isLoadingKpis}
            variant="warning"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <KPICard
            title="Hunting (Ativo)"
            value={formatNumber(kpis?.huntingTotal || 0)}
            subtitle="Sourcing manual/direto"
            icon={Search}
            loading={isLoadingKpis}
            variant="info"
          />
          <KPICard
            title="Passivo"
            value={formatNumber(kpis?.passivoTotal || 0)}
            subtitle="Candidaturas espontâneas"
            icon={UserCheck}
            loading={isLoadingKpis}
          />
          <KPICard
            title="Rejeitados"
            value={formatNumber(kpis?.candidatosRejeitados || 0)}
            subtitle={`${kpis?.candidatosDeclinados || 0} declinados`}
            icon={TrendingDown}
            loading={isLoadingKpis}
            variant="danger"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="visao-geral" data-testid="tab-visao-geral">
              <BarChart3 className="w-4 h-4 mr-2" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="insights" data-testid="tab-insights">
              <Clock className="w-4 h-4 mr-2" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="funil" data-testid="tab-funil">
              <Activity className="w-4 h-4 mr-2" />
              Funil
            </TabsTrigger>
            <TabsTrigger value="vagas" data-testid="tab-vagas">
              <Briefcase className="w-4 h-4 mr-2" />
              Vagas
            </TabsTrigger>
            <TabsTrigger value="conversao" data-testid="tab-conversao">
              <Target className="w-4 h-4 mr-2" />
              Conversão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-evolucao">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Evolução de Candidaturas
                  </CardTitle>
                  <CardDescription>Histórico mensal de candidaturas por tipo</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingEvolucao ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : evolucao && evolucao.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={evolucao}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mesLabel" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="passivo" name="Passivo" stackId="a" fill="#0088FE" />
                        <Bar dataKey="hunting" name="Hunting" stackId="a" fill="#00C49F" />
                        <Line type="monotone" dataKey="totalCandidaturas" name="Total" stroke="#ff7300" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-fontes">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5" />
                    Distribuição por Fonte
                  </CardTitle>
                  <CardDescription>Origem das candidaturas</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingFontes ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : fontesChartData && fontesChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={fontesChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentual }) => `${name}: ${percentual.toFixed(1)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="total"
                        >
                          {fontesChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-areas">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Candidatos por Área
                </CardTitle>
                <CardDescription>Distribuição de candidatos por área de atuação</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAreas ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : areasChartData && areasChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={areasChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="area" width={150} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalCandidatos" name="Total Candidatos" fill="#8884d8" />
                      <Bar dataKey="vagasAbertas" name="Vagas Abertas" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <p className="text-muted-foreground">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Total de Entrevistas"
                value={formatNumber(entrevistasRealizadas?.totalEntrevistas || 0)}
                subtitle="Todas as entrevistas realizadas"
                icon={Users}
                loading={isLoadingEntrevistas}
                variant="info"
              />
              <KPICard
                title="Entrevistas R&S"
                value={formatNumber(entrevistasRealizadas?.entrevistaRS || 0)}
                subtitle="Primeira etapa"
                icon={UserPlus}
                loading={isLoadingEntrevistas}
              />
              <KPICard
                title="Entrevistas Técnicas"
                value={formatNumber(entrevistasRealizadas?.entrevistaTecnica || 0)}
                subtitle="Avaliação técnica"
                icon={Target}
                loading={isLoadingEntrevistas}
                variant="warning"
              />
              <KPICard
                title="Entrevistas Finais"
                value={formatNumber(entrevistasRealizadas?.entrevistaFinal || 0)}
                subtitle={`Média: ${formatDecimal(entrevistasRealizadas?.mediaEntrevistasPorVaga || 0)}/vaga`}
                icon={UserCheck}
                loading={isLoadingEntrevistas}
                variant="success"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-tempo-medio-etapa">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Tempo Médio por Etapa
                  </CardTitle>
                  <CardDescription>Dias médios de permanência em cada etapa</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTempoMedio ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : tempoMedioChartData && tempoMedioChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={tempoMedioChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" unit=" dias" />
                        <YAxis type="category" dataKey="etapa" width={130} />
                        <Tooltip 
                          formatter={(value: any) => [`${parseFloat(value).toFixed(1)} dias`, 'Tempo Médio']}
                          labelFormatter={(label) => `Etapa: ${label}`}
                        />
                        <Bar dataKey="tempoMedioDias" name="Tempo Médio" radius={[0, 4, 4, 0]}>
                          {tempoMedioChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-candidaturas-area">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5" />
                    Candidaturas por Área
                  </CardTitle>
                  <CardDescription>Distribuição de candidaturas por área</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingCandidaturasArea ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : candidaturasAreaData && candidaturasAreaData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={candidaturasAreaData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ area, percentual }) => `${area}: ${percentual.toFixed(1)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="totalCandidaturas"
                        >
                          {candidaturasAreaData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any, name: any, props: any) => [
                            `${formatNumber(value)} candidaturas`,
                            `${props.payload.area}`
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-entrevistas-cargo">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Entrevistas por Cargo
                </CardTitle>
                <CardDescription>Top 10 cargos com mais entrevistas realizadas</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingEntrevistasCargo ? (
                  <Skeleton className="h-[350px] w-full" />
                ) : entrevistasCargoData && entrevistasCargoData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={entrevistasCargoData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="cargo" width={180} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border rounded-lg shadow-lg p-3">
                                <p className="font-semibold">{label}</p>
                                {data.area && <p className="text-sm text-muted-foreground">Área: {data.area}</p>}
                                <div className="mt-2 space-y-1 text-sm">
                                  <p>R&S: {data.entrevistaRS}</p>
                                  <p>Técnica: {data.entrevistaTecnica}</p>
                                  <p>Final: {data.entrevistaFinal}</p>
                                  <p className="font-semibold">Total: {data.totalEntrevistas}</p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Bar dataKey="entrevistaRS" name="Entrevista R&S" stackId="a" fill="#8884d8" />
                      <Bar dataKey="entrevistaTecnica" name="Entrevista Técnica" stackId="a" fill="#82ca9d" />
                      <Bar dataKey="entrevistaFinal" name="Entrevista Final" stackId="a" fill="#ffc658" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[350px]">
                    <p className="text-muted-foreground">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-detalhes-area">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Detalhes por Área
                </CardTitle>
                <CardDescription>Candidaturas, status e vagas por área</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingCandidaturasArea ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : candidaturasPorArea && candidaturasPorArea.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Área</TableHead>
                        <TableHead className="text-right">Candidaturas</TableHead>
                        <TableHead className="text-right">Ativos</TableHead>
                        <TableHead className="text-right">Rejeitados</TableHead>
                        <TableHead className="text-right">Vagas Abertas</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidaturasPorArea.map((item) => (
                        <TableRow key={item.area} data-testid={`row-area-${item.area.replace(/\s+/g, '-').toLowerCase()}`}>
                          <TableCell className="font-medium">{item.area}</TableCell>
                          <TableCell className="text-right">{formatNumber(item.totalCandidaturas)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatNumber(item.candidatosAtivos)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatNumber(item.candidatosRejeitados)}</TableCell>
                          <TableCell className="text-right">{formatNumber(item.vagasAbertas)}</TableCell>
                          <TableCell className="text-right">{formatPercent(item.percentual)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex items-center justify-center h-[200px]">
                    <p className="text-muted-foreground">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="funil" className="space-y-6">
            <Card data-testid="card-funil-conversao">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Funil de Recrutamento
                </CardTitle>
                <CardDescription>Distribuição de candidatos por etapa do processo seletivo</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingFunil ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : funilData && funilData.length > 0 ? (
                  <div className="space-y-6">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={funilData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="etapa" width={150} />
                        <Tooltip 
                          formatter={(value: any, name: string) => {
                            if (name === 'total') return [formatNumber(value), 'Candidatos'];
                            return [formatPercent(value), 'Conversão'];
                          }}
                        />
                        <Bar dataKey="total" name="total" radius={[0, 4, 4, 0]}>
                          {funilData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                      {funilData.map((etapa, index) => (
                        <div key={etapa.etapa} className="text-center">
                          <div 
                            className="w-full h-2 rounded-full mb-2"
                            style={{ backgroundColor: etapa.fill }}
                          />
                          <p className="text-xs text-muted-foreground">{etapa.etapa}</p>
                          <p className="font-bold">{formatNumber(etapa.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPercent(etapa.percentual)}
                          </p>
                          {index > 0 && (
                            <div className="flex items-center justify-center mt-1 text-xs">
                              <ArrowRight className="w-3 h-3 mr-1" />
                              <span className={etapa.conversaoAnterior >= 50 ? 'text-green-600' : 'text-yellow-600'}>
                                {formatPercent(etapa.conversaoAnterior)}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[400px]">
                    <p className="text-muted-foreground">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card data-testid="card-fontes-status">
                <CardHeader>
                  <CardTitle>Status por Fonte</CardTitle>
                  <CardDescription>Distribuição de status por canal de origem</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingFontes ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : fontes && fontes.length > 0 ? (
                    <div className="space-y-4">
                      {fontes.map((fonte) => (
                        <div key={fonte.fonte} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{FONTE_LABELS[fonte.fonte] || fonte.fonte}</span>
                            <span className="text-sm text-muted-foreground">{formatNumber(fonte.total)}</span>
                          </div>
                          <div className="flex gap-1 h-4">
                            <div 
                              className="bg-green-500 rounded-l"
                              style={{ width: `${(fonte.ativos / fonte.total) * 100}%` }}
                              title={`Ativos: ${fonte.ativos}`}
                            />
                            <div 
                              className="bg-red-500"
                              style={{ width: `${(fonte.rejeitados / fonte.total) * 100}%` }}
                              title={`Rejeitados: ${fonte.rejeitados}`}
                            />
                            <div 
                              className="bg-yellow-500 rounded-r"
                              style={{ width: `${(fonte.declinados / fonte.total) * 100}%` }}
                              title={`Declinados: ${fonte.declinados}`}
                            />
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-green-500 rounded-full" />
                              Ativos: {fonte.ativos}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-red-500 rounded-full" />
                              Rejeitados: {fonte.rejeitados}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                              Declinados: {fonte.declinados}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[250px]">
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-hunting-passivo">
                <CardHeader>
                  <CardTitle>Hunting vs Passivo</CardTitle>
                  <CardDescription>Comparação de estratégias de sourcing</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingKpis ? (
                    <Skeleton className="h-[250px] w-full" />
                  ) : kpis ? (
                    <div className="space-y-6">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Hunting', value: kpis.huntingTotal, fill: '#00C49F' },
                              { name: 'Passivo', value: kpis.passivoTotal, fill: '#0088FE' },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{formatNumber(kpis.huntingTotal)}</p>
                          <p className="text-sm text-muted-foreground">Hunting</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPercent((kpis.huntingTotal / kpis.totalCandidaturas) * 100)}
                          </p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">{formatNumber(kpis.passivoTotal)}</p>
                          <p className="text-sm text-muted-foreground">Passivo</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPercent((kpis.passivoTotal / kpis.totalCandidaturas) * 100)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[250px]">
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vagas" className="space-y-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-area">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as áreas</SelectItem>
                  {filtros?.areas.map((area) => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {filtros?.statusVagas.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card data-testid="card-lista-vagas">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Lista de Vagas
                </CardTitle>
                <CardDescription>
                  {vagas?.length || 0} vagas encontradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingVagas ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : vagas && vagas.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vaga</TableHead>
                          <TableHead>Área</TableHead>
                          <TableHead>Senioridade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Candidatos</TableHead>
                          <TableHead className="text-right">Ativos</TableHead>
                          <TableHead className="text-right">Conversão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vagas.map((vaga) => (
                          <TableRow key={vaga.vagaId} data-testid={`row-vaga-${vaga.vagaId}`}>
                            <TableCell className="font-medium">{vaga.vagaNome}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{vaga.area || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>{vaga.seniority || 'N/A'}</TableCell>
                            <TableCell>{getStatusBadge(vaga.status)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatNumber(vaga.totalCandidatos)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-green-600">{formatNumber(vaga.candidatosAtivos)}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Progress 
                                  value={vaga.conversaoOferta} 
                                  className="w-16 h-2" 
                                />
                                <span className="text-sm">{formatPercent(vaga.conversaoOferta)}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px]">
                    <p className="text-muted-foreground">Nenhuma vaga encontrada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversao" className="space-y-6">
            <Card data-testid="card-conversao-vaga">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Conversão por Vaga
                </CardTitle>
                <CardDescription>
                  Análise detalhada de conversão em cada etapa por vaga
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingConversao ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : conversaoPorVaga && conversaoPorVaga.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Vaga</TableHead>
                          <TableHead>Área</TableHead>
                          <TableHead className="text-center">Inscrição</TableHead>
                          <TableHead className="text-center">Triagem</TableHead>
                          <TableHead className="text-center">Entrev. R&S</TableHead>
                          <TableHead className="text-center">Entrev. Técnica</TableHead>
                          <TableHead className="text-center">Entrev. Final</TableHead>
                          <TableHead className="text-center">Oferta</TableHead>
                          <TableHead className="text-right">Taxa Conv.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {conversaoPorVaga.map((vaga) => (
                          <TableRow key={vaga.vagaId} data-testid={`row-conversao-${vaga.vagaId}`}>
                            <TableCell className="font-medium">{vaga.vagaNome}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{vaga.area || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{vaga.inscricao}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{vaga.triagem}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{vaga.entrevistaRS}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{vaga.entrevistaTecnica}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{vaga.entrevistaFinal}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-green-600">{vaga.oferta}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className={`font-bold ${
                                  vaga.taxaConversao >= 10 ? 'text-green-600' :
                                  vaga.taxaConversao >= 5 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {formatPercent(vaga.taxaConversao)}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[400px]">
                    <p className="text-muted-foreground">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-conversao-chart">
              <CardHeader>
                <CardTitle>Top 10 Vagas por Candidatos</CardTitle>
                <CardDescription>Visualização das vagas com maior volume de candidaturas</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingConversao ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : conversaoPorVaga && conversaoPorVaga.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={conversaoPorVaga.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="vagaNome" 
                        width={200}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="inscricao" name="Inscrição" stackId="a" fill="#8884d8" />
                      <Bar dataKey="triagem" name="Triagem" stackId="a" fill="#83a6ed" />
                      <Bar dataKey="entrevistaRS" name="Entrev. R&S" stackId="a" fill="#8dd1e1" />
                      <Bar dataKey="entrevistaTecnica" name="Entrev. Técnica" stackId="a" fill="#82ca9d" />
                      <Bar dataKey="entrevistaFinal" name="Entrev. Final" stackId="a" fill="#a4de6c" />
                      <Bar dataKey="oferta" name="Oferta" stackId="a" fill="#ffc658" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <p className="text-muted-foreground">Nenhum dado disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
