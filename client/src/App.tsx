import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import TopBar from "@/components/TopBar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Loader2 } from "lucide-react";
import Clients from "@/pages/Clients";
import Contracts from "@/pages/Contracts";
import ClientDetail from "@/pages/ClientDetail";
import Colaboradores from "@/pages/Colaboradores";
import ColaboradoresAnalise from "@/pages/ColaboradoresAnalise";
import Patrimonio from "@/pages/Patrimonio";
import PatrimonioDetail from "@/pages/PatrimonioDetail";
import Ferramentas from "@/pages/Ferramentas";
import TurboZap from "@/pages/TurboZap";
import VisaoGeral from "@/pages/VisaoGeral";
import DashboardFinanceiro from "@/pages/DashboardFinanceiro";
import DashboardGeG from "@/pages/DashboardGeG";
import DashboardRetencao from "@/pages/DashboardRetencao";
import DashboardDFC from "@/pages/DashboardDFC";
import DashboardInadimplencia from "@/pages/DashboardInadimplencia";
import DashboardInhire from "@/pages/DashboardInhire";
import DashboardRecrutamento from "@/pages/DashboardRecrutamento";
import DashboardTech from "@/pages/DashboardTech";
import FluxoCaixa from "@/pages/FluxoCaixa";
import MetaAds from "@/pages/MetaAds";
import AuditoriaSistemas from "@/pages/AuditoriaSistemas";
import AdminUsuarios from "@/pages/AdminUsuarios";
import AccessDenied from "@/pages/AccessDenied";
import Login from "@/pages/Login";
import DashboardClosers from "@/pages/DashboardClosers";
import DashboardSDRs from "@/pages/DashboardSDRs";
import DetailClosers from "@/pages/DetailClosers";
import AnaliseVendas from "@/pages/AnaliseVendas";

const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full" data-testid="loading-page">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
  role: 'admin' | 'user';
  allowedRoutes: string[];
}

function ProtectedRoute({ path, component: Component }: { path: string; component: React.ComponentType }) {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  if (!user) {
    return <PageLoader />;
  }

  const hasAccess = user.role === 'admin' || (user.allowedRoutes && user.allowedRoutes.includes(path));

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return <Component />;
}

function ProtectedRouter() {
  const [location, setLocation] = useLocation();
  
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation("/login");
    }
  }, [isLoading, error, user, setLocation]);

  useEffect(() => {
    if (!isLoading && user && location === '/') {
      if (user.role !== 'admin' && (!user.allowedRoutes || !user.allowedRoutes.includes('/'))) {
        if (user.allowedRoutes && user.allowedRoutes.length > 0) {
          setLocation(user.allowedRoutes[0]);
        }
      }
    }
  }, [isLoading, user, location, setLocation]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (error || !user) {
    return null;
  }

  return (
    <Switch>
      <Route path="/">{() => <ProtectedRoute path="/" component={Clients} />}</Route>
      <Route path="/contratos">{() => <ProtectedRoute path="/contratos" component={Contracts} />}</Route>
      <Route path="/colaboradores">{() => <ProtectedRoute path="/colaboradores" component={Colaboradores} />}</Route>
      <Route path="/colaboradores/analise">{() => <ProtectedRoute path="/colaboradores/analise" component={ColaboradoresAnalise} />}</Route>
      <Route path="/patrimonio/:id">{() => <ProtectedRoute path="/patrimonio" component={PatrimonioDetail} />}</Route>
      <Route path="/patrimonio">{() => <ProtectedRoute path="/patrimonio" component={Patrimonio} />}</Route>
      <Route path="/ferramentas">{() => <ProtectedRoute path="/ferramentas" component={Ferramentas} />}</Route>
      <Route path="/turbozap">{() => <ProtectedRoute path="/turbozap" component={TurboZap} />}</Route>
      <Route path="/visao-geral">{() => <ProtectedRoute path="/visao-geral" component={VisaoGeral} />}</Route>
      <Route path="/dashboard/financeiro">{() => <ProtectedRoute path="/dashboard/financeiro" component={DashboardFinanceiro} />}</Route>
      <Route path="/dashboard/geg">{() => <ProtectedRoute path="/dashboard/geg" component={DashboardGeG} />}</Route>
      <Route path="/dashboard/retencao">{() => <ProtectedRoute path="/dashboard/retencao" component={DashboardRetencao} />}</Route>
      <Route path="/dashboard/dfc">{() => <ProtectedRoute path="/dashboard/dfc" component={DashboardDFC} />}</Route>
      <Route path="/dashboard/inadimplencia">{() => <ProtectedRoute path="/dashboard/inadimplencia" component={DashboardInadimplencia} />}</Route>
      <Route path="/dashboard/fluxo-caixa">{() => <ProtectedRoute path="/dashboard/fluxo-caixa" component={FluxoCaixa} />}</Route>
      <Route path="/dashboard/auditoria-sistemas">{() => <ProtectedRoute path="/dashboard/auditoria-sistemas" component={AuditoriaSistemas} />}</Route>
      <Route path="/dashboard/inhire">{() => <ProtectedRoute path="/dashboard/inhire" component={DashboardInhire} />}</Route>
      <Route path="/dashboard/recrutamento">{() => <ProtectedRoute path="/dashboard/recrutamento" component={DashboardRecrutamento} />}</Route>
      <Route path="/dashboard/tech">{() => <ProtectedRoute path="/dashboard/tech" component={DashboardTech} />}</Route>
      <Route path="/dashboard/meta-ads">{() => <ProtectedRoute path="/dashboard/meta-ads" component={MetaAds} />}</Route>
      <Route path="/dashboard/comercial/closers">{() => <ProtectedRoute path="/dashboard/comercial/closers" component={DashboardClosers} />}</Route>
      <Route path="/dashboard/comercial/sdrs">{() => <ProtectedRoute path="/dashboard/comercial/sdrs" component={DashboardSDRs} />}</Route>
      <Route path="/dashboard/comercial/detalhamento-closers">{() => <ProtectedRoute path="/dashboard/comercial/detalhamento-closers" component={DetailClosers} />}</Route>
      <Route path="/dashboard/comercial/analise-vendas">{() => <ProtectedRoute path="/dashboard/comercial/analise-vendas" component={AnaliseVendas} />}</Route>
      <Route path="/admin/usuarios">{() => <ProtectedRoute path="/admin/usuarios" component={AdminUsuarios} />}</Route>
      <Route path="/cliente/:id">{() => <ProtectedRoute path="/" component={ClientDetail} />}</Route>
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
    <Switch>
      <Route path="/login" component={Login} />
      <Route><ProtectedRouter /></Route>
    </Switch>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoginPage) {
    return <Router />;
  }

  return (
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppLayout />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;