import { useState, useEffect, useRef } from "react";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { LogOut, Bell, AlertTriangle, CheckCircle, X, Check, Settings, Shield, Cake, FileText } from "lucide-react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import ThemeToggle from "@/components/ThemeToggle";
import GlobalSearch from "@/components/GlobalSearch";
import PresentationModeButton from "@/components/PresentationModeButton";
import { usePageInfo } from "@/contexts/PageContext";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  entityId: string | null;
  entityType: string | null;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  expiresAt: string | null;
  uniqueKey: string | null;
}

interface AvisosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: Notification[];
  isLoading: boolean;
  markAsRead: (id: number) => void;
  dismiss: (id: number) => void;
  markAllRead: () => void;
  isMarkingRead: boolean;
  isDismissing: boolean;
  isMarkingAllRead: boolean;
}

function AvisosModal({ 
  open, 
  onOpenChange, 
  notifications, 
  isLoading,
  markAsRead,
  dismiss,
  markAllRead,
  isMarkingRead,
  isDismissing,
  isMarkingAllRead
}: AvisosModalProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'aniversario':
        return <Cake className="h-5 w-5 text-pink-500" />;
      case 'contrato_vencendo':
        return <FileText className="h-5 w-5 text-yellow-500" />;
      case 'inadimplencia':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const unreadNotifications = notifications.filter(n => !n.read && !n.dismissed);
  const readNotifications = notifications.filter(n => n.read && !n.dismissed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Avisos
            {unreadNotifications.length > 0 && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {unreadNotifications.length} não lida{unreadNotifications.length !== 1 ? 's' : ''}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>Notificações e atualizações do sistema</span>
            {unreadNotifications.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAllRead()}
                disabled={isMarkingAllRead}
                className="h-7 text-xs gap-1"
                data-testid="button-mark-all-read"
              >
                <Check className="h-3 w-3" />
                Marcar todas como lidas
              </Button>
            )}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p>Carregando notificações...</p>
              </div>
            ) : unreadNotifications.length === 0 && readNotifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum aviso no momento</p>
              </div>
            ) : (
              <>
                {unreadNotifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                    data-testid={`notification-${notification.id}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm">{notification.title}</h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dismiss(notification.id)}
                          disabled={isDismissing}
                          className="h-7 text-xs gap-1"
                          data-testid={`button-dismiss-${notification.id}`}
                        >
                          <X className="h-3 w-3" />
                          Descartar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markAsRead(notification.id)}
                          disabled={isMarkingRead}
                          className="h-7 text-xs gap-1"
                          data-testid={`button-mark-read-${notification.id}`}
                        >
                          <Check className="h-3 w-3" />
                          Marcar como lida
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {readNotifications.length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground font-medium pt-2 pb-1">
                      Lidas ({readNotifications.length})
                    </div>
                    {readNotifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className="flex gap-3 p-3 rounded-lg border border-border bg-muted/30 opacity-60 transition-colors"
                        data-testid={`notification-read-${notification.id}`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm line-through">{notification.title}</h4>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => dismiss(notification.id)}
                              disabled={isDismissing}
                              className="h-6 w-6 -mt-1 -mr-1"
                              data-testid={`button-dismiss-read-${notification.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {unreadNotifications.length === 0 && readNotifications.length > 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">Todos os avisos foram lidos!</p>
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
  const hasGeneratedNotifications = useRef(false);
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: colaboradorData } = useQuery<{ colaboradorId: number }>({
    queryKey: ["/api/colaboradores/by-user", user?.id],
    enabled: !!user?.id,
  });

  const { data: notifications = [], isLoading: isLoadingNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const { refetch: generateNotifications } = useQuery({
    queryKey: ["/api/notifications/generate"],
    enabled: false,
  });

  useEffect(() => {
    if (!hasGeneratedNotifications.current) {
      hasGeneratedNotifications.current = true;
      generateNotifications().then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      });
    }
  }, [generateNotifications]);

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;

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
                className="relative flex items-center justify-center h-10 w-10 rounded-full border border-border bg-background hover:bg-muted transition-colors"
                data-testid="button-notifications"
                aria-label="Avisos"
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full"
                    data-testid="badge-unread-count"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Avisos{unreadCount > 0 ? ` (${unreadCount})` : ''}</TooltipContent>
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
      
      <AvisosModal 
        open={avisosOpen} 
        onOpenChange={setAvisosOpen}
        notifications={notifications}
        isLoading={isLoadingNotifications}
        markAsRead={(id) => markAsReadMutation.mutate(id)}
        dismiss={(id) => dismissMutation.mutate(id)}
        markAllRead={() => markAllReadMutation.mutate()}
        isMarkingRead={markAsReadMutation.isPending}
        isDismissing={dismissMutation.isPending}
        isMarkingAllRead={markAllReadMutation.isPending}
      />
    </header>
  );
}
