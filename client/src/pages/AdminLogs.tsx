import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, Database, Shield, Zap, RefreshCw, CheckCircle2, XCircle, AlertCircle, Server, HardDrive, Clock } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";

interface SystemLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuthLog {
  id: string;
  timestamp: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  success: string;
}

interface HealthData {
  status: string;
  timestamp: string;
  database: {
    status: string;
    latency_ms: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    unit: string;
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
}

interface Integration {
  name: string;
  status: string;
  lastSync: string | null;
  type: string;
}

export default function AdminLogs() {
  useSetPageInfo("Logs do Sistema", "Monitore acessos, chamadas de API e status das integrações");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [systemLogsPage, setSystemLogsPage] = useState(1);
  const [authLogsPage, setAuthLogsPage] = useState(1);

  const { data: systemLogsData, isLoading: loadingSystemLogs, refetch: refetchSystemLogs } = useQuery<{
    items: SystemLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['/api/admin/system-logs', systemLogsPage],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: authLogsData, isLoading: loadingAuthLogs, refetch: refetchAuthLogs } = useQuery<{
    items: AuthLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['/api/admin/auth-logs', authLogsPage],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: healthData, isLoading: loadingHealth, refetch: refetchHealth } = useQuery<HealthData>({
    queryKey: ['/api/admin/health'],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const { data: integrationsData, isLoading: loadingIntegrations, refetch: refetchIntegrations } = useQuery<{
    integrations: Integration[];
  }>({
    queryKey: ['/api/admin/integrations-status'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const handleRefreshAll = () => {
    refetchSystemLogs();
    refetchAuthLogs();
    refetchHealth();
    refetchIntegrations();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'healthy':
      case 'connected':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>;
      case 'inactive':
      case 'unhealthy':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Inativo</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
    }
  };

  const getHttpStatusBadge = (status: number | null) => {
    if (!status) return <Badge variant="outline">-</Badge>;
    if (status >= 200 && status < 300) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{status}</Badge>;
    }
    if (status >= 400 && status < 500) {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{status}</Badge>;
    }
    if (status >= 500) {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{status}</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      POST: "bg-green-500/20 text-green-400 border-green-500/30",
      PUT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      PATCH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return <Badge className={colors[method] || ""}>{method}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              data-testid="switch-auto-refresh"
            />
            <Label htmlFor="auto-refresh" className="text-sm text-muted-foreground">
              Auto-refresh
            </Label>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          data-testid="button-refresh-all"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="acessos" className="space-y-4">
        <TabsList data-testid="tabs-logs">
          <TabsTrigger value="acessos" data-testid="tab-acessos">
            <Shield className="h-4 w-4 mr-2" />
            Acessos
          </TabsTrigger>
          <TabsTrigger value="api" data-testid="tab-api">
            <Activity className="h-4 w-4 mr-2" />
            API
          </TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">
            <Database className="h-4 w-4 mr-2" />
            Health
          </TabsTrigger>
          <TabsTrigger value="integracoes" data-testid="tab-integracoes">
            <Zap className="h-4 w-4 mr-2" />
            Integrações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="acessos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Autenticação</CardTitle>
              <CardDescription>
                Histórico de login e logout de usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAuthLogs ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : authLogsData?.items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum log de autenticação encontrado</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {authLogsData?.items.map((log) => (
                        <TableRow key={log.id} data-testid={`row-auth-log-${log.id}`}>
                          <TableCell className="text-sm">
                            {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.userName || '-'}</p>
                              <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.action === 'login' ? 'default' : 'secondary'}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.ipAddress || '-'}
                          </TableCell>
                          <TableCell>
                            {log.success === 'true' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {authLogsData && authLogsData.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Página {authLogsData.page} de {authLogsData.totalPages} ({authLogsData.total} registros)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={authLogsPage === 1}
                          onClick={() => setAuthLogsPage(p => p - 1)}
                          data-testid="button-auth-prev"
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={authLogsPage >= authLogsData.totalPages}
                          onClick={() => setAuthLogsPage(p => p + 1)}
                          data-testid="button-auth-next"
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de API</CardTitle>
              <CardDescription>
                Chamadas de API realizadas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSystemLogs ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : systemLogsData?.items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum log de API encontrado</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tempo</TableHead>
                        <TableHead>Usuário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {systemLogsData?.items.map((log) => (
                        <TableRow key={log.id} data-testid={`row-system-log-${log.id}`}>
                          <TableCell className="text-sm">
                            {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {getMethodBadge(log.method)}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[300px] truncate">
                            {log.endpoint}
                          </TableCell>
                          <TableCell>
                            {getHttpStatusBadge(log.statusCode)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.responseTimeMs ? `${log.responseTimeMs}ms` : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.userEmail || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {systemLogsData && systemLogsData.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Página {systemLogsData.page} de {systemLogsData.totalPages} ({systemLogsData.total} registros)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={systemLogsPage === 1}
                          onClick={() => setSystemLogsPage(p => p - 1)}
                          data-testid="button-api-prev"
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={systemLogsPage >= systemLogsData.totalPages}
                          onClick={() => setSystemLogsPage(p => p + 1)}
                          data-testid="button-api-next"
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingHealth ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="flex items-center gap-2">
                    {healthData?.status === 'healthy' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="text-2xl font-bold" data-testid="text-system-status">
                      {healthData?.status === 'healthy' ? 'Saudável' : 'Problema'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Banco de Dados</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingHealth ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      {healthData?.database.status === 'connected' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-2xl font-bold" data-testid="text-db-status">
                        {healthData?.database.latency_ms}ms
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Latência</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingHealth ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div>
                    <span className="text-2xl font-bold" data-testid="text-uptime">
                      {healthData?.uptime.formatted}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Uso de Memória</CardTitle>
              <CardDescription>
                Consumo de memória do servidor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHealth ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-4">
                    <HardDrive className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-heap-used">
                        {healthData?.memory.heapUsed} {healthData?.memory.unit}
                      </p>
                      <p className="text-sm text-muted-foreground">Heap Usado</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <HardDrive className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-heap-total">
                        {healthData?.memory.heapTotal} {healthData?.memory.unit}
                      </p>
                      <p className="text-sm text-muted-foreground">Heap Total</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <HardDrive className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-rss">
                        {healthData?.memory.rss} {healthData?.memory.unit}
                      </p>
                      <p className="text-sm text-muted-foreground">RSS</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integracoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status das Integrações</CardTitle>
              <CardDescription>
                Status de conexão com sistemas externos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingIntegrations ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {integrationsData?.integrations.map((integration) => (
                    <Card key={integration.name} className="bg-muted/50" data-testid={`card-integration-${integration.name}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{integration.name}</p>
                            <p className="text-xs text-muted-foreground">{integration.type}</p>
                          </div>
                          {getStatusBadge(integration.status)}
                        </div>
                        {integration.lastSync && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Última sincronização: {format(new Date(integration.lastSync), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
