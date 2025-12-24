import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Bell, Info, AlertTriangle, CheckCircle, X, Check, Settings, Shield, Activity } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import ThemeToggle from "@/components/ThemeToggle";
import GlobalSearch from "@/components/GlobalSearch";
import PresentationModeButton from "@/components/PresentationModeButton";
import { usePageInfo } from "@/contexts/PageContext";

interface Aviso {
  id: string;
  type: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  date: string;
}

const AVISOS_MOCK: Aviso[] = [
  {
    id: "1",
    type: "info",
    title: "Bem-vindo ao Turbo Cortex",
    message: "Explore todas as funcionalidades da plataforma para gerenciar seus clientes e contratos.",
    date: "2025-12-22"
  },
  {
    id: "2", 
    type: "warning",
    title: "Atualização de Dados",
    message: "Os dados do Conta Azul serão sincronizados automaticamente a cada hora.",
    date: "2025-12-21"
  },
  {
    id: "3",
    type: "success",
    title: "Sincronização Concluída",
    message: "Todos os contratos foram atualizados com sucesso.",
    date: "2025-12-20"
  }
];

function AvisosModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [resolvedIds, setResolvedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('avisos_resolvidos');
    return saved ? JSON.parse(saved) : [];
  });

  const getIcon = (type: Aviso['type']) => {
    switch (type) {
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleResolve = (id: string) => {
    const newResolved = [...resolvedIds, id];
    setResolvedIds(newResolved);
    localStorage.setItem('avisos_resolvidos', JSON.stringify(newResolved));
  };

  const handleUnresolve = (id: string) => {
    const newResolved = resolvedIds.filter(rid => rid !== id);
    setResolvedIds(newResolved);
    localStorage.setItem('avisos_resolvidos', JSON.stringify(newResolved));
  };

  const pendingAvisos = AVISOS_MOCK.filter(a => !resolvedIds.includes(a.id));
  const resolvedAvisos = AVISOS_MOCK.filter(a => resolvedIds.includes(a.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Avisos
            {pendingAvisos.length > 0 && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {pendingAvisos.length} pendente{pendingAvisos.length !== 1 ? 's' : ''}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Notificações e atualizações do sistema
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {pendingAvisos.length === 0 && resolvedAvisos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum aviso no momento</p>
              </div>
            ) : (
              <>
                {pendingAvisos.map((aviso) => (
                  <div 
                    key={aviso.id}
                    className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                    data-testid={`aviso-${aviso.id}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(aviso.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm">{aviso.title}</h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(aviso.date)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {aviso.message}
                      </p>
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolve(aviso.id)}
                          className="h-7 text-xs gap-1"
                          data-testid={`button-resolve-${aviso.id}`}
                        >
                          <Check className="h-3 w-3" />
                          Resolver
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {resolvedAvisos.length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground font-medium pt-2 pb-1">
                      Resolvidos ({resolvedAvisos.length})
                    </div>
                    {resolvedAvisos.map((aviso) => (
                      <div 
                        key={aviso.id}
                        className="flex gap-3 p-3 rounded-lg border border-border bg-muted/30 opacity-60 transition-colors"
                        data-testid={`aviso-resolved-${aviso.id}`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm line-through">{aviso.title}</h4>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleUnresolve(aviso.id)}
                              className="h-6 w-6 -mt-1 -mr-1"
                              data-testid={`button-unresolve-${aviso.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(aviso.date)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {pendingAvisos.length === 0 && resolvedAvisos.length > 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">Todos os avisos foram resolvidos!</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
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

export default function TopBar() {
  const [, setLocation] = useLocation();
  const [avisosOpen, setAvisosOpen] = useState(false);
  const { title, subtitle } = usePageInfo();
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: colaboradorData } = useQuery<{ colaboradorId: number }>({
    queryKey: ["/api/colaboradores/by-user", user?.id],
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/auth/logout");
      setLocation("/login");
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleUserClick = () => {
    if (colaboradorData?.colaboradorId) {
      setLocation(`/colaborador/${colaboradorData.colaboradorId}`);
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
      <div className="flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        {title && (
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold leading-tight" data-testid="header-title">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground" data-testid="header-subtitle">{subtitle}</p>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <GlobalSearch />
        
        <div className="flex items-center gap-1.5 bg-muted/50 dark:bg-muted/30 rounded-full p-1 border border-border">
          <ThemeToggle />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setAvisosOpen(true)}
                className="flex items-center justify-center h-10 w-10 rounded-full border border-border bg-background hover:bg-muted transition-colors"
                data-testid="button-notifications"
                aria-label="Avisos"
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Avisos</TooltipContent>
          </Tooltip>
          
          <PresentationModeButton />
          
          {user && user.role === 'admin' && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center justify-center h-10 w-10 rounded-full border border-border bg-background hover:bg-muted transition-colors"
                      data-testid="button-admin-settings"
                      aria-label="Configurações"
                    >
                      <Settings className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Administração</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Administração</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/usuarios" className="flex items-center gap-2 cursor-pointer">
                    <Shield className="h-4 w-4" />
                    Gerenciar Usuários
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/logs" className="flex items-center gap-2 cursor-pointer">
                    <Activity className="h-4 w-4" />
                    Logs do Sistema
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {user && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center h-10 w-10 rounded-full border border-destructive/50 bg-background hover:bg-destructive/10 transition-colors"
                  data-testid="button-logout"
                  aria-label="Sair"
                >
                  <LogOut className="h-4 w-4 text-destructive" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Sair</TooltipContent>
            </Tooltip>
          )}
        </div>
        
        {user && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleUserClick}
                className={`flex items-center gap-2 p-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors ${
                  colaboradorData?.colaboradorId ? 'cursor-pointer' : 'cursor-default'
                }`}
                data-testid="button-user-profile"
                aria-label="Meu perfil"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.picture} alt={user.name} />
                  <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline-block pr-1">
                  {user.name}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {colaboradorData?.colaboradorId ? 'Ver meu perfil' : user.name}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      
      <AvisosModal open={avisosOpen} onOpenChange={setAvisosOpen} />
    </header>
  );
}