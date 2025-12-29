import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, RefreshCw, Database, Server, Activity, BarChart3, CheckCircle2, XCircle, AlertCircle, Zap, KeyRound, Wifi, WifiOff } from "lucide-react";
import { SiOpenai, SiGoogle } from "react-icons/si";
import { useSetPageInfo } from "@/contexts/PageContext";

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
  okr?: {
    targetsCount: number;
    metricsCount: number;
    actualsCount: number;
    overridesCount: number;
  };
}

interface ConnectionStatus {
  name: string;
  status: string;
  latency?: number;
  error?: string;
  lastChecked: string;
}

interface ConnectionsData {
  database: ConnectionStatus;
  openai: ConnectionStatus;
  google: ConnectionStatus;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "healthy" || status === "connected") {
    return (
      <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        {status === "healthy" ? "Saudável" : "Conectado"}
      </Badge>
    );
  }
  if (status === "configured") {
    return (
      <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Configurado
      </Badge>
    );
  }
  if (status === "not_configured") {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
        <AlertCircle className="h-3 w-3 mr-1" />
        Não Configurado
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
      <XCircle className="h-3 w-3 mr-1" />
      Erro
    </Badge>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, status }: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: any;
  status?: "ok" | "warning" | "error";
}) {
  const statusColors = {
    ok: "text-green-500",
    warning: "text-yellow-500",
    error: "text-red-500"
  };
  
  return (
    <Card data-testid={`card-stat-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${status ? statusColors[status] : ''}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className={`h-5 w-5 ${status ? statusColors[status] : 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectionCard({ 
  name, 
  status, 
  latency, 
  error, 
  icon: Icon,
  iconClassName 
}: { 
  name: string; 
  status: string; 
  latency?: number; 
  error?: string;
  icon: any;
  iconClassName?: string;
}) {
  const isConnected = status === "connected" || status === "configured";
  const isError = status === "error";
  const isNotConfigured = status === "not_configured";
  
  return (
    <Card className={`transition-all ${isError ? 'border-red-500/50' : isConnected ? 'border-green-500/30' : ''}`} data-testid={`connection-${name.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-500/10' : isError ? 'bg-red-500/10' : 'bg-muted'}`}>
              <Icon className={`h-5 w-5 ${iconClassName || (isConnected ? 'text-green-500' : isError ? 'text-red-500' : 'text-muted-foreground')}`} />
            </div>
            <div>
              <p className="font-medium">{name}</p>
              {latency !== undefined && (
                <p className="text-xs text-muted-foreground">Latência: {latency}ms</p>
              )}
              {error && (
                <p className="text-xs text-red-500 mt-1">{error}</p>
              )}
              {isNotConfigured && (
                <p className="text-xs text-yellow-500 mt-1">Chave de API não configurada</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            <StatusBadge status={status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminHealth() {
  useSetPageInfo("Diagnóstico do Sistema", "Monitoramento de saúde e conexões");

  const { data, isLoading, refetch, isRefetching } = useQuery<HealthData>({
    queryKey: ["/api/admin/health"],
    refetchInterval: 30000,
  });

  const { data: connections, isLoading: isLoadingConnections, refetch: refetchConnections, isRefetching: isRefetchingConnections } = useQuery<ConnectionsData>({
    queryKey: ["/api/admin/connections/status"],
    refetchInterval: 60000,
  });

  const handleRefreshAll = () => {
    refetch();
    refetchConnections();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-health">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const okr = data?.okr || { targetsCount: 0, metricsCount: 0, actualsCount: 0, overridesCount: 0 };
  const memoryUsagePercent = ((data?.memory.heapUsed || 0) / (data?.memory.heapTotal || 1)) * 100;

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-health">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Diagnóstico do Sistema</h1>
            <p className="text-sm text-muted-foreground">
              Última verificação: {data?.timestamp ? new Date(data.timestamp).toLocaleString('pt-BR') : '-'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={data?.status || "error"} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefetching || isRefetchingConnections}
            data-testid="button-refresh-health"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(isRefetching || isRefetchingConnections) ? 'animate-spin' : ''}`} />
            Atualizar Tudo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Integrações e APIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConnectionCard
              name="Google Cloud SQL"
              status={connections?.database.status || "disconnected"}
              latency={connections?.database.latency}
              error={connections?.database.error}
              icon={Database}
            />
            <ConnectionCard
              name="OpenAI API"
              status={connections?.openai.status || "not_configured"}
              latency={connections?.openai.latency}
              error={connections?.openai.error}
              icon={SiOpenai}
              iconClassName={connections?.openai.status === "connected" ? "text-green-500" : undefined}
            />
            <ConnectionCard
              name="Google OAuth"
              status={connections?.google.status || "not_configured"}
              icon={SiGoogle}
              iconClassName={connections?.google.status === "configured" ? "text-blue-500" : undefined}
            />
          </div>
          {isLoadingConnections && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Verificando conexões...</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Database"
          value={data?.database.status === "connected" ? "OK" : "Erro"}
          subtitle={`Latência: ${data?.database.latency_ms || 0}ms`}
          icon={Database}
          status={data?.database.status === "connected" ? "ok" : "error"}
        />
        <StatCard
          title="Uptime"
          value={data?.uptime.formatted || "-"}
          subtitle="Tempo de atividade"
          icon={Server}
          status="ok"
        />
        <StatCard
          title="Memória Heap"
          value={`${data?.memory.heapUsed || 0} MB`}
          subtitle={`${memoryUsagePercent.toFixed(1)}% de ${data?.memory.heapTotal || 0} MB`}
          icon={Activity}
          status={memoryUsagePercent < 70 ? "ok" : memoryUsagePercent < 85 ? "warning" : "error"}
        />
        <StatCard
          title="RSS"
          value={`${data?.memory.rss || 0} MB`}
          subtitle="Resident Set Size"
          icon={Server}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            OKR 2026 / BP Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50" data-testid="stat-targets">
              <p className="text-sm text-muted-foreground">Targets BP 2026</p>
              <p className={`text-3xl font-bold ${okr.targetsCount > 0 ? 'text-green-500' : 'text-yellow-500'}`}>
                {okr.targetsCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {okr.targetsCount >= 300 ? "Seed completo" : okr.targetsCount > 0 ? "Parcial" : "Não inicializado"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50" data-testid="stat-metrics">
              <p className="text-sm text-muted-foreground">Métricas Registry</p>
              <p className={`text-3xl font-bold ${okr.metricsCount > 0 ? 'text-green-500' : 'text-yellow-500'}`}>
                {okr.metricsCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {okr.metricsCount >= 20 ? "Registry completo" : okr.metricsCount > 0 ? "Parcial" : "Não inicializado"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50" data-testid="stat-actuals">
              <p className="text-sm text-muted-foreground">Actuals Calculados</p>
              <p className={`text-3xl font-bold ${okr.actualsCount > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                {okr.actualsCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {okr.actualsCount > 0 ? "Recompute executado" : "Aguardando recompute"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50" data-testid="stat-overrides">
              <p className="text-sm text-muted-foreground">Overrides Manuais</p>
              <p className={`text-3xl font-bold ${okr.overridesCount === -1 ? 'text-yellow-500' : 'text-foreground'}`}>
                {okr.overridesCount === -1 ? "N/A" : okr.overridesCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {okr.overridesCount === -1 ? "Tabela não existe" : okr.overridesCount > 0 ? "Com ajustes" : "Sem overrides"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Checklist de Inicialização
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <ChecklistItem 
              label="Conexão com banco de dados" 
              status={data?.database.status === "connected"} 
            />
            <ChecklistItem 
              label="OpenAI API configurada" 
              status={connections?.openai.status === "connected"} 
              hint={connections?.openai.latency ? `${connections.openai.latency}ms` : undefined}
            />
            <ChecklistItem 
              label="Google OAuth configurado" 
              status={connections?.google.status === "configured"} 
            />
            <Separator className="my-4" />
            <ChecklistItem 
              label="Seed BP 2026 executado (targets)" 
              status={okr.targetsCount >= 300} 
              hint={okr.targetsCount > 0 ? `${okr.targetsCount} targets` : undefined}
            />
            <ChecklistItem 
              label="Registry de métricas populado" 
              status={okr.metricsCount >= 20} 
              hint={okr.metricsCount > 0 ? `${okr.metricsCount} métricas` : undefined}
            />
            <ChecklistItem 
              label="Recompute executado (actuals)" 
              status={okr.actualsCount > 0} 
              hint={okr.actualsCount > 0 ? `${okr.actualsCount} valores` : undefined}
            />
            <ChecklistItem 
              label="Tabela de overrides criada" 
              status={okr.overridesCount !== -1} 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChecklistItem({ label, status, hint }: { label: string; status: boolean; hint?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30" data-testid={`checklist-${label.toLowerCase().replace(/\s/g, '-')}`}>
      {status ? (
        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
      )}
      <div className="flex-1">
        <span className={status ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        {hint && <span className="text-xs text-muted-foreground ml-2">({hint})</span>}
      </div>
      <Badge variant={status ? "default" : "secondary"} className={status ? "bg-green-500/20 text-green-500" : ""}>
        {status ? "OK" : "Pendente"}
      </Badge>
    </div>
  );
}
