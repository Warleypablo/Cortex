import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Handshake,
  AlertTriangle,
  Clock,
  Building2,
  LineChart,
  ArrowRight,
  BarChart3,
  PieChart,
  Wallet,
  Receipt,
  ShieldCheck,
  Briefcase,
  Calendar,
  MapPin,
  ExternalLink,
} from "lucide-react";

interface HomeOverview {
  hasActiveContracts: boolean;
  colaboradorNome: string | null;
  mrrTotal: number;
  contratosAtivos: number;
  clientes: Array<{
    id: number;
    nome: string;
    cnpj: string;
    status: string;
    mrr: number;
    contratosAtivos: number;
    produto: string;
    squad: string;
  }>;
  proximosEventos: Array<{
    id: number;
    titulo: string;
    tipo: string;
    dataInicio: string;
    dataFim: string | null;
    local: string | null;
    cor: string | null;
  }>;
}

function MiniCalendar({ eventos }: { eventos: HomeOverview['proximosEventos'] }) {
  if (eventos.length === 0) {
    return (
      <Card data-testid="card-mini-calendar">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Próximos Eventos
            </CardTitle>
            <Link href="/calendario">
              <Button variant="ghost" size="sm" data-testid="button-ver-calendario">
                Ver todos
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum evento nos próximos 14 dias
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-mini-calendar">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Próximos Eventos
          </CardTitle>
          <Link href="/calendario">
            <Button variant="ghost" size="sm" data-testid="button-ver-calendario">
              Ver todos
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {eventos.map((evento) => (
          <div 
            key={evento.id} 
            className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
            data-testid={`event-item-${evento.id}`}
          >
            <div 
              className="w-1 h-full min-h-[40px] rounded-full" 
              style={{ backgroundColor: evento.cor || '#3b82f6' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{evento.titulo}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <Clock className="w-3 h-3" />
                {format(parseISO(evento.dataInicio), "dd MMM, HH:mm", { locale: ptBR })}
              </div>
              {evento.local && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{evento.local}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MeusClientes({ clientes, mrrTotal, contratosAtivos }: { 
  clientes: HomeOverview['clientes']; 
  mrrTotal: number;
  contratosAtivos: number;
}) {
  if (clientes.length === 0) {
    return (
      <Card data-testid="card-meus-clientes-empty">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Meus Clientes
            </CardTitle>
            <Link href="/clientes">
              <Button variant="ghost" size="sm" data-testid="button-ver-clientes">
                Ver todos
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum cliente vinculado ao seu perfil
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-meus-clientes">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Meus Clientes
            </CardTitle>
            <CardDescription className="mt-1">
              {contratosAtivos} contratos • {formatCurrency(mrrTotal)} MRR
            </CardDescription>
          </div>
          <Link href="/clientes">
            <Button variant="ghost" size="sm" data-testid="button-ver-clientes">
              Ver todos
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {clientes.slice(0, 5).map((cliente) => (
            <Link key={cliente.id} href={`/clientes/${cliente.cnpj}`}>
              <div 
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                data-testid={`cliente-item-${cliente.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cliente.nome}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {cliente.produto}
                    </Badge>
                    {cliente.squad && (
                      <span className="text-xs text-muted-foreground">{cliente.squad}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(cliente.mrr)}</p>
                  <p className="text-xs text-muted-foreground">MRR</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  href?: string;
}

function MetricCard({ title, value, subtitle, icon, trend, href }: MetricCardProps) {
  const content = (
    <Card className={href ? "hover-elevate cursor-pointer" : ""} data-testid={`card-metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`text-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            {trend.value >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-600" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-600" />
            )}
            <span className={`text-xs ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value >= 0 ? '+' : ''}{formatPercent(trend.value)} {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function QuickLinkCard({ title, description, href, icon }: { title: string; description: string; href: string; icon: React.ReactNode }) {
  return (
    <Link href={href}>
      <Card className="hover-elevate cursor-pointer h-full" data-testid={`link-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DashboardAdmin() {
  const { data: homeOverview, isLoading: isLoadingOverview } = useQuery<HomeOverview>({
    queryKey: ['/api/home/overview'],
  });

  const { data: visaoGeralData, isLoading: isLoadingVisaoGeral } = useQuery<{
    mrr: number;
    aquisicaoMrr: number;
    aquisicaoPontual: number;
    churn: number;
    pausados: number;
  }>({
    queryKey: ['/api/visao-geral/metricas'],
    queryFn: async () => {
      const now = new Date();
      const mesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const res = await fetch(`/api/visao-geral/metricas?mesAno=${mesAno}`);
      return res.json();
    },
  });

  const { data: inadimplenciaData, isLoading: isLoadingInadimplencia } = useQuery<{
    totalInadimplente: number;
    quantidadeClientes: number;
  }>({
    queryKey: ['/api/inadimplencia/resumo'],
  });

  const { data: closersMetrics, isLoading: isLoadingClosers } = useQuery<{
    mrrObtido: number;
    negociosGanhos: number;
    taxaConversao: number;
  }>({
    queryKey: ['/api/closers/metrics'],
    queryFn: async () => {
      const now = new Date();
      const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
      const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const res = await fetch(`/api/closers/metrics?dataReuniaoInicio=${inicio.toISOString()}&dataReuniaoFim=${fim.toISOString()}&dataFechamentoInicio=${inicio.toISOString()}&dataFechamentoFim=${fim.toISOString()}&dataLeadInicio=${inicio.toISOString()}&dataLeadFim=${fim.toISOString()}`);
      return res.json();
    },
  });

  if (isLoadingVisaoGeral || isLoadingInadimplencia || isLoadingClosers || isLoadingOverview) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Indicadores Principais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="MRR Ativo"
            value={formatCurrency(visaoGeralData?.mrr || 0)}
            subtitle="Receita mensal recorrente"
            icon={<DollarSign className="w-4 h-4" />}
            href="/visao-geral"
          />
          <MetricCard
            title="Aquisição MRR"
            value={formatCurrency(visaoGeralData?.aquisicaoMrr || 0)}
            subtitle="Novos contratos no mês"
            icon={<TrendingUp className="w-4 h-4" />}
            href="/dashboard/comercial/closers"
          />
          <MetricCard
            title="Inadimplência"
            value={formatCurrency(inadimplenciaData?.totalInadimplente || 0)}
            subtitle={`${inadimplenciaData?.quantidadeClientes || 0} clientes`}
            icon={<AlertTriangle className="w-4 h-4" />}
            href="/dashboard/inadimplencia"
          />
          <MetricCard
            title="Negócios Fechados"
            value={closersMetrics?.negociosGanhos || 0}
            subtitle={`Taxa: ${formatPercent(closersMetrics?.taxaConversao || 0)}`}
            icon={<Handshake className="w-4 h-4" />}
            href="/dashboard/comercial/closers"
          />
        </div>
      </div>

      {/* Widgets personalizados: Meus Clientes e Mini Calendário */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MeusClientes 
          clientes={homeOverview?.clientes || []} 
          mrrTotal={homeOverview?.mrrTotal || 0}
          contratosAtivos={homeOverview?.contratosAtivos || 0}
        />
        <MiniCalendar eventos={homeOverview?.proximosEventos || []} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Acesso Rápido</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickLinkCard
            title="Visão Geral"
            description="Métricas de MRR e performance"
            href="/visao-geral"
            icon={<LineChart className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Dashboard Comercial"
            description="Closers e pipeline de vendas"
            href="/dashboard/comercial/closers"
            icon={<Target className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Dashboard Financeiro"
            description="Receitas, despesas e fluxo de caixa"
            href="/dashboard/financeiro"
            icon={<Wallet className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Inadimplência"
            description="Gestão de cobranças"
            href="/dashboard/inadimplencia"
            icon={<Receipt className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Retenção"
            description="Análise de cohort e churn"
            href="/dashboard/retencao"
            icon={<Users className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Clientes"
            description="Base de clientes e contratos"
            href="/clientes"
            icon={<Building2 className="w-5 h-5" />}
          />
        </div>
      </div>
    </div>
  );
}

function DashboardComercial() {
  const { data: closersMetrics, isLoading } = useQuery<{
    mrrObtido: number;
    pontualObtido: number;
    reunioesRealizadas: number;
    negociosGanhos: number;
    leadsCriados: number;
    taxaConversao: number;
  }>({
    queryKey: ['/api/closers/metrics-home'],
    queryFn: async () => {
      const now = new Date();
      const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
      const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const res = await fetch(`/api/closers/metrics?dataReuniaoInicio=${inicio.toISOString()}&dataReuniaoFim=${fim.toISOString()}&dataFechamentoInicio=${inicio.toISOString()}&dataFechamentoFim=${fim.toISOString()}&dataLeadInicio=${inicio.toISOString()}&dataLeadFim=${fim.toISOString()}`);
      return res.json();
    },
  });

  const { data: sdrsMetrics, isLoading: isLoadingSDRs } = useQuery<{
    reunioesAgendadas: number;
    taxaConversao: number;
    leadsCriados: number;
  }>({
    queryKey: ['/api/sdrs/metrics-home'],
    queryFn: async () => {
      const now = new Date();
      const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
      const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const res = await fetch(`/api/sdrs/metrics?dataReuniaoInicio=${inicio.toISOString()}&dataReuniaoFim=${fim.toISOString()}&dataFechamentoInicio=${inicio.toISOString()}&dataFechamentoFim=${fim.toISOString()}&dataLeadInicio=${inicio.toISOString()}&dataLeadFim=${fim.toISOString()}`);
      return res.json();
    },
  });

  if (isLoading || isLoadingSDRs) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Performance Comercial - Mês Atual</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="MRR Obtido"
            value={formatCurrency(closersMetrics?.mrrObtido || 0)}
            subtitle="Receita recorrente fechada"
            icon={<DollarSign className="w-4 h-4" />}
            href="/dashboard/comercial/closers"
          />
          <MetricCard
            title="Receita Pontual"
            value={formatCurrency(closersMetrics?.pontualObtido || 0)}
            subtitle="Setup e projetos"
            icon={<Briefcase className="w-4 h-4" />}
            href="/dashboard/comercial/closers"
          />
          <MetricCard
            title="Negócios Ganhos"
            value={closersMetrics?.negociosGanhos || 0}
            subtitle={`Taxa: ${formatPercent(closersMetrics?.taxaConversao || 0)}`}
            icon={<Handshake className="w-4 h-4" />}
            href="/dashboard/comercial/closers"
          />
          <MetricCard
            title="Reuniões Realizadas"
            value={closersMetrics?.reunioesRealizadas || 0}
            subtitle="Closers no mês"
            icon={<Target className="w-4 h-4" />}
            href="/dashboard/comercial/closers"
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">SDRs - Pré-vendas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Reuniões Agendadas"
            value={sdrsMetrics?.reunioesAgendadas || 0}
            subtitle="Para closers"
            icon={<Users className="w-4 h-4" />}
            href="/dashboard/comercial/sdrs"
          />
          <MetricCard
            title="Leads Criados"
            value={sdrsMetrics?.leadsCriados || 0}
            subtitle="No mês atual"
            icon={<TrendingUp className="w-4 h-4" />}
            href="/dashboard/comercial/sdrs"
          />
          <MetricCard
            title="Taxa Conversão"
            value={formatPercent(sdrsMetrics?.taxaConversao || 0)}
            subtitle="Lead para reunião"
            icon={<BarChart3 className="w-4 h-4" />}
            href="/dashboard/comercial/sdrs"
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Acesso Rápido</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickLinkCard
            title="Arena dos Closers"
            description="Ranking e performance detalhada"
            href="/dashboard/comercial/closers"
            icon={<Target className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Arena dos SDRs"
            description="Métricas de pré-vendas"
            href="/dashboard/comercial/sdrs"
            icon={<Users className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Análise de Vendas"
            description="Detalhamento e tendências"
            href="/dashboard/comercial/analise-vendas"
            icon={<BarChart3 className="w-5 h-5" />}
          />
        </div>
      </div>
    </div>
  );
}

function DashboardFinanceiro() {
  const { data: inadimplenciaData, isLoading: isLoadingInadimplencia } = useQuery<{
    totalInadimplente: number;
    quantidadeClientes: number;
    quantidadeParcelas: number;
    ticketMedio: number;
    valorUltimos45Dias: number;
    quantidadeUltimos45Dias: number;
  }>({
    queryKey: ['/api/inadimplencia/resumo'],
  });

  const { data: saldoData, isLoading: isLoadingSaldo } = useQuery<{
    saldoTotal: number;
  }>({
    queryKey: ['/api/dashboard/saldo-atual'],
  });

  const { data: kpisData, isLoading: isLoadingKpis } = useQuery<{
    aReceberTotal: number;
    aReceberVencidoValor: number;
    aPagarTotal: number;
    aPagarVencidoValor: number;
    receitaMesAtual: number;
    despesaMesAtual: number;
    resultadoMesAtual: number;
  }>({
    queryKey: ['/api/financeiro/kpis-completos'],
  });

  if (isLoadingInadimplencia || isLoadingSaldo || isLoadingKpis) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Posição Financeira</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Saldo em Caixa"
            value={formatCurrency(saldoData?.saldoTotal || 0)}
            subtitle="Saldo atual bancos"
            icon={<Wallet className="w-4 h-4" />}
            href="/dashboard/fluxo-caixa"
          />
          <MetricCard
            title="A Receber"
            value={formatCurrency(kpisData?.aReceberTotal || 0)}
            subtitle={`Vencido: ${formatCurrencyCompact(kpisData?.aReceberVencidoValor || 0)}`}
            icon={<TrendingUp className="w-4 h-4" />}
            href="/dashboard/financeiro"
          />
          <MetricCard
            title="A Pagar"
            value={formatCurrency(kpisData?.aPagarTotal || 0)}
            subtitle={`Vencido: ${formatCurrencyCompact(kpisData?.aPagarVencidoValor || 0)}`}
            icon={<TrendingDown className="w-4 h-4" />}
            href="/dashboard/financeiro"
          />
          <MetricCard
            title="Resultado Mês"
            value={formatCurrency(kpisData?.resultadoMesAtual || 0)}
            subtitle={`Receita: ${formatCurrencyCompact(kpisData?.receitaMesAtual || 0)}`}
            icon={<BarChart3 className="w-4 h-4" />}
            href="/dashboard/financeiro"
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Inadimplência</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Inadimplente"
            value={formatCurrency(inadimplenciaData?.totalInadimplente || 0)}
            subtitle={`${inadimplenciaData?.quantidadeClientes || 0} clientes`}
            icon={<AlertTriangle className="w-4 h-4" />}
            href="/dashboard/inadimplencia"
          />
          <MetricCard
            title="Parcelas Vencidas"
            value={inadimplenciaData?.quantidadeParcelas || 0}
            subtitle={`Ticket médio: ${formatCurrencyCompact(inadimplenciaData?.ticketMedio || 0)}`}
            icon={<Receipt className="w-4 h-4" />}
            href="/dashboard/inadimplencia"
          />
          <MetricCard
            title="Últimos 45 Dias"
            value={formatCurrency(inadimplenciaData?.valorUltimos45Dias || 0)}
            subtitle={`${inadimplenciaData?.quantidadeUltimos45Dias || 0} parcelas`}
            icon={<Clock className="w-4 h-4" />}
            href="/dashboard/inadimplencia"
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Acesso Rápido</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickLinkCard
            title="Dashboard Financeiro"
            description="Análise completa de receitas e despesas"
            href="/dashboard/financeiro"
            icon={<PieChart className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Gestão de Inadimplência"
            description="Cobranças e contextos"
            href="/dashboard/inadimplencia"
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Fluxo de Caixa"
            description="Projeção de entradas e saídas"
            href="/dashboard/fluxo-caixa"
            icon={<Wallet className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="DFC"
            description="Demonstração de fluxo de caixa"
            href="/dashboard/dfc"
            icon={<BarChart3 className="w-5 h-5" />}
          />
        </div>
      </div>
    </div>
  );
}

function DashboardOperacao() {
  const { data: visaoGeralData, isLoading: isLoadingVisaoGeral } = useQuery<{
    mrr: number;
    churn: number;
    pausados: number;
  }>({
    queryKey: ['/api/visao-geral/metricas-operacao'],
    queryFn: async () => {
      const now = new Date();
      const mesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const res = await fetch(`/api/visao-geral/metricas?mesAno=${mesAno}`);
      return res.json();
    },
  });

  const { data: topSquads, isLoading: isLoadingSquads } = useQuery<{ squad: string; mrr: number }[]>({
    queryKey: ['/api/top-squads-home'],
    queryFn: async () => {
      const now = new Date();
      const mesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const res = await fetch(`/api/top-squads?mesAno=${mesAno}`);
      return res.json();
    },
  });

  if (isLoadingVisaoGeral || isLoadingSquads) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Indicadores de Operação</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="MRR Ativo"
            value={formatCurrency(visaoGeralData?.mrr || 0)}
            subtitle="Contratos ativos"
            icon={<DollarSign className="w-4 h-4" />}
            href="/visao-geral"
          />
          <MetricCard
            title="Churn MRR"
            value={formatCurrency(visaoGeralData?.churn || 0)}
            subtitle="Cancelamentos no mês"
            icon={<TrendingDown className="w-4 h-4" />}
            href="/dashboard/retencao"
          />
          <MetricCard
            title="Pausados"
            value={formatCurrency(visaoGeralData?.pausados || 0)}
            subtitle="Contratos pausados"
            icon={<Clock className="w-4 h-4" />}
            href="/clientes"
          />
          <MetricCard
            title="Squads Ativos"
            value={topSquads?.length || 0}
            subtitle="Com contratos"
            icon={<Users className="w-4 h-4" />}
            href="/visao-geral"
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Performance por Squad</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {topSquads?.slice(0, 4).map((squad) => (
            <Card key={squad.squad} data-testid={`card-squad-${squad.squad.toLowerCase()}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{squad.squad}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrencyCompact(squad.mrr)}</div>
                <p className="text-xs text-muted-foreground">MRR do squad</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Acesso Rápido</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickLinkCard
            title="Clientes e Contratos"
            description="Gestão de contas"
            href="/clientes"
            icon={<Building2 className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Análise de Retenção"
            description="Cohort e churn"
            href="/dashboard/retencao"
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Visão Geral"
            description="Métricas gerais"
            href="/visao-geral"
            icon={<LineChart className="w-5 h-5" />}
          />
          <QuickLinkCard
            title="Metas do Squad"
            description="Acompanhamento de metas"
            href="/metas-squad"
            icon={<Target className="w-5 h-5" />}
          />
        </div>
      </div>
    </div>
  );
}

export default function Homepage() {
  usePageTitle("Home");
  const { user } = useAuth();
  
  const department = user?.department || (user?.role === 'admin' ? 'admin' : null);
  
  const getPageTitle = () => {
    switch (department) {
      case 'comercial':
        return 'Dashboard Comercial';
      case 'financeiro':
        return 'Dashboard Financeiro';
      case 'operacao':
        return 'Dashboard Operação';
      default:
        return 'Turbo Cortex';
    }
  };

  const getPageDescription = () => {
    switch (department) {
      case 'comercial':
        return 'Acompanhe a performance comercial';
      case 'financeiro':
        return 'Gestão financeira e cobranças';
      case 'operacao':
        return 'Gestão de contratos e squads';
      default:
        return 'Painel principal de gestão';
    }
  };

  useSetPageInfo(getPageTitle(), getPageDescription());

  const renderDashboard = () => {
    switch (department) {
      case 'comercial':
        return <DashboardComercial />;
      case 'financeiro':
        return <DashboardFinanceiro />;
      case 'operacao':
        return <DashboardOperacao />;
      default:
        return <DashboardAdmin />;
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground">
                Olá, <span className="font-medium text-foreground">{user?.name?.split(' ')[0] || 'Usuário'}</span>
              </p>
            </div>
            {department && department !== 'admin' && (
              <Badge variant="secondary" data-testid="badge-department">
                {department.charAt(0).toUpperCase() + department.slice(1)}
              </Badge>
            )}
          </div>
        </div>

        {renderDashboard()}
      </div>
    </div>
  );
}
