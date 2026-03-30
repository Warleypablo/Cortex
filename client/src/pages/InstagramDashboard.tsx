import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroMetric } from "@/components/HeroMetric";
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Instagram,
  Users,
  Eye,
  MousePointerClick,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// --- Types ---
interface IgMetric {
  connectionId: number;
  metricDate: string;
  followers: number;
  following: number;
  postsCount: number;
  reachDay: number;
  impressionsDay: number;
  recordedAt: string;
}

interface IgPost {
  connectionId: number;
  igMediaId: string;
  mediaType: string;
  caption: string | null;
  permalink: string;
  thumbnailUrl: string | null;
  postedAt: string | null;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  impressions: number;
  reach: number;
  plays: number;
  totalInteractions: number;
  lastSyncedAt: string;
}

interface IgConnection {
  id: number;
  igUsername: string;
  isActive: boolean;
  [key: string]: unknown;
}

// --- Helpers ---
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("pt-BR");
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function dateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// --- Preset buttons ---
const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

// --- Media type labels ---
const MEDIA_LABELS: Record<string, string> = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  CAROUSEL_ALBUM: "Carrossel",
};

// --- Sort keys for table ---
type SortKey =
  | "totalInteractions"
  | "likes"
  | "comments"
  | "saves"
  | "shares"
  | "reach"
  | "impressions";

export default function InstagramDashboard() {
  usePageTitle("Instagram Analytics");
  useSetPageInfo("Instagram Analytics", "Métricas e performance do Instagram da Turbo");

  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Date state
  const [endDate, setEndDate] = useState(() => dateStr(new Date()));
  const [startDate, setStartDate] = useState(() => dateStr(subDays(new Date(), 30)));

  // Sort state for posts table
  const [sortKey, setSortKey] = useState<SortKey>("totalInteractions");
  const [sortAsc, setSortAsc] = useState(false);

  // --- Fetch connection ---
  const {
    data: connections,
    isLoading: loadingConn,
  } = useQuery<IgConnection[]>({
    queryKey: ["/api/instagram/connections"],
    queryFn: async () => {
      const res = await fetch("/api/instagram/connections");
      if (!res.ok) throw new Error("Erro ao buscar conexões Instagram");
      return res.json();
    },
  });

  const activeConnection = useMemo(
    () => connections?.find((c) => c.isActive) ?? connections?.[0] ?? null,
    [connections],
  );
  const connId = activeConnection?.id;

  // --- Fetch metrics ---
  const { data: metrics, isLoading: loadingMetrics } = useQuery<IgMetric[]>({
    queryKey: ["/api/instagram/connections", connId, "metrics", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/instagram/connections/${connId}/metrics?startDate=${startDate}&endDate=${endDate}`,
      );
      if (!res.ok) throw new Error("Erro ao buscar métricas");
      return res.json();
    },
    enabled: !!connId,
  });

  // --- Fetch posts ---
  const { data: posts, isLoading: loadingPosts } = useQuery<IgPost[]>({
    queryKey: ["/api/instagram/connections", connId, "posts", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/instagram/connections/${connId}/posts?startDate=${startDate}&endDate=${endDate}&limit=100`,
      );
      if (!res.ok) throw new Error("Erro ao buscar posts");
      return res.json();
    },
    enabled: !!connId,
  });

  // --- Computed hero metrics ---
  const heroData = useMemo(() => {
    if (!metrics || metrics.length === 0)
      return { followers: 0, followersDelta: 0, reach: 0, impressions: 0, engagementRate: 0 };

    const sorted = [...metrics].sort(
      (a, b) => new Date(a.metricDate).getTime() - new Date(b.metricDate).getTime(),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const followers = last.followers;
    const followersDelta = last.followers - first.followers;
    const reach = sorted.reduce((s, m) => s + m.reachDay, 0);
    const impressions = sorted.reduce((s, m) => s + m.impressionsDay, 0);

    // Engagement rate: avg interactions / avg reach across posts
    let engagementRate = 0;
    if (posts && posts.length > 0) {
      const avgInteractions =
        posts.reduce((s, p) => s + p.totalInteractions, 0) / posts.length;
      const avgReach = posts.reduce((s, p) => s + p.reach, 0) / posts.length;
      if (avgReach > 0) engagementRate = avgInteractions / avgReach;
    }

    return { followers, followersDelta, reach, impressions, engagementRate };
  }, [metrics, posts]);

  // --- Evolution chart data ---
  const evolutionData = useMemo(() => {
    if (!metrics) return [];
    return [...metrics]
      .sort((a, b) => new Date(a.metricDate).getTime() - new Date(b.metricDate).getTime())
      .map((m) => ({
        date: format(parseISO(m.metricDate), "dd/MM", { locale: ptBR }),
        followers: m.followers,
        reach: m.reachDay,
        impressions: m.impressionsDay,
      }));
  }, [metrics]);

  // --- Performance by type ---
  const perfByType = useMemo(() => {
    if (!posts || posts.length === 0) return [];
    const grouped: Record<string, { total: number; count: number }> = {};
    for (const p of posts) {
      const key = p.mediaType || "OTHER";
      if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
      grouped[key].total += p.likes + p.comments + p.saves + p.shares;
      grouped[key].count += 1;
    }
    return Object.entries(grouped).map(([type, { total, count }]) => ({
      type: MEDIA_LABELS[type] || type,
      avgEngagement: Math.round(total / count),
    }));
  }, [posts]);

  // --- Sorted posts ---
  const sortedPosts = useMemo(() => {
    if (!posts) return [];
    return [...posts].sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? diff : -diff;
    });
  }, [posts, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function handlePreset(days: number) {
    const end = new Date();
    setEndDate(dateStr(end));
    setStartDate(dateStr(subDays(end, days)));
  }

  // --- Chart colors ---
  const chartColors = {
    followers: isDark ? "#a78bfa" : "#7c3aed",
    reach: isDark ? "#34d399" : "#059669",
    impressions: isDark ? "#60a5fa" : "#2563eb",
    bar: isDark ? "#f472b6" : "#db2777",
  };

  const isLoading = loadingConn || loadingMetrics || loadingPosts;

  // --- Empty state: no connection ---
  if (!loadingConn && !activeConnection) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Instagram className="w-16 h-16 text-pink-500 opacity-50" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Nenhuma conta Instagram conectada
          </h2>
          <p className="text-gray-600 dark:text-zinc-400 text-center max-w-md">
            Para visualizar as métricas, conecte uma conta Instagram Business na página
            de configurações de integrações.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ───── 1. Date Picker Row ───── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">
            Data Início
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">
            Data Fim
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.days)}
              className={cn(
                "h-9 px-3 rounded-lg text-sm font-medium transition-colors",
                "border border-gray-200 dark:border-zinc-700",
                "hover:bg-violet-50 dark:hover:bg-violet-900/30",
                "text-gray-700 dark:text-zinc-300",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ───── 2. Hero Metrics ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <HeroMetric
                    label="Seguidores"
                    value={fmtNum(heroData.followers)}
                    subtitle="Total atual de seguidores"
                    trend={{
                      value: `${heroData.followersDelta >= 0 ? "+" : ""}${fmtNum(heroData.followersDelta)} no período`,
                      isPositive: heroData.followersDelta >= 0,
                    }}
                  />
                  <Users className="w-5 h-5 text-violet-500 mt-1" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <HeroMetric
                    label="Reach Total"
                    value={fmtNum(heroData.reach)}
                    subtitle="Soma de alcance diário no período"
                  />
                  <Eye className="w-5 h-5 text-emerald-500 mt-1" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <HeroMetric
                    label="Impressões Totais"
                    value={fmtNum(heroData.impressions)}
                    subtitle="Soma de impressões diárias no período"
                  />
                  <TrendingUp className="w-5 h-5 text-blue-500 mt-1" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <HeroMetric
                    label="Engajamento Médio"
                    value={fmtPct(heroData.engagementRate)}
                    subtitle="Média de interações / alcance dos posts"
                  />
                  <MousePointerClick className="w-5 h-5 text-pink-500 mt-1" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ───── 3. Evolution Chart ───── */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Evolução no Período
          </h3>
          {isLoading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : evolutionData.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-20">
              Sem dados para o período selecionado.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={evolutionData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "#3f3f46" : "#e5e7eb"}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtNum}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtNum}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#18181b" : "#ffffff",
                    border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                    borderRadius: "0.5rem",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: isDark ? "#e4e4e7" : "#111827" }}
                  formatter={(value: number, name: string) => [
                    fmtNum(value),
                    name === "followers"
                      ? "Seguidores"
                      : name === "reach"
                        ? "Alcance"
                        : "Impressões",
                  ]}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="followers"
                  fill={chartColors.followers}
                  fillOpacity={0.15}
                  stroke={chartColors.followers}
                  strokeWidth={2}
                  name="followers"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="reach"
                  stroke={chartColors.reach}
                  strokeWidth={2}
                  dot={false}
                  name="reach"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="impressions"
                  stroke={chartColors.impressions}
                  strokeWidth={2}
                  dot={false}
                  name="impressions"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ───── 4. Performance by Type ───── */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Engajamento Médio por Tipo de Mídia
          </h3>
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : perfByType.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-16">
              Sem posts no período selecionado.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={perfByType} barSize={48}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "#3f3f46" : "#e5e7eb"}
                />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 12, fill: isDark ? "#a1a1aa" : "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtNum}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#18181b" : "#ffffff",
                    border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                    borderRadius: "0.5rem",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [fmtNum(value), "Eng. Médio"]}
                />
                <Bar
                  dataKey="avgEngagement"
                  fill={chartColors.bar}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ───── 5. Top Posts Table ───── */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Top Posts
          </h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : sortedPosts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-12">
              Nenhum post encontrado no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-zinc-700">
                    <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-zinc-400 w-10">
                      {/* thumbnail */}
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-zinc-400 min-w-[200px]">
                      Legenda
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-zinc-400">
                      Tipo
                    </th>
                    {(
                      [
                        ["likes", "Likes"],
                        ["comments", "Coment."],
                        ["saves", "Saves"],
                        ["shares", "Shares"],
                        ["reach", "Alcance"],
                        ["impressions", "Impr."],
                        ["totalInteractions", "Total"],
                      ] as [SortKey, string][]
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className={cn(
                          "text-right py-2 px-2 font-medium cursor-pointer select-none whitespace-nowrap",
                          sortKey === key
                            ? "text-violet-600 dark:text-violet-400"
                            : "text-gray-500 dark:text-zinc-400",
                        )}
                      >
                        {label}
                        {sortKey === key && (
                          <span className="ml-0.5">{sortAsc ? "▲" : "▼"}</span>
                        )}
                      </th>
                    ))}
                    <th className="py-2 px-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sortedPosts.map((post) => (
                    <tr
                      key={post.igMediaId}
                      className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      {/* Thumbnail */}
                      <td className="py-2 px-2">
                        {post.thumbnailUrl ? (
                          <img
                            src={post.thumbnailUrl}
                            alt=""
                            className="w-10 h-10 rounded-md object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                            <Instagram className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
                          </div>
                        )}
                      </td>
                      {/* Caption */}
                      <td className="py-2 px-2 text-gray-900 dark:text-white">
                        <span className="line-clamp-1">
                          {post.caption
                            ? post.caption.length > 60
                              ? post.caption.slice(0, 60) + "..."
                              : post.caption
                            : "—"}
                        </span>
                      </td>
                      {/* Type badge */}
                      <td className="py-2 px-2">
                        <span
                          className={cn(
                            "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                            post.mediaType === "VIDEO"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              : post.mediaType === "CAROUSEL_ALBUM"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300",
                          )}
                        >
                          {MEDIA_LABELS[post.mediaType] || post.mediaType}
                        </span>
                      </td>
                      {/* Numeric columns */}
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-zinc-300 tabular-nums">
                        {fmtNum(post.likes)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-zinc-300 tabular-nums">
                        {fmtNum(post.comments)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-zinc-300 tabular-nums">
                        {fmtNum(post.saves)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-zinc-300 tabular-nums">
                        {fmtNum(post.shares)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-zinc-300 tabular-nums">
                        {fmtNum(post.reach)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-zinc-300 tabular-nums">
                        {fmtNum(post.impressions)}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                        {fmtNum(post.totalInteractions)}
                      </td>
                      {/* Link */}
                      <td className="py-2 px-2">
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-violet-500 dark:text-zinc-500 dark:hover:text-violet-400 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
