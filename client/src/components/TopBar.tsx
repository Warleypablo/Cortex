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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LogOut, Bell, AlertTriangle, CheckCircle, X, Check, Settings, Cake, FileText, ExternalLink, ChevronRight, Calendar, DollarSign, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ThemeToggle from "@/components/ThemeToggle";
import GlobalSearch from "@/components/GlobalSearch";
import PresentationModeButton from "@/components/PresentationModeButton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { usePageInfo } from "@/contexts/PageContext";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  entityId: string | null;
  entityType: string | null;
  priority: 'high' | 'medium' | 'low';
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
  onViewDetails: (notification: Notification) => void;
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
  isMarkingAllRead,
  onViewDetails
}: AvisosModalProps) {
  const getIcon = (type: string, size: "sm" | "lg" = "sm") => {
    const sizeClass = size === "lg" ? "h-6 w-6" : "h-5 w-5";
    switch (type) {
      case 'aniversario':
        return <Cake className={`${sizeClass} text-pink-500`} />;
      case 'contrato_vencendo':
        return <FileText className={`${sizeClass} text-yellow-500`} />;
      case 'inadimplencia':
        return <AlertTriangle className={`${sizeClass} text-red-500`} />;
      default:
        return <Bell className={`${sizeClass} text-blue-500`} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'aniversario':
        return { label: 'Aniversário', variant: 'default' as const, className: 'bg-pink-500/10 text-pink-600 border-pink-500/20' };
      case 'contrato_vencendo':
        return { label: 'Contrato', variant: 'default' as const, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
      case 'inadimplencia':
        return { label: 'Inadimplência', variant: 'default' as const, className: 'bg-red-500/10 text-red-600 border-red-500/20' };
      default:
        return { label: 'Sistema', variant: 'default' as const, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
    }
  };

  const getPriorityIndicator = (priority: string) => {
    switch (priority) {
      case 'high':
        return { color: 'bg-red-500', label: 'Alta' };
      case 'medium':
        return { color: 'bg-yellow-500', label: 'Média' };
      case 'low':
        return { color: 'bg-green-500', label: 'Baixa' };
      default:
        return { color: 'bg-gray-400', label: 'Normal' };
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            Avisos
            {unreadNotifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-red-500/10 text-red-600 border-red-500/20">
                {unreadNotifications.length} não lida{unreadNotifications.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between mt-2">
            <span className="text-base">Notificações e atualizações do sistema</span>
            {unreadNotifications.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAllRead()}
                disabled={isMarkingAllRead}
                className="gap-1.5"
                data-testid="button-mark-all-read"
              >
                <Check className="h-4 w-4" />
                Marcar todas como lidas
              </Button>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <Separator />
        
        <ScrollArea className="flex-1 pr-4 -mr-4 mt-4">
          <div className="space-y-3 pr-2">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="animate-spin h-10 w-10 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-base">Carregando notificações...</p>
              </div>
            ) : unreadNotifications.length === 0 && readNotifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-16 w-16 mx-auto mb-3 opacity-50" />
                <p className="text-base font-medium">Nenhum aviso no momento</p>
                <p className="text-sm mt-1">Você está em dia!</p>
              </div>
            ) : (
              <>
                {unreadNotifications.map((notification) => {
                  const typeInfo = getTypeLabel(notification.type);
                  return (
                    <div 
                      key={notification.id}
                      className="group flex gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer"
                      onClick={() => onViewDetails(notification)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
                          {getIcon(notification.type, "lg")}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`w-2 h-2 rounded-full ${getPriorityIndicator(notification.priority).color}`} />
                              </TooltipTrigger>
                              <TooltipContent>
                                Prioridade {getPriorityIndicator(notification.priority).label}
                              </TooltipContent>
                            </Tooltip>
                            <h4 className="font-semibold text-base">{notification.title}</h4>
                            <Badge variant="outline" className={typeInfo.className}>
                              {typeInfo.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(notification.createdAt)}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Ver detalhes</span>
                            <ChevronRight className="h-4 w-4" />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); dismiss(notification.id); }}
                              disabled={isDismissing}
                              className="h-8 text-xs gap-1.5"
                              data-testid={`button-dismiss-${notification.id}`}
                            >
                              <X className="h-3.5 w-3.5" />
                              Descartar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                              disabled={isMarkingRead}
                              className="h-8 text-xs gap-1.5"
                              data-testid={`button-mark-read-${notification.id}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Marcar como lida
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {readNotifications.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-4 pb-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground font-medium px-2">
                        Lidas ({readNotifications.length})
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    {readNotifications.slice(0, 5).map((notification) => (
                      <div 
                        key={notification.id}
                        className="flex gap-3 p-3 rounded-lg border border-border bg-muted/20 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={() => onViewDetails(notification)}
                        data-testid={`notification-read-${notification.id}`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm">{notification.title}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{formatDate(notification.createdAt)}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); dismiss(notification.id); }}
                                disabled={isDismissing}
                                className="h-6 w-6"
                                data-testid={`button-dismiss-read-${notification.id}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {readNotifications.length > 5 && (
                      <p className="text-xs text-center text-muted-foreground py-2">
                        + {readNotifications.length - 5} notificações lidas
                      </p>
                    )}
                  </>
                )}

                {unreadNotifications.length === 0 && readNotifications.length > 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                    <p className="text-base font-medium">Todos os avisos foram lidos!</p>
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

// Dialog para detalhes da notificação
interface NotificationDetailDialogProps {
  notification: Notification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  markAsRead: (id: number) => void;
  dismiss: (id: number) => void;
}

function NotificationDetailDialog({
  notification,
  open,
  onOpenChange,
  onNavigate,
  markAsRead,
  dismiss
}: NotificationDetailDialogProps) {
  if (!notification) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'aniversario':
        return <Cake className="h-8 w-8 text-pink-500" />;
      case 'contrato_vencendo':
        return <FileText className="h-8 w-8 text-yellow-500" />;
      case 'inadimplencia':
        return <AlertTriangle className="h-8 w-8 text-red-500" />;
      default:
        return <Bell className="h-8 w-8 text-blue-500" />;
    }
  };

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'aniversario':
        return { label: 'Aniversário', color: 'text-pink-600', bg: 'bg-pink-500/10' };
      case 'contrato_vencendo':
        return { label: 'Contrato Vencendo', color: 'text-yellow-600', bg: 'bg-yellow-500/10' };
      case 'inadimplencia':
        return { label: 'Inadimplência Detectada', color: 'text-red-600', bg: 'bg-red-500/10' };
      default:
        return { label: 'Notificação do Sistema', color: 'text-blue-600', bg: 'bg-blue-500/10' };
    }
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const typeInfo = getTypeInfo(notification.type);

  // Parse message para extrair informações relevantes
  const parseMessage = () => {
    const message = notification.message;
    const details: { label: string; value: string; icon: JSX.Element }[] = [];

    // Extrair número de parcelas
    const parcelasMatch = message.match(/(\d+)\s*parcela/i);
    if (parcelasMatch) {
      details.push({
        label: 'Parcelas vencidas',
        value: parcelasMatch[1],
        icon: <FileText className="h-4 w-4 text-muted-foreground" />
      });
    }

    // Extrair valor total
    const valorMatch = message.match(/R\$\s*([\d.,]+)/);
    if (valorMatch) {
      details.push({
        label: 'Valor total',
        value: `R$ ${valorMatch[1]}`,
        icon: <DollarSign className="h-4 w-4 text-muted-foreground" />
      });
    }

    // Extrair dias
    const diasMatch = message.match(/(\d+)\s*dias?/i);
    if (diasMatch) {
      details.push({
        label: 'Período',
        value: `há ${diasMatch[1]} dias`,
        icon: <Calendar className="h-4 w-4 text-muted-foreground" />
      });
    }

    return details;
  };

  const details = parseMessage();

  const handleNavigateToEntity = () => {
    if (notification.entityType && notification.entityId) {
      let path = '';
      switch (notification.entityType) {
        case 'cliente':
          path = `/cliente/${notification.entityId}`;
          break;
        case 'contrato':
          path = `/contrato/${notification.entityId}`;
          break;
        case 'colaborador':
          path = `/colaborador/${notification.entityId}`;
          break;
        default:
          return;
      }
      onOpenChange(false);
      onNavigate(path);
    }
  };

  const getEntityLabel = () => {
    switch (notification.entityType) {
      case 'cliente':
        return 'Ver Cliente';
      case 'contrato':
        return 'Ver Contrato';
      case 'colaborador':
        return 'Ver Colaborador';
      default:
        return 'Ver Detalhes';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className={`flex items-center justify-center h-16 w-16 rounded-full ${typeInfo.bg} mx-auto mb-4`}>
            {getIcon(notification.type)}
          </div>
          <DialogTitle className="text-center text-xl">
            {notification.title}
          </DialogTitle>
          <DialogDescription className="text-center">
            <Badge variant="outline" className={`${typeInfo.bg} ${typeInfo.color} border-0 mt-2`}>
              {typeInfo.label}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm leading-relaxed">{notification.message}</p>
          </div>

          {details.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {details.map((detail, index) => (
                <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                  {detail.icon}
                  <div>
                    <p className="text-xs text-muted-foreground">{detail.label}</p>
                    <p className="text-sm font-medium">{detail.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Calendar className="h-3.5 w-3.5" />
            <span>Criado em {formatFullDate(notification.createdAt)}</span>
          </div>

          <Separator />

          <div className="flex gap-2">
            {notification.entityType && notification.entityId && (
              <Button 
                className="flex-1 gap-2" 
                onClick={handleNavigateToEntity}
                data-testid="button-view-entity"
              >
                <ExternalLink className="h-4 w-4" />
                {getEntityLabel()}
              </Button>
            )}
            {!notification.read && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => { markAsRead(notification.id); onOpenChange(false); }}
                data-testid="button-detail-mark-read"
              >
                <Check className="h-4 w-4" />
                Marcar como lida
              </Button>
            )}
            <Button 
              variant="ghost" 
              className="gap-2 text-muted-foreground"
              onClick={() => { dismiss(notification.id); onOpenChange(false); }}
              data-testid="button-detail-dismiss"
            >
              <X className="h-4 w-4" />
              Descartar
            </Button>
          </div>
        </div>
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
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const { title, subtitle } = usePageInfo();
  const hasGeneratedNotifications = useRef(false);

  const handleViewDetails = (notification: Notification) => {
    setSelectedNotification(notification);
    setDetailDialogOpen(true);
  };
  
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
        <Breadcrumbs />
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
            <Link href="/admin/usuarios">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center justify-center h-10 w-10 rounded-full border border-border bg-background hover:bg-muted transition-colors"
                    data-testid="button-admin-settings"
                    aria-label="Configurações"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Administração</TooltipContent>
              </Tooltip>
            </Link>
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
        onViewDetails={handleViewDetails}
      />
      
      <NotificationDetailDialog
        notification={selectedNotification}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onNavigate={setLocation}
        markAsRead={(id) => markAsReadMutation.mutate(id)}
        dismiss={(id) => dismissMutation.mutate(id)}
      />
    </header>
  );
}
