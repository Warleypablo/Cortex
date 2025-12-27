import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  metadata?: any;
}

function getNotificationIcon(type: string) {
  const iconClass = "h-5 w-5";
  switch (type) {
    case "inadimplencia":
      return <span className={`${iconClass} text-red-500`}>⚠️</span>;
    case "contrato":
      return <span className={`${iconClass} text-blue-500`}>📄</span>;
    case "aniversario":
      return <span className={`${iconClass} text-yellow-500`}>🎂</span>;
    case "deal":
      return <span className={`${iconClass} text-green-500`}>💰</span>;
    default:
      return <Bell className={`${iconClass} text-muted-foreground`} />;
  }
}

function NotificationCard({ notification, onMarkAsRead }: { notification: Notification; onMarkAsRead: (id: number) => void }) {
  return (
    <Card 
      className={`mb-3 transition-all ${notification.read ? 'opacity-60' : 'border-l-4 border-l-primary'}`}
      data-testid={`notification-card-${notification.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm">{notification.title}</h4>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR })}
                </span>
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onMarkAsRead(notification.id)}
                    data-testid={`button-mark-read-${notification.id}`}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Avisos() {
  useSetPageInfo("Notificações", "Central de avisos e atualizações do sistema");

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

  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-notifications">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-avisos">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Notificações</h1>
            <p className="text-sm text-muted-foreground">
              {unreadNotifications.length > 0 
                ? `${unreadNotifications.length} não lida${unreadNotifications.length > 1 ? 's' : ''}`
                : 'Nenhuma notificação pendente'}
            </p>
          </div>
        </div>
        {unreadNotifications.length > 0 && (
          <Button
            variant="outline"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            data-testid="button-mark-all-read"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <Tabs defaultValue="unread" className="w-full">
        <TabsList data-testid="tabs-notifications">
          <TabsTrigger value="unread" data-testid="tab-unread">
            Não lidas
            {unreadNotifications.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5">
                {unreadNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read" data-testid="tab-read">
            Lidas
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5">
              {readNotifications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            Todas
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5">
              {notifications.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="mt-4">
          {unreadNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCheck className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="font-medium text-lg">Tudo em dia!</h3>
                <p className="text-muted-foreground">Você não tem notificações pendentes.</p>
              </CardContent>
            </Card>
          ) : (
            <div>
              {unreadNotifications.map(n => (
                <NotificationCard 
                  key={n.id} 
                  notification={n} 
                  onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="read" className="mt-4">
          {readNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Nenhuma notificação lida.</p>
              </CardContent>
            </Card>
          ) : (
            <div>
              {readNotifications.map(n => (
                <NotificationCard 
                  key={n.id} 
                  notification={n} 
                  onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Nenhuma notificação encontrada.</p>
              </CardContent>
            </Card>
          ) : (
            <div>
              {notifications.map(n => (
                <NotificationCard 
                  key={n.id} 
                  notification={n} 
                  onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
