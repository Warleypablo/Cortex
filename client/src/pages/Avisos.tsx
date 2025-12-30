import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Bell, Check, CheckCheck, Loader2, AlertTriangle, FileText, 
  Cake, DollarSign, Filter, ChevronDown, Clock, Trash2, X
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { queryClient } from "@/lib/queryClient";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  priority?: string;
  entityId?: string;
  entityType?: string;
  metadata?: any;
}

const notificationTypes = {
  inadimplencia: {
    label: "Inadimplência",
    icon: AlertTriangle,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-l-amber-500",
  },
  contrato: {
    label: "Contratos",
    icon: FileText,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-l-blue-500",
  },
  aniversario: {
    label: "Aniversários",
    icon: Cake,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-l-pink-500",
  },
  deal: {
    label: "Negócios",
    icon: DollarSign,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-l-emerald-500",
  },
  default: {
    label: "Outros",
    icon: Bell,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-l-muted-foreground",
  },
};

function getNotificationConfig(type: string) {
  return notificationTypes[type as keyof typeof notificationTypes] || notificationTypes.default;
}

function formatNotificationDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return `Hoje, ${format(date, "HH:mm")}`;
  }
  if (isYesterday(date)) {
    return `Ontem, ${format(date, "HH:mm")}`;
  }
  if (isThisWeek(date)) {
    return format(date, "EEEE, HH:mm", { locale: ptBR });
  }
  return format(date, "dd/MM/yyyy, HH:mm");
}

function groupNotificationsByDate(notifications: Notification[]) {
  const groups: { [key: string]: Notification[] } = {};
  
  notifications.forEach(n => {
    const date = new Date(n.createdAt);
    let groupKey: string;
    
    if (isToday(date)) {
      groupKey = "Hoje";
    } else if (isYesterday(date)) {
      groupKey = "Ontem";
    } else if (isThisWeek(date)) {
      groupKey = "Esta semana";
    } else {
      groupKey = format(date, "MMMM yyyy", { locale: ptBR });
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(n);
  });
  
  return groups;
}

function NotificationItem({ 
  notification, 
  onMarkAsRead,
  isCompact = false
}: { 
  notification: Notification; 
  onMarkAsRead: (id: number) => void;
  isCompact?: boolean;
}) {
  const config = getNotificationConfig(notification.type);
  const Icon = config.icon;
  
  return (
    <div 
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg transition-all border-l-4",
        notification.read 
          ? "bg-transparent border-l-transparent opacity-60 hover:opacity-80" 
          : `${config.bgColor} ${config.borderColor}`,
        "hover:bg-muted/50"
      )}
      data-testid={`notification-item-${notification.id}`}
    >
      <div className={cn(
        "flex-shrink-0 p-2 rounded-lg",
        notification.read ? "bg-muted/50" : config.bgColor
      )}>
        <Icon className={cn("h-4 w-4", notification.read ? "text-muted-foreground" : config.color)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium truncate",
              notification.read && "text-muted-foreground"
            )}>
              {notification.title}
            </p>
            {!isCompact && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {notification.message}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: false, locale: ptBR })}
            </span>
            {!notification.read && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(notification.id);
                }}
                data-testid={`button-mark-read-${notification.id}`}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        
        {notification.priority === "high" && !notification.read && (
          <Badge variant="destructive" className="mt-1.5 text-xs h-5">
            Urgente
          </Badge>
        )}
      </div>
    </div>
  );
}

function NotificationGroup({ 
  title, 
  notifications, 
  onMarkAsRead 
}: { 
  title: string; 
  notifications: Notification[]; 
  onMarkAsRead: (id: number) => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2 px-1">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        <div className="flex-1 h-px bg-border" />
        <Badge variant="secondary" className="h-5 text-xs">
          {notifications.length}
        </Badge>
      </div>
      <div className="space-y-1">
        {notifications.map(n => (
          <NotificationItem 
            key={n.id} 
            notification={n} 
            onMarkAsRead={onMarkAsRead}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ type }: { type: "unread" | "read" | "all" }) {
  const config = {
    unread: {
      icon: CheckCheck,
      iconColor: "text-emerald-500",
      title: "Tudo em dia!",
      description: "Você não tem notificações pendentes."
    },
    read: {
      icon: Bell,
      iconColor: "text-muted-foreground",
      title: "Nenhuma notificação lida",
      description: "As notificações lidas aparecerão aqui."
    },
    all: {
      icon: Bell,
      iconColor: "text-muted-foreground",
      title: "Sem notificações",
      description: "Você ainda não recebeu nenhuma notificação."
    }
  };
  
  const { icon: Icon, iconColor, title, description } = config[type];
  
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-muted/50 mb-4">
        <Icon className={cn("h-8 w-8", iconColor)} />
      </div>
      <h3 className="font-medium text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function StatsCard({ 
  icon: Icon, 
  label, 
  value, 
  color,
  bgColor 
}: { 
  icon: any; 
  label: string; 
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg", bgColor)}>
      <Icon className={cn("h-5 w-5", color)} />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function Avisos() {
  useSetPageInfo("Notificações", "Central de avisos e atualizações do sistema");
  
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("unread");

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return fetch("/api/notifications/mark-all-read", { method: "PATCH" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const filteredNotifications = useMemo(() => {
    if (activeFilters.length === 0) return notifications;
    return notifications.filter(n => activeFilters.includes(n.type));
  }, [notifications, activeFilters]);

  const unreadNotifications = filteredNotifications.filter(n => !n.read);
  const readNotifications = filteredNotifications.filter(n => n.read);

  const typeCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    notifications.filter(n => !n.read).forEach(n => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return counts;
  }, [notifications]);

  const groupedUnread = groupNotificationsByDate(unreadNotifications);
  const groupedRead = groupNotificationsByDate(readNotifications);
  const groupedAll = groupNotificationsByDate(filteredNotifications);

  const toggleFilter = (type: string) => {
    setActiveFilters(prev => 
      prev.includes(type) 
        ? prev.filter(f => f !== type)
        : [...prev, type]
    );
  };

  const clearFilters = () => setActiveFilters([]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-notifications">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalUnread = notifications.filter(n => !n.read).length;

  return (
    <div className="p-6 space-y-6" data-testid="page-avisos">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Notificações</h1>
            <p className="text-sm text-muted-foreground">
              {totalUnread > 0 
                ? `${totalUnread} não lida${totalUnread > 1 ? 's' : ''}`
                : 'Todas as notificações lidas'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter">
                <Filter className="h-4 w-4" />
                Filtrar
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {activeFilters.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filtrar por tipo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(notificationTypes).filter(([key]) => key !== "default").map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={activeFilters.includes(key)}
                    onCheckedChange={() => toggleFilter(key)}
                  >
                    <Icon className={cn("h-4 w-4 mr-2", config.color)} />
                    {config.label}
                    {typeCounts[key] > 0 && (
                      <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">
                        {typeCounts[key]}
                      </Badge>
                    )}
                  </DropdownMenuCheckboxItem>
                );
              })}
              {activeFilters.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-muted-foreground"
                    onClick={clearFilters}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar filtros
                  </Button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mark All Read Button */}
          {totalUnread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Marcar todas como lidas</span>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      {totalUnread > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(notificationTypes)
            .filter(([key]) => key !== "default" && typeCounts[key] > 0)
            .map(([key, config]) => {
              const Icon = config.icon;
              return (
                <StatsCard
                  key={key}
                  icon={Icon}
                  label={config.label}
                  value={typeCounts[key] || 0}
                  color={config.color}
                  bgColor={config.bgColor}
                />
              );
            })}
        </div>
      )}

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filtros ativos:</span>
          {activeFilters.map(filter => {
            const config = getNotificationConfig(filter);
            return (
              <Badge 
                key={filter} 
                variant="secondary" 
                className="gap-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => toggleFilter(filter)}
              >
                {config.label}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList data-testid="tabs-notifications">
          <TabsTrigger value="unread" data-testid="tab-unread" className="gap-2">
            Não lidas
            {unreadNotifications.length > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5">
                {unreadNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read" data-testid="tab-read" className="gap-2">
            Lidas
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
              {readNotifications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all" className="gap-2">
            Todas
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
              {filteredNotifications.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="mt-4">
          {unreadNotifications.length === 0 ? (
            <EmptyState type="unread" />
          ) : (
            <Card>
              <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]">
                <CardContent className="p-4">
                  {Object.entries(groupedUnread).map(([date, notifs]) => (
                    <NotificationGroup
                      key={date}
                      title={date}
                      notifications={notifs}
                      onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                    />
                  ))}
                </CardContent>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="read" className="mt-4">
          {readNotifications.length === 0 ? (
            <EmptyState type="read" />
          ) : (
            <Card>
              <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]">
                <CardContent className="p-4">
                  {Object.entries(groupedRead).map(([date, notifs]) => (
                    <NotificationGroup
                      key={date}
                      title={date}
                      notifications={notifs}
                      onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                    />
                  ))}
                </CardContent>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {filteredNotifications.length === 0 ? (
            <EmptyState type="all" />
          ) : (
            <Card>
              <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]">
                <CardContent className="p-4">
                  {Object.entries(groupedAll).map(([date, notifs]) => (
                    <NotificationGroup
                      key={date}
                      title={date}
                      notifications={notifs}
                      onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                    />
                  ))}
                </CardContent>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
