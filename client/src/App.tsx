import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import TopBar from "@/components/TopBar";
import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
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
import AcessoNegado from "@/pages/AcessoNegado";

const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full" data-testid="loading-page">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/acesso-negado" component={AcessoNegado} />
      <Route path="/">
        {() => (
          <AuthGuard requiredPermission="clientes">
            <Clients />
          </AuthGuard>
        )}
      </Route>
      <Route path="/contratos">
        {() => (
          <AuthGuard requiredPermission="contratos">
            <Contracts />
          </AuthGuard>
        )}
      </Route>
      <Route path="/colaboradores">
        {() => (
          <AuthGuard requiredPermission="colaboradores">
            <Colaboradores />
          </AuthGuard>
        )}
      </Route>
      <Route path="/colaboradores/analise">
        {() => (
          <AuthGuard requiredPermission="colaboradores-analise">
            <ColaboradoresAnalise />
          </AuthGuard>
        )}
      </Route>
      <Route path="/patrimonio/:id" component={PatrimonioDetail} />
      <Route path="/patrimonio">
        {() => (
          <AuthGuard requiredPermission="patrimonio">
            <Patrimonio />
          </AuthGuard>
        )}
      </Route>
      <Route path="/ferramentas">
        {() => (
          <AuthGuard requiredPermission="ferramentas">
            <Ferramentas />
          </AuthGuard>
        )}
      </Route>
      <Route path="/visao-geral">
        {() => (
          <AuthGuard requiredPermission="visao-geral">
            <VisaoGeral />
          </AuthGuard>
        )}
      </Route>
      <Route path="/dashboard/financeiro">
        {() => (
          <AuthGuard requiredPermission="dashboard-financeiro">
            <DashboardFinanceiro />
          </AuthGuard>
        )}
      </Route>
      <Route path="/dashboard/geg">
        {() => (
          <AuthGuard requiredPermission="dashboard-geg">
            <DashboardGeG />
          </AuthGuard>
        )}
      </Route>
      <Route path="/dashboard/retencao">
        {() => (
          <AuthGuard requiredPermission="dashboard-retencao">
            <DashboardRetencao />
          </AuthGuard>
        )}
      </Route>
      <Route path="/dashboard/dfc">
        {() => (
          <AuthGuard requiredPermission="dashboard-dfc">
            <DashboardDFC />
          </AuthGuard>
        )}
      </Route>
      <Route path="/cliente/:id" component={ClientDetail} />
      <Route path="/usuarios">
        {() => (
          <AuthGuard superAdminOnly>
            <Usuarios />
          </AuthGuard>
        )}
      </Route>
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

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;