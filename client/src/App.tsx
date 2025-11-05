import { lazy, Suspense } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import TopBar from "@/components/TopBar";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Clients from "@/pages/Clients";
import Contracts from "@/pages/Contracts";
import ClientDetail from "@/pages/ClientDetail";
import Colaboradores from "@/pages/Colaboradores";
import ColaboradoresAnalise from "@/pages/ColaboradoresAnalise";
import Patrimonio from "@/pages/Patrimonio";
import PatrimonioDetail from "@/pages/PatrimonioDetail";
import Ferramentas from "@/pages/Ferramentas";
import VisaoGeral from "@/pages/VisaoGeral";
import DashboardFinanceiro from "@/pages/DashboardFinanceiro";
import DashboardGeG from "@/pages/DashboardGeG";
import DashboardRetencao from "@/pages/DashboardRetencao";
import DashboardDFC from "@/pages/DashboardDFC";
import Usuarios from "@/pages/Usuarios";

const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full" data-testid="loading-page">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ component: Component, pageName }: { component: any; pageName?: string }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (pageName && !user.permissions.includes(pageName) && user.role !== "super_admin") {
    return <Redirect to="/ferramentas" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (location === "/login") {
    if (isLoading) {
      return <PageLoader />;
    }
    if (user) {
      return <Redirect to="/ferramentas" />;
    }
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={() => <ProtectedRoute component={Clients} pageName="clientes" />} />
      <Route path="/contratos" component={() => <ProtectedRoute component={Contracts} pageName="contratos" />} />
      <Route path="/colaboradores" component={() => <ProtectedRoute component={Colaboradores} pageName="colaboradores" />} />
      <Route path="/colaboradores/analise" component={() => <ProtectedRoute component={ColaboradoresAnalise} pageName="colaboradores" />} />
      <Route path="/patrimonio/:id" component={() => <ProtectedRoute component={PatrimonioDetail} pageName="patrimonio" />} />
      <Route path="/patrimonio" component={() => <ProtectedRoute component={Patrimonio} pageName="patrimonio" />} />
      <Route path="/ferramentas" component={() => <ProtectedRoute component={Ferramentas} />} />
      <Route path="/visao-geral" component={() => <ProtectedRoute component={VisaoGeral} pageName="dashboard-financeiro" />} />
      <Route path="/dashboard/financeiro" component={() => <ProtectedRoute component={DashboardFinanceiro} pageName="dashboard-financeiro" />} />
      <Route path="/dashboard/geg" component={() => <ProtectedRoute component={DashboardGeG} pageName="dashboard-geg" />} />
      <Route path="/dashboard/retencao" component={() => <ProtectedRoute component={DashboardRetencao} pageName="dashboard-retencao" />} />
      <Route path="/dashboard/dfc" component={() => <ProtectedRoute component={DashboardDFC} pageName="dashboard-dfc" />} />
      <Route path="/usuarios" component={() => <ProtectedRoute component={Usuarios} pageName="usuarios" />} />
      <Route path="/cliente/:id" component={() => <ProtectedRoute component={ClientDetail} pageName="clientes" />} />
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

function AuthenticatedLayout() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (location === "/login") {
    return <Router />;
  }

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

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
      <TooltipProvider>
        <AuthProvider>
          <AuthenticatedLayout />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;