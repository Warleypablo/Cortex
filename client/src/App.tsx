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
import Clients from "@/pages/Clients";
import Contracts from "@/pages/Contracts";
import ClientDetail from "@/pages/ClientDetail";
import Colaboradores from "@/pages/Colaboradores";
import Patrimonio from "@/pages/Patrimonio";
import Ferramentas from "@/pages/Ferramentas";

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
      <Route path="/" component={Clients} />
      <Route path="/contratos" component={Contracts} />
      <Route path="/colaboradores" component={Colaboradores} />
      <Route path="/patrimonio" component={Patrimonio} />
      <Route path="/ferramentas" component={Ferramentas} />
      <Route path="/cliente/:id" component={ClientDetail} />
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