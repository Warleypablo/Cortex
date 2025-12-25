import { lazy, Suspense, useEffect } from "react";
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

const Homepage = lazy(() => import("@/pages/Homepage"));
const Clients = lazy(() => import("@/pages/Clients"));
const Contracts = lazy(() => import("@/pages/Contracts"));
const ClientesContratos = lazy(() => import("@/pages/ClientesContratos"));
const ClientDetail = lazy(() => import("@/pages/ClientDetail"));
const Colaboradores = lazy(() => import("@/pages/Colaboradores"));
const ColaboradoresAnalise = lazy(() => import("@/pages/ColaboradoresAnalise"));
const DetailColaborador = lazy(() => import("@/pages/DetailColaborador"));
const Patrimonio = lazy(() => import("@/pages/Patrimonio"));
const PatrimonioDetail = lazy(() => import("@/pages/PatrimonioDetail"));
const Ferramentas = lazy(() => import("@/pages/Ferramentas"));
const TurboZap = lazy(() => import("@/pages/TurboZap"));
const Atendimento = lazy(() => import("@/pages/Atendimento"));
const VisaoGeral = lazy(() => import("@/pages/VisaoGeral"));
const DashboardFinanceiro = lazy(() => import("@/pages/DashboardFinanceiro"));
const DashboardGeG = lazy(() => import("@/pages/DashboardGeG"));
const DashboardRetencao = lazy(() => import("@/pages/DashboardRetencao"));
const Cohort = lazy(() => import("@/pages/Cohort"));
const DashboardDFC = lazy(() => import("@/pages/DashboardDFC"));
const DashboardInadimplencia = lazy(() => import("@/pages/DashboardInadimplencia"));
const DashboardInhire = lazy(() => import("@/pages/DashboardInhire"));
const DashboardRecrutamento = lazy(() => import("@/pages/DashboardRecrutamento"));
const DashboardTech = lazy(() => import("@/pages/DashboardTech"));
const TechProjetos = lazy(() => import("@/pages/TechProjetos"));
const FluxoCaixa = lazy(() => import("@/pages/FluxoCaixa"));
const MetaAds = lazy(() => import("@/pages/MetaAds"));
const AuditoriaSistemas = lazy(() => import("@/pages/AuditoriaSistemas"));
const AdminUsuarios = lazy(() => import("@/pages/AdminUsuarios"));
const AccessDenied = lazy(() => import("@/pages/AccessDenied"));
const Login = lazy(() => import("@/pages/Login"));
const DashboardClosers = lazy(() => import("@/pages/DashboardClosers"));
const DashboardSDRs = lazy(() => import("@/pages/DashboardSDRs"));
const DetailClosers = lazy(() => import("@/pages/DetailClosers"));
const DetailSDRs = lazy(() => import("@/pages/DetailSDRs"));
const AnaliseVendas = lazy(() => import("@/pages/AnaliseVendas"));
const PresentationMode = lazy(() => import("@/pages/PresentationMode"));
const DetalhamentoVendas = lazy(() => import("@/pages/DetalhamentoVendas"));
const Criativos = lazy(() => import("@/pages/Criativos"));
const GrowthVisaoGeral = lazy(() => import("@/pages/GrowthVisaoGeral"));
const PerformancePlataformas = lazy(() => import("@/pages/PerformancePlataformas"));
const RevenueGoals = lazy(() => import("@/pages/RevenueGoals"));
const CasesChat = lazy(() => import("@/pages/CasesChat"));
const JuridicoClientes = lazy(() => import("@/pages/JuridicoClientes"));
const InvestorsReport = lazy(() => import("@/pages/InvestorsReport"));
const Acessos = lazy(() => import("@/pages/Acessos"));
const Conhecimentos = lazy(() => import("@/pages/Conhecimentos"));
const Beneficios = lazy(() => import("@/pages/Beneficios"));
const OKR2026 = lazy(() => import("@/pages/OKR2026"));
const AdminNotificationRules = lazy(() => import("@/pages/AdminNotificationRules"));
const Calendario = lazy(() => import("@/pages/Calendario"));
const MetasSquad = lazy(() => import("@/pages/MetasSquad"));
const OnboardingRH = lazy(() => import("@/pages/OnboardingRH"));
const NotFound = lazy(() => import("@/pages/not-found"));

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
      <Route path="/acessos">{() => <ProtectedRoute path="/acessos" component={Acessos} />}</Route>
      <Route path="/conhecimentos">{() => <ProtectedRoute path="/conhecimentos" component={Conhecimentos} />}</Route>
      <Route path="/beneficios">{() => <ProtectedRoute path="/beneficios" component={Beneficios} />}</Route>
      <Route path="/cases/chat">{() => <ProtectedRoute path="/cases/chat" component={CasesChat} />}</Route>
      
      {/* Operação */}
      <Route path="/visao-geral">{() => <ProtectedRoute path="/visao-geral" component={VisaoGeral} />}</Route>
      <Route path="/dashboard/retencao">{() => <ProtectedRoute path="/dashboard/retencao" component={DashboardRetencao} />}</Route>
      <Route path="/dashboard/cohort">{() => <ProtectedRoute path="/dashboard/cohort" component={Cohort} />}</Route>
      <Route path="/dashboard/meta-ads">{() => <ProtectedRoute path="/dashboard/meta-ads" component={MetaAds} />}</Route>
      
      {/* Financeiro */}
      <Route path="/dashboard/financeiro">{() => <ProtectedRoute path="/dashboard/financeiro" component={DashboardFinanceiro} />}</Route>
      <Route path="/dashboard/dfc">{() => <ProtectedRoute path="/dashboard/dfc" component={DashboardDFC} />}</Route>
      <Route path="/dashboard/fluxo-caixa">{() => <ProtectedRoute path="/dashboard/fluxo-caixa" component={FluxoCaixa} />}</Route>
      <Route path="/dashboard/revenue-goals">{() => <ProtectedRoute path="/dashboard/revenue-goals" component={RevenueGoals} />}</Route>
      <Route path="/dashboard/inadimplencia">{() => <ProtectedRoute path="/dashboard/inadimplencia" component={DashboardInadimplencia} />}</Route>
      <Route path="/dashboard/auditoria-sistemas">{() => <ProtectedRoute path="/dashboard/auditoria-sistemas" component={AuditoriaSistemas} />}</Route>
      
      {/* G&G */}
      <Route path="/dashboard/geg">{() => <ProtectedRoute path="/dashboard/geg" component={DashboardGeG} />}</Route>
      <Route path="/dashboard/inhire">{() => <ProtectedRoute path="/dashboard/inhire" component={DashboardInhire} />}</Route>
      <Route path="/dashboard/recrutamento">{() => <ProtectedRoute path="/dashboard/recrutamento" component={DashboardRecrutamento} />}</Route>
      <Route path="/rh/onboarding">{() => <ProtectedRoute path="/rh/onboarding" component={OnboardingRH} />}</Route>
      
      {/* Tech */}
      <Route path="/dashboard/tech">{() => <ProtectedRoute path="/dashboard/tech" component={DashboardTech} />}</Route>
      <Route path="/tech/projetos">{() => <ProtectedRoute path="/tech/projetos" component={TechProjetos} />}</Route>
      
      {/* Comercial */}
      <Route path="/dashboard/comercial/closers">{() => <ProtectedRoute path="/dashboard/comercial/closers" component={DashboardClosers} />}</Route>
      <Route path="/dashboard/comercial/sdrs">{() => <ProtectedRoute path="/dashboard/comercial/sdrs" component={DashboardSDRs} />}</Route>
      <Route path="/dashboard/comercial/detalhamento-closers">{() => <ProtectedRoute path="/dashboard/comercial/detalhamento-closers" component={DetailClosers} />}</Route>
      <Route path="/dashboard/comercial/detalhamento-sdrs">{() => <ProtectedRoute path="/dashboard/comercial/detalhamento-sdrs" component={DetailSDRs} />}</Route>
      <Route path="/dashboard/comercial/analise-vendas">{() => <ProtectedRoute path="/dashboard/comercial/analise-vendas" component={AnaliseVendas} />}</Route>
      <Route path="/dashboard/comercial/detalhamento-vendas">{() => <ProtectedRoute path="/dashboard/comercial/detalhamento-vendas" component={DetalhamentoVendas} />}</Route>
      <Route path="/dashboard/comercial/apresentacao">{() => <ProtectedRoute path="/dashboard/comercial/apresentacao" component={PresentationMode} />}</Route>
      
      {/* Growth */}
      <Route path="/growth/visao-geral">{() => <ProtectedRoute path="/growth/visao-geral" component={GrowthVisaoGeral} />}</Route>
      <Route path="/growth/criativos">{() => <ProtectedRoute path="/growth/criativos" component={Criativos} />}</Route>
      <Route path="/growth/performance-plataformas">{() => <ProtectedRoute path="/growth/performance-plataformas" component={PerformancePlataformas} />}</Route>
      
      {/* Jurídico */}
      <Route path="/juridico/clientes">{() => <ProtectedRoute path="/juridico/clientes" component={JuridicoClientes} />}</Route>
      
      {/* Investidores */}
      <Route path="/investors-report">{() => <ProtectedRoute path="/investors-report" component={InvestorsReport} />}</Route>
      
      {/* OKR 2026 */}
      <Route path="/okr-2026">{() => <ProtectedRoute path="/okr-2026" component={OKR2026} />}</Route>
      
      {/* Calendário */}
      <Route path="/calendario">{() => <ProtectedRoute path="/calendario" component={Calendario} />}</Route>
      
      {/* Metas por Squad */}
      <Route path="/metas-squad">{() => <ProtectedRoute path="/metas-squad" component={MetasSquad} />}</Route>
      
      {/* Admin */}
      <Route path="/admin/usuarios">{() => <ProtectedRoute path="/admin/usuarios" component={AdminUsuarios} />}</Route>
      <Route path="/admin/regras-notificacoes">{() => <ProtectedRoute path="/admin/regras-notificacoes" component={AdminNotificationRules} />}</Route>
      
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

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route><ProtectedRouter /></Route>
      </Switch>
    </Suspense>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";
  const isPresentationMode = location === "/dashboard/comercial/apresentacao";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoginPage) {
    return <Router />;
  }

  if (isPresentationMode) {
    return <Router />;
  }

  return (
    <PageProvider>
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
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
