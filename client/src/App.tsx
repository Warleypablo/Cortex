import { lazy, Suspense, useEffect, Component, type ReactNode } from "react";
import PortalClientePage from "@/pages/PortalCliente";
import LoginClientePage from "@/pages/LoginCliente";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import TopBar from "@/components/TopBar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PageProvider } from "@/contexts/PageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { AssistantWidget } from "@/components/AssistantWidget";
import { useDealNotifications } from "@/hooks/use-deal-notifications";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";

// Wrapper around lazy() that retries with cache-busting on chunk load failure.
// After a deploy, old chunk hashes no longer exist on the server. A plain retry
// would hit the browser cache and fail again, so we append ?t=<timestamp> to
// force a fresh network request for the new index.html / chunk manifest.
function lazyWithRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err) => {
      // Only retry for chunk/module load errors
      const msg = err?.message || '';
      if (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError')
      ) {
        // Avoid infinite retry loop: only retry once per session per page
        const retryKey = `chunk-retry-${window.location.pathname}`;
        if (!sessionStorage.getItem(retryKey)) {
          sessionStorage.setItem(retryKey, Date.now().toString());
          // Force a full page reload bypassing cache to get fresh HTML with new chunk hashes
          window.location.reload();
          // Return a never-resolving promise to prevent React from rendering the error
          return new Promise(() => {});
        }
        // Already retried — clear flag and let the error propagate to ErrorBoundary
        sessionStorage.removeItem(retryKey);
      }
      throw err;
    })
  );
}

const Homepage = lazyWithRetry(() => import("@/pages/Homepage"));
const Clients = lazyWithRetry(() => import("@/pages/Clients"));
const Contracts = lazyWithRetry(() => import("@/pages/Contracts"));
const ClientesContratos = lazyWithRetry(() => import("@/pages/ClientesContratos"));
const ClientDetail = lazyWithRetry(() => import("@/pages/ClientDetail"));
const Colaboradores = lazyWithRetry(() => import("@/pages/Colaboradores"));
const ColaboradoresAnalise = lazyWithRetry(() => import("@/pages/ColaboradoresAnalise"));
const DetailColaborador = lazyWithRetry(() => import("@/pages/DetailColaborador"));
const Patrimonio = lazyWithRetry(() => import("@/pages/Patrimonio"));
const PatrimonioDetail = lazyWithRetry(() => import("@/pages/PatrimonioDetail"));
const Ferramentas = lazyWithRetry(() => import("@/pages/Ferramentas"));
const TurboZap = lazyWithRetry(() => import("@/pages/TurboZap"));
const Atendimento = lazyWithRetry(() => import("@/pages/Atendimento"));
const ChatAtendimento = lazyWithRetry(() => import("@/pages/ChatAtendimento"));
const VisaoGeral = lazyWithRetry(() => import("@/pages/VisaoGeral"));
const DashboardFinanceiro = lazyWithRetry(() => import("@/pages/DashboardFinanceiro"));
const DashboardGeG = lazyWithRetry(() => import("@/pages/DashboardGeG"));
const CalendarioFerias = lazyWithRetry(() => import("@/pages/CalendarioFerias"));
const ChurnDetalhamento = lazyWithRetry(() => import("@/pages/ChurnDetalhamento"));
const ChurnPredicao = lazyWithRetry(() => import("@/pages/ChurnPredicao"));
const EvolucaoMensal = lazyWithRetry(() => import("@/pages/EvolucaoMensal"));
const DashboardDFC = lazyWithRetry(() => import("@/pages/DashboardDFC"));
const DashboardInadimplencia = lazyWithRetry(() => import("@/pages/DashboardInadimplencia"));
const DashboardInhire = lazyWithRetry(() => import("@/pages/DashboardInhire"));
const DashboardRecrutamento = lazyWithRetry(() => import("@/pages/DashboardRecrutamento"));
const DashboardTech = lazyWithRetry(() => import("@/pages/DashboardTech"));
const TechProjetos = lazyWithRetry(() => import("@/pages/TechProjetos"));
const TechEvolucao = lazyWithRetry(() => import("@/pages/TechEvolucao"));
const TechFinanceiro = lazyWithRetry(() => import("@/pages/TechFinanceiro"));
const FluxoCaixa = lazyWithRetry(() => import("@/pages/FluxoCaixa"));
const DRE = lazyWithRetry(() => import("@/pages/DRE"));
const MetaAds = lazyWithRetry(() => import("@/pages/MetaAds"));
const AuditoriaSistemas = lazyWithRetry(() => import("@/pages/AuditoriaSistemas"));
const ContribuicaoColaborador = lazyWithRetry(() => import("@/pages/ContribuicaoColaborador"));
const ContribuicaoOperador = lazyWithRetry(() => import("@/pages/ContribuicaoOperador"));
const ContribuicaoSquad = lazyWithRetry(() => import("@/pages/ContribuicaoSquad"));
const AdminUsuarios = lazyWithRetry(() => import("@/pages/AdminUsuarios"));
const AdminAvisos = lazyWithRetry(() => import("@/pages/AdminAvisos"));
const AccessDenied = lazyWithRetry(() => import("@/pages/AccessDenied"));
const Login = lazyWithRetry(() => import("@/pages/Login"));
const DashboardClosers = lazyWithRetry(() => import("@/pages/DashboardClosers"));
const DashboardSDRs = lazyWithRetry(() => import("@/pages/DashboardSDRs"));
const DetailClosers = lazyWithRetry(() => import("@/pages/DetailClosers"));
const DetailSDRs = lazyWithRetry(() => import("@/pages/DetailSDRs"));
const AnaliseVendas = lazyWithRetry(() => import("@/pages/AnaliseVendas"));
const PresentationMode = lazyWithRetry(() => import("@/pages/PresentationMode"));
const DetalhamentoVendas = lazyWithRetry(() => import("@/pages/DetalhamentoVendas"));
const ComercialReunioes = lazyWithRetry(() => import("@/pages/ComercialReunioes"));
const Criativos = lazyWithRetry(() => import("@/pages/Criativos"));
const GrowthOrcadoRealizado = lazyWithRetry(() => import("@/pages/GrowthOrcadoRealizado"));
const GrowthVisaoGeral = lazyWithRetry(() => import("@/pages/GrowthVisaoGeral"));
const PerformancePlataformas = lazyWithRetry(() => import("@/pages/PerformancePlataformas"));
const RevenueGoals = lazyWithRetry(() => import("@/pages/RevenueGoals"));
const CasesChat = lazyWithRetry(() => import("@/pages/CasesChat"));
const JuridicoClientes = lazyWithRetry(() => import("@/pages/JuridicoClientes"));
const ProcessosJuridico = lazyWithRetry(() => import("@/pages/ProcessosJuridico"));
const ContratosColaboradores = lazyWithRetry(() => import("@/pages/ContratosColaboradores"));
const AssistenteJuridico = lazyWithRetry(() => import("@/pages/AssistenteJuridico"));
const RelatoriosJuridico = lazyWithRetry(() => import("@/pages/RelatoriosJuridico"));
const InvestorsReport = lazyWithRetry(() => import("@/pages/InvestorsReport"));
const RelatorioMensal = lazyWithRetry(() => import("@/pages/RelatorioMensal"));
const Acessos = lazyWithRetry(() => import("@/pages/Acessos"));
const Conhecimentos = lazyWithRetry(() => import("@/pages/Conhecimentos"));
const Beneficios = lazyWithRetry(() => import("@/pages/Beneficios"));
const OKR2026 = lazyWithRetry(() => import("@/pages/OKR2026"));
const AdminNotificationRules = lazyWithRetry(() => import("@/pages/AdminNotificationRules"));
const AdminDesignSystem = lazyWithRetry(() => import("@/pages/AdminDesignSystem"));
const Calendario = lazyWithRetry(() => import("@/pages/Calendario"));
const OnboardingRH = lazyWithRetry(() => import("@/pages/OnboardingRH"));
const OnboardingsClientes = lazyWithRetry(() => import("@/pages/OnboardingsClientes"));
const PesquisasGG = lazyWithRetry(() => import("@/pages/PesquisasGG"));
const NpsPesquisa = lazyWithRetry(() => import("@/pages/NpsPesquisa"));
const MeuPerfil = lazyWithRetry(() => import("@/pages/MeuPerfil"));
const Avisos = lazyWithRetry(() => import("@/pages/Avisos"));
const AdminHealth = lazyWithRetry(() => import("@/pages/AdminHealth"));
const AdminOverrides = lazyWithRetry(() => import("@/pages/AdminOverrides"));
const Sugestoes = lazyWithRetry(() => import("@/pages/Sugestoes"));
const ProcessosInternos = lazyWithRetry(() => import("@/pages/ProcessosInternos"));
const ContratosModule = lazyWithRetry(() => import("@/pages/ContratosModule"));
const MargemCliente = lazyWithRetry(() => import("@/pages/MargemCliente"));
const AnaliseSquads = lazyWithRetry(() => import("@/pages/AnaliseSquads"));
const SaudeBaseAtiva = lazyWithRetry(() => import("@/pages/SaudeBaseAtiva"));
const AutoReport = lazyWithRetry(() => import("@/pages/AutoReport"));
const Chamados = lazyWithRetry(() => import("@/pages/Chamados"));
const PortalCliente = PortalClientePage;
const NotFound = lazyWithRetry(() => import("@/pages/not-found"));

// Error boundary to catch silent crashes in the portal.
// The lazyWithRetry wrapper handles the first auto-reload attempt at the
// import level.  This boundary is the safety net: if the error still reaches
// here (e.g. a non-chunk error, or the retry already happened), it shows a
// user-friendly screen with a manual reload button.
class PortalErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const isChunkError =
        this.state.error.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error.message?.includes('Importing a module script failed') ||
        this.state.error.message?.includes('Loading chunk') ||
        this.state.error.message?.includes('ChunkLoadError');
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#09090b', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'monospace', zIndex: 9999 }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#f87171' }}>Erro no Portal</p>
          <p style={{ fontSize: '0.75rem', color: '#a1a1aa', maxWidth: '600px', textAlign: 'center', wordBreak: 'break-all' }}>
            {isChunkError
              ? 'Uma nova versão do portal foi publicada. Clique abaixo para atualizar.'
              : this.state.error.message}
          </p>
          <button onClick={() => { sessionStorage.clear(); window.location.reload(); }} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Recarregar Página</button>
          <button onClick={() => window.location.href = '/login'} style={{ marginTop: '0.5rem', padding: '0.5rem 1.5rem', background: 'transparent', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: '0.5rem', cursor: 'pointer' }}>Voltar ao Login</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4" data-testid="loading-page">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <Loader2 className="w-6 h-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse" data-testid="page-skeleton">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-muted rounded-lg w-48" />
        <div className="h-10 bg-muted rounded-lg w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted rounded-2xl" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded-2xl" />
    </div>
  );
}

function ProtectedRoute({ path, component: Component }: { path: string; component: React.ComponentType }) {
  const { user, hasAccess } = useAuth();

  if (!user) {
    return <PageLoader />;
  }

  if (!hasAccess(path)) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AccessDenied />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  );
}

function ProtectedRouter() {
  const [location, setLocation] = useLocation();
  const { user, isLoading, error } = useAuth();

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation("/login");
    }
  }, [isLoading, error, user, setLocation]);


  if (isLoading) {
    return <PageLoader />;
  }

  if (error || !user) {
    return null;
  }

  return (
    <Switch>
      {/* Menu Principal - Clientes/Contratos */}
      <Route path="/clientes">{() => <ProtectedRoute path="/clientes" component={ClientesContratos} />}</Route>
      <Route path="/contratos">{() => <ProtectedRoute path="/contratos" component={ClientesContratos} />}</Route>
      <Route path="/cliente/:id">{() => <ProtectedRoute path="/clientes" component={ClientDetail} />}</Route>
      
      {/* Colaboradores */}
      <Route path="/colaboradores">{() => <ProtectedRoute path="/colaboradores" component={Colaboradores} />}</Route>
      <Route path="/colaboradores/analise">{() => <ProtectedRoute path="/colaboradores/analise" component={ColaboradoresAnalise} />}</Route>
      <Route path="/colaborador/:id">{() => <ProtectedRoute path="/colaboradores" component={DetailColaborador} />}</Route>
      
      {/* Patrimônio */}
      <Route path="/patrimonio">{() => <ProtectedRoute path="/patrimonio" component={Patrimonio} />}</Route>
      <Route path="/patrimonio/:id">{() => <ProtectedRoute path="/patrimonio" component={PatrimonioDetail} />}</Route>
      
      {/* Menu Principal - Outros */}
      <Route path="/ferramentas">{() => <ProtectedRoute path="/ferramentas" component={Ferramentas} />}</Route>
      <Route path="/turbozap">{() => <ProtectedRoute path="/turbozap" component={TurboZap} />}</Route>
      <Route path="/atendimento">{() => <ProtectedRoute path="/atendimento" component={Atendimento} />}</Route>
      <Route path="/chat-clientes">{() => <ProtectedRoute path="/chat-clientes" component={ChatAtendimento} />}</Route>
      <Route path="/acessos">{() => <ProtectedRoute path="/acessos" component={Acessos} />}</Route>
      <Route path="/conhecimentos">{() => <ProtectedRoute path="/conhecimentos" component={Conhecimentos} />}</Route>
      <Route path="/beneficios">{() => <ProtectedRoute path="/beneficios" component={Beneficios} />}</Route>
      <Route path="/sugestoes">{() => <ProtectedRoute path="/sugestoes" component={Sugestoes} />}</Route>
      <Route path="/processos-internos">{() => <ProtectedRoute path="/processos-internos" component={ProcessosInternos} />}</Route>
      <Route path="/chamados">{() => <ProtectedRoute path="/chamados" component={Chamados} />}</Route>
      <Route path="/cases/chat">{() => <ProtectedRoute path="/cases/chat" component={CasesChat} />}</Route>
      
      {/* Operação */}
      <Route path="/visao-geral">{() => <ProtectedRoute path="/visao-geral" component={VisaoGeral} />}</Route>
      <Route path="/dashboard/churn-detalhamento">{() => <ProtectedRoute path="/dashboard/churn-detalhamento" component={ChurnDetalhamento} />}</Route>
      <Route path="/dashboard/churn-predicao">{() => <ProtectedRoute path="/dashboard/churn-predicao" component={ChurnPredicao} />}</Route>
      <Route path="/dashboard/evolucao-mensal">{() => <ProtectedRoute path="/dashboard/evolucao-mensal" component={EvolucaoMensal} />}</Route>
      <Route path="/dashboard/analise-squads">{() => <ProtectedRoute path="/dashboard/analise-squads" component={AnaliseSquads} />}</Route>
      <Route path="/dashboard/saude-base-ativa">{() => <ProtectedRoute path="/dashboard/saude-base-ativa" component={SaudeBaseAtiva} />}</Route>
      <Route path="/dashboard/meta-ads">{() => <ProtectedRoute path="/dashboard/meta-ads" component={MetaAds} />}</Route>
      
      {/* Financeiro */}
      <Route path="/dashboard/financeiro">{() => <ProtectedRoute path="/dashboard/financeiro" component={DashboardFinanceiro} />}</Route>
      <Route path="/dashboard/dfc">{() => <ProtectedRoute path="/dashboard/dfc" component={DashboardDFC} />}</Route>
      <Route path="/dashboard/fluxo-caixa">{() => <ProtectedRoute path="/dashboard/fluxo-caixa" component={FluxoCaixa} />}</Route>
      <Route path="/dashboard/revenue-goals">{() => <ProtectedRoute path="/dashboard/revenue-goals" component={RevenueGoals} />}</Route>
      <Route path="/dashboard/inadimplencia">{() => <ProtectedRoute path="/dashboard/inadimplencia" component={DashboardInadimplencia} />}</Route>
      <Route path="/dashboard/auditoria-sistemas">{() => <ProtectedRoute path="/dashboard/auditoria-sistemas" component={AuditoriaSistemas} />}</Route>
      <Route path="/dashboard/contribuicao-colaborador">{() => <ProtectedRoute path="/dashboard/contribuicao-colaborador" component={ContribuicaoColaborador} />}</Route>
      <Route path="/dashboard/contribuicao-operador">{() => <ProtectedRoute path="/dashboard/contribuicao-operador" component={ContribuicaoOperador} />}</Route>
      <Route path="/dashboard/contribuicao-squad">{() => <ProtectedRoute path="/dashboard/contribuicao-squad" component={ContribuicaoSquad} />}</Route>
      <Route path="/dashboard/margem-cliente">{() => <ProtectedRoute path="/dashboard/margem-cliente" component={MargemCliente} />}</Route>
      <Route path="/dashboard/dre">{() => <ProtectedRoute path="/dashboard/dre" component={DRE} />}</Route>
      <Route path="/contratos-module">{() => <ProtectedRoute path="/contratos-module" component={ContratosModule} />}</Route>
      
      {/* G&G */}
      <Route path="/dashboard/geg">{() => <ProtectedRoute path="/dashboard/geg" component={DashboardGeG} />}</Route>
      <Route path="/dashboard/inhire">{() => <ProtectedRoute path="/dashboard/inhire" component={DashboardInhire} />}</Route>
      <Route path="/dashboard/recrutamento">{() => <ProtectedRoute path="/dashboard/recrutamento" component={DashboardRecrutamento} />}</Route>
      <Route path="/rh/onboarding">{() => <ProtectedRoute path="/rh/onboarding" component={OnboardingRH} />}</Route>
      <Route path="/rh/pesquisas">{() => <ProtectedRoute path="/rh/pesquisas" component={PesquisasGG} />}</Route>
      <Route path="/rh/nps/responder">{() => <ProtectedRoute path="/rh/nps/responder" component={NpsPesquisa} />}</Route>
      <Route path="/gg/calendario-ferias">{() => <ProtectedRoute path="/gg/calendario-ferias" component={CalendarioFerias} />}</Route>

      {/* Operação */}
      <Route path="/operacao/onboardings">{() => <ProtectedRoute path="/operacao/onboardings" component={OnboardingsClientes} />}</Route>
      
      {/* Tech */}
      <Route path="/dashboard/tech">{() => <ProtectedRoute path="/dashboard/tech" component={DashboardTech} />}</Route>
      <Route path="/tech/projetos">{() => <ProtectedRoute path="/tech/projetos" component={TechProjetos} />}</Route>
      <Route path="/tech/evolucao">{() => <ProtectedRoute path="/tech/evolucao" component={TechEvolucao} />}</Route>
      <Route path="/tech/financeiro">{() => <ProtectedRoute path="/tech/financeiro" component={TechFinanceiro} />}</Route>
      
      {/* Comercial */}
      <Route path="/dashboard/comercial/closers">{() => <ProtectedRoute path="/dashboard/comercial/closers" component={DashboardClosers} />}</Route>
      <Route path="/dashboard/comercial/sdrs">{() => <ProtectedRoute path="/dashboard/comercial/sdrs" component={DashboardSDRs} />}</Route>
      <Route path="/dashboard/comercial/detalhamento-closers">{() => <ProtectedRoute path="/dashboard/comercial/detalhamento-closers" component={DetailClosers} />}</Route>
      <Route path="/dashboard/comercial/detalhamento-sdrs">{() => <ProtectedRoute path="/dashboard/comercial/detalhamento-sdrs" component={DetailSDRs} />}</Route>
      <Route path="/dashboard/comercial/analise-vendas">{() => <ProtectedRoute path="/dashboard/comercial/analise-vendas" component={AnaliseVendas} />}</Route>
      <Route path="/dashboard/comercial/detalhamento-vendas">{() => <ProtectedRoute path="/dashboard/comercial/detalhamento-vendas" component={DetalhamentoVendas} />}</Route>
      <Route path="/dashboard/comercial/reunioes">{() => <ProtectedRoute path="/dashboard/comercial/reunioes" component={ComercialReunioes} />}</Route>
      <Route path="/dashboard/comercial/apresentacao">{() => <ProtectedRoute path="/dashboard/comercial/apresentacao" component={PresentationMode} />}</Route>
      <Route path="/presentation">{() => <ProtectedRoute path="/presentation" component={PresentationMode} />}</Route>
      
      {/* Growth */}
      <Route path="/growth/visao-geral">{() => <ProtectedRoute path="/growth/visao-geral" component={GrowthVisaoGeral} />}</Route>
      <Route path="/growth/criativos">{() => <ProtectedRoute path="/growth/criativos" component={Criativos} />}</Route>
      <Route path="/growth/performance-plataformas">{() => <ProtectedRoute path="/growth/performance-plataformas" component={PerformancePlataformas} />}</Route>
      <Route path="/growth/orcado-realizado">{() => <ProtectedRoute path="/growth/orcado-realizado" component={GrowthOrcadoRealizado} />}</Route>
      <Route path="/growth/auto-report">{() => <ProtectedRoute path="/growth/auto-report" component={AutoReport} />}</Route>
      
      {/* Jurídico */}
      <Route path="/juridico/clientes">{() => <ProtectedRoute path="/juridico/clientes" component={DashboardInadimplencia} />}</Route>
      <Route path="/juridico/processos">{() => <ProtectedRoute path="/juridico/processos" component={ProcessosJuridico} />}</Route>
      <Route path="/juridico/contratos-colaborador">{() => <ProtectedRoute path="/juridico/contratos-colaborador" component={ContratosColaboradores} />}</Route>
      <Route path="/juridico/assistente">{() => <ProtectedRoute path="/juridico/assistente" component={AssistenteJuridico} />}</Route>
      <Route path="/juridico/relatorios">{() => <ProtectedRoute path="/juridico/relatorios" component={RelatoriosJuridico} />}</Route>
      
      {/* Investidores */}
      <Route path="/investors-report">{() => <ProtectedRoute path="/investors-report" component={InvestorsReport} />}</Route>
      <Route path="/reports/mensal">{() => <ProtectedRoute path="/reports/mensal" component={RelatorioMensal} />}</Route>
      
      {/* OKR 2026 */}
      <Route path="/okr-2026">{() => <ProtectedRoute path="/okr-2026" component={OKR2026} />}</Route>
      
      {/* Calendário */}
      <Route path="/calendario">{() => <ProtectedRoute path="/calendario" component={Calendario} />}</Route>
      
      {/* Meu Perfil */}
      <Route path="/meu-perfil">{() => <ProtectedRoute path="/meu-perfil" component={MeuPerfil} />}</Route>
      <Route path="/meu-perfil/:id">{() => <ProtectedRoute path="/meu-perfil" component={DetailColaborador} />}</Route>
      
      {/* Avisos/Notificações */}
      <Route path="/avisos">{() => <ProtectedRoute path="/avisos" component={Avisos} />}</Route>
      
      {/* Admin */}
      <Route path="/admin/usuarios">{() => <ProtectedRoute path="/admin/usuarios" component={AdminUsuarios} />}</Route>
      <Route path="/admin/avisos">{() => <ProtectedRoute path="/admin/avisos" component={AdminAvisos} />}</Route>
      <Route path="/admin/regras-notificacoes">{() => <ProtectedRoute path="/admin/regras-notificacoes" component={AdminNotificationRules} />}</Route>
      <Route path="/admin/design-system">{() => <ProtectedRoute path="/admin/design-system" component={AdminDesignSystem} />}</Route>
      <Route path="/admin/health">{() => <ProtectedRoute path="/admin/health" component={AdminHealth} />}</Route>
      <Route path="/admin/kpi">{() => <ProtectedRoute path="/admin/kpi" component={AdminOverrides} />}</Route>
      
      {/* Homepage - Dashboard baseado no perfil do usuário (placed at end to avoid shadowing other routes) */}
      <Route path="/">{() => (
        <Suspense fallback={<PageSkeleton />}>
          <Homepage />
        </Suspense>
      )}</Route>
      
      <Route>
        {() => (
          <Suspense fallback={<PageLoader />}>
            <NotFound />
          </Suspense>
        )}
      </Route>
    </Switch>
  );
}

const LoginCliente = LoginClientePage;

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/loginclientes" component={LoginCliente} />
        <Route path="/portal-cliente" component={PortalCliente} />
        <Route><ProtectedRouter /></Route>
      </Switch>
    </Suspense>
  );
}

function DealNotificationsHandler() {
  const { user } = useAuth();
  useDealNotifications({ enabled: !!user, playSound: true });
  return null;
}

function AppLayout() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";
  const isLoginCliente = location === "/loginclientes";
  const isPresentationMode = location === "/dashboard/comercial/apresentacao" || location === "/presentation";
  const isPortalCliente = location.startsWith("/portal-cliente");

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoginPage || isLoginCliente || isPortalCliente) {
    return <PortalErrorBoundary><Router /></PortalErrorBoundary>;
  }

  if (isPresentationMode) {
    return <PortalErrorBoundary><Router /></PortalErrorBoundary>;
  }

  return (
    <PortalErrorBoundary>
    <PageProvider>
      <DealNotificationsHandler />
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <AssistantWidget />
    </PageProvider>
    </PortalErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={100} skipDelayDuration={500}>
          <AuthProvider>
            <AppLayout />
          </AuthProvider>
          <Toaster />
          <MaintenanceBanner />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
