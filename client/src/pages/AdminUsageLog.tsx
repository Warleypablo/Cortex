import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroMetric } from "@/components/HeroMetric";
import { useTheme } from "@/components/ThemeProvider";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name === "pageViews" ? "Page Views" : entry.name === "logins" ? "Logins" : entry.name}:{" "}
          {entry.value}
        </p>
      ))}
    </div>
  );
};

export default function AdminUsageLog() {
  const [days, setDays] = useState("30");
  const [authLogsPage, setAuthLogsPage] = useState(1);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/usage-stats", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/usage-stats?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch usage stats");
      return res.json();
    },
  });

  const { data: authLogs, isLoading: authLogsLoading } = useQuery<any>({
    queryKey: ["/api/admin/auth-logs", authLogsPage],
    queryFn: async () => {
      const res = await fetch(`/api/admin/auth-logs?page=${authLogsPage}&pageSize=20`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch auth logs");
      return res.json();
    },
  });

  const chartData = stats?.dailyActivity
    ? [...stats.dailyActivity].reverse().map((d: any) => ({
        ...d,
        date: typeof d.date === "string" && d.date.length >= 10 ? d.date.slice(5, 10).replace("-", "/") : d.date,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Uso do Sistema</h1>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="14">14 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hero Metrics */}
      {statsLoading ? (
        <>
          <div className="hidden md:flex items-start gap-12">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-40 rounded" />)}
          </div>
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-40 rounded" />)}
          </div>
        </>
      ) : (
        (() => {
          const heroes = [
            { label: "Usuários Ativos Hoje", value: String(stats?.activeUsersToday ?? 0), subtitle: "Usuários únicos que navegaram hoje" },
            { label: "Page Views Hoje", value: String(stats?.pageViewsToday ?? 0), subtitle: "Total de páginas visualizadas hoje" },
            { label: "Logins Hoje", value: String(stats?.loginsToday ?? 0), subtitle: "Logins bem-sucedidos hoje" },
          ];
          return (
            <>
              <div className="hidden md:flex items-start gap-12">
                {heroes.map((m, i) => <HeroMetric key={i} {...m} />)}
              </div>
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {heroes.map((m, i) => <HeroMetric key={i} {...m} />)}
              </div>
            </>
          );
        })()
      )}

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Diária</CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-[300px] rounded-lg" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado de atividade no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300} aria-label="Gráfico de atividade diária do sistema">
              <ComposedChart data={chartData}>
                <CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"} />
                <XAxis dataKey="date" tick={{ fill: "currentColor", fontSize: 12 }} />
                <YAxis hide />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} formatter={(v: string) => v === "pageViews" ? "Page Views" : "Logins"} />
                <Bar dataKey="pageViews" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line dataKey="logins" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Pages + Top Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Páginas</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : !stats?.topPages?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado de páginas.</p>
            ) : (
              <ol className="space-y-2">
                {stats.topPages.map((p: any, i: number) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-5 text-right">{i + 1}.</span>
                      <span className="font-medium truncate max-w-[200px]">{p.pageTitle || p.path}</span>
                    </span>
                    <span className="text-muted-foreground">{p.views} views</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : !stats?.topUsers?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado de usuários.</p>
            ) : (
              <ol className="space-y-2">
                {stats.topUsers.map((u: any, i: number) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-5 text-right">{i + 1}.</span>
                      <span className="font-medium truncate max-w-[200px]">{u.userName || u.userEmail}</span>
                    </span>
                    <span className="text-muted-foreground">{u.views} views</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Auth Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Auth Logs Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {authLogsLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" style={{ width: `${100 - i * 3}%` }} />)}</div>
          ) : !authLogs?.items?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro de autenticação.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted">
                      <th scope="col" className="text-left p-2 font-medium">Data/Hora</th>
                      <th scope="col" className="text-left p-2 font-medium">Usuário</th>
                      <th scope="col" className="text-left p-2 font-medium">Ação</th>
                      <th scope="col" className="text-left p-2 font-medium">IP</th>
                      <th scope="col" className="text-left p-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authLogs.items.map((log: any, i: number) => (
                      <tr key={log.id || i} className={i % 2 === 1 ? "bg-muted/50" : ""}>
                        <td className="p-2 whitespace-nowrap">
                          {log.timestamp ? format(new Date(log.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                        </td>
                        <td className="p-2 truncate max-w-[200px]">{log.user_name || log.user_email || "-"}</td>
                        <td className="p-2">{log.action || "-"}</td>
                        <td className="p-2 font-mono text-xs">{log.ip_address || "-"}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${log.success === "true" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>
                            {log.success === "true" ? "Sucesso" : "Falha"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {authLogs.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {authLogs.page} de {authLogs.totalPages} ({authLogs.total} registros)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAuthLogsPage(p => Math.max(1, p - 1))}
                      disabled={authLogsPage <= 1}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setAuthLogsPage(p => Math.min(authLogs.totalPages, p + 1))}
                      disabled={authLogsPage >= authLogs.totalPages}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
