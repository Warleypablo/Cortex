import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  LogOut,
  RefreshCw,
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

// --- Custom tooltip for charts ---
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        backgroundColor: "#1C1C2E",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "0.75rem",
      }}
    >
      <p style={{ color: "#A1A1B5", marginBottom: 6, fontWeight: 500 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: entry.color,
              display: "inline-block",
            }}
          />
          <span style={{ color: "#A1A1B5" }}>
            {entry.name === "followers"
              ? "Seguidores"
              : entry.name === "reach"
                ? "Alcance"
                : entry.name === "impressions"
                  ? "Impressões"
                  : entry.name}
            :
          </span>
          <span style={{ color: "#FFFFFF", fontWeight: 600, fontFamily: "monospace" }}>
            {fmtNum(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        backgroundColor: "#1C1C2E",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "0.75rem",
      }}
    >
      <p style={{ color: "#A1A1B5", marginBottom: 4, fontWeight: 500 }}>{label}</p>
      <p style={{ color: "#FFFFFF", fontWeight: 600, fontFamily: "monospace" }}>
        {fmtNum(payload[0].value)}
      </p>
    </div>
  );
}

export default function InstagramDashboard() {
  usePageTitle("Instagram Analytics");
  useSetPageInfo("Instagram Analytics", "Métricas e performance do Instagram da Turbo");

  const { theme } = useTheme();
  const isDark = theme === "dark";
  const queryClient = useQueryClient();

  // Date state
  const [endDate, setEndDate] = useState(() => dateStr(new Date()));
  const [startDate, setStartDate] = useState(() => dateStr(subDays(new Date(), 30)));
  const [activePreset, setActivePreset] = useState<number>(30);

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

  // --- Disconnect ---
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!connId) return;
      const res = await fetch(`/api/instagram/connections/${connId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao desconectar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/connections"] });
    },
  });

  // --- Sync ---
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!connId) return;
      const res = await fetch(`/api/instagram/connections/${connId}/sync`, { method: "POST" });
      if (!res.ok) throw new Error("Erro ao sincronizar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/connections"] });
    },
  });

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
    setActivePreset(days);
  }

  const isLoading = loadingConn || loadingMetrics || loadingPosts;

  // --- Render helpers ---
  function renderNumCell(n: number) {
    if (n === 0) return <span style={{ color: "#52526A" }}>—</span>;
    return fmtNum(n);
  }

  // --- Empty state: no connection ---
  if (!loadingConn && !activeConnection) {
    return (
      <div
        style={{ backgroundColor: "#0A0A0F", minHeight: "100vh" }}
        className="p-6"
      >
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Instagram style={{ color: "rgba(255,255,255,0.25)" }} className="w-16 h-16" />
          <h2 style={{ color: "#FFFFFF" }} className="text-xl font-semibold">
            Nenhuma conta Instagram conectada
          </h2>
          <p style={{ color: "#A1A1B5" }} className="text-center max-w-md text-sm">
            Para visualizar as métricas, conecte uma conta Instagram Business na página
            de configurações de integrações.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#0A0A0F",
        minHeight: "100vh",
        fontFeatureSettings: '"tnum"',
      }}
      className="p-6 space-y-6"
    >
      {/* Custom scrollbar styles */}
      <style>{`
        .ig-dash ::-webkit-scrollbar { width: 6px; height: 6px; }
        .ig-dash ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .ig-dash ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .ig-dash ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        .ig-dash * { transition: all 0.15s ease; }
        .ig-dash input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(0.6);
        }
      `}</style>

      <div className="ig-dash space-y-6">
        {/* ───── 1. Date Controls ───── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented preset control */}
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderRadius: "8px",
              padding: "3px",
              display: "inline-flex",
              gap: "2px",
            }}
          >
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p.days)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    activePreset === p.days ? "rgba(108,99,255,0.15)" : "transparent",
                  color: activePreset === p.days ? "#6C63FF" : "#52526A",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date inputs */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setActivePreset(0);
            }}
            style={{
              height: "34px",
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "6px",
              color: "#A1A1B5",
              fontSize: "0.8rem",
              padding: "0 10px",
              outline: "none",
            }}
          />
          <span style={{ color: "#52526A", fontSize: "0.75rem" }}>—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setActivePreset(0);
            }}
            style={{
              height: "34px",
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "6px",
              color: "#A1A1B5",
              fontSize: "0.8rem",
              padding: "0 10px",
              outline: "none",
            }}
          />

          <div className="flex items-center gap-3 ml-auto">
            {connId && (
              <>
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  title="Sincronizar dados"
                  style={{
                    width: "34px",
                    height: "34px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    backgroundColor: "transparent",
                    color: "#A1A1B5",
                    cursor: "pointer",
                    opacity: syncMutation.isPending ? 0.5 : 1,
                  }}
                >
                  <RefreshCw
                    className={cn("h-3.5 w-3.5", syncMutation.isPending && "animate-spin")}
                  />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Desconectar o Instagram?")) disconnectMutation.mutate();
                  }}
                  disabled={disconnectMutation.isPending}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#52526A",
                    fontSize: "0.7rem",
                    cursor: "pointer",
                    padding: "4px 8px",
                    opacity: disconnectMutation.isPending ? 0.5 : 1,
                  }}
                >
                  Desconectar
                </button>
              </>
            )}
          </div>
        </div>

        {/* ───── 2. KPI Cards ───── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: "16px" }}>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: "#111118",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <Skeleton className="h-3 w-20 mb-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
                <Skeleton className="h-8 w-28" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
              </div>
            ))
          ) : (
            <>
              {/* Seguidores */}
              <div
                style={{
                  backgroundColor: "#111118",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  padding: "16px",
                  cursor: "default",
                }}
                className="group"
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 0 1px rgba(108,99,255,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      style={{
                        fontSize: "0.65rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#52526A",
                        fontWeight: 500,
                        marginBottom: "8px",
                      }}
                    >
                      SEGUIDORES
                    </p>
                    <p
                      style={{
                        fontSize: "2.2rem",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        fontFamily: "monospace",
                        lineHeight: 1.1,
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      {fmtNum(heroData.followers)}
                    </p>
                    {heroData.followersDelta !== 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "8px",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: heroData.followersDelta >= 0
                            ? "rgba(16,185,129,0.1)"
                            : "rgba(244,63,94,0.1)",
                          color: heroData.followersDelta >= 0 ? "#10B981" : "#F43F5E",
                        }}
                      >
                        {heroData.followersDelta >= 0 ? "↑" : "↓"}{" "}
                        {heroData.followersDelta >= 0 ? "+" : ""}
                        {fmtNum(heroData.followersDelta)}
                      </span>
                    )}
                  </div>
                  <Users style={{ color: "rgba(255,255,255,0.25)", width: 20, height: 20, marginTop: 2 }} />
                </div>
              </div>

              {/* Reach Total */}
              <div
                style={{
                  backgroundColor: "#111118",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  padding: "16px",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 0 1px rgba(108,99,255,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      style={{
                        fontSize: "0.65rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#52526A",
                        fontWeight: 500,
                        marginBottom: "8px",
                      }}
                    >
                      REACH TOTAL
                    </p>
                    <p
                      style={{
                        fontSize: "2.2rem",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        fontFamily: "monospace",
                        lineHeight: 1.1,
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      {fmtNum(heroData.reach)}
                    </p>
                  </div>
                  <Eye style={{ color: "rgba(255,255,255,0.25)", width: 20, height: 20, marginTop: 2 }} />
                </div>
              </div>

              {/* Impressões */}
              <div
                style={{
                  backgroundColor: "#111118",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  padding: "16px",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 0 1px rgba(108,99,255,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      style={{
                        fontSize: "0.65rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#52526A",
                        fontWeight: 500,
                        marginBottom: "8px",
                      }}
                    >
                      IMPRESSÕES
                    </p>
                    <p
                      style={{
                        fontSize: "2.2rem",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        fontFamily: "monospace",
                        lineHeight: 1.1,
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      {fmtNum(heroData.impressions)}
                    </p>
                  </div>
                  <TrendingUp style={{ color: "rgba(255,255,255,0.25)", width: 20, height: 20, marginTop: 2 }} />
                </div>
              </div>

              {/* Engajamento */}
              <div
                style={{
                  backgroundColor: "#111118",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  padding: "16px",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 0 1px rgba(108,99,255,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      style={{
                        fontSize: "0.65rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#52526A",
                        fontWeight: 500,
                        marginBottom: "8px",
                      }}
                    >
                      ENGAJAMENTO
                    </p>
                    <p
                      style={{
                        fontSize: "2.2rem",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        fontFamily: "monospace",
                        lineHeight: 1.1,
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      {fmtPct(heroData.engagementRate)}
                    </p>
                  </div>
                  <MousePointerClick style={{ color: "rgba(255,255,255,0.25)", width: 20, height: 20, marginTop: 2 }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ───── 3. Evolution Chart ───── */}
        <div style={{ padding: "24px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "2px",
                height: "14px",
                backgroundColor: "#6C63FF",
                borderRadius: "1px",
              }}
            />
            <h3
              style={{
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#52526A",
                fontWeight: 600,
              }}
            >
              Evolução no Período
            </h3>
          </div>

          {isLoading ? (
            <Skeleton
              className="w-full rounded-lg"
              style={{ height: 320, backgroundColor: "rgba(255,255,255,0.04)" }}
            />
          ) : evolutionData.length === 0 ? (
            <p
              style={{ color: "#52526A", fontSize: "0.85rem", textAlign: "center", padding: "80px 0" }}
            >
              Sem dados para o período selecionado.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={evolutionData}>
                <defs>
                  <linearGradient id="gradFollowers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D4C8" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#00D4C8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#52526A", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#52526A", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtNum}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#52526A", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtNum}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="followers"
                  fill="url(#gradFollowers)"
                  stroke="#6C63FF"
                  strokeWidth={2}
                  name="followers"
                  dot={false}
                  activeDot={{ r: 4, fill: "#6C63FF", stroke: "#0A0A0F", strokeWidth: 2 }}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="reach"
                  fill="url(#gradReach)"
                  stroke="#00D4C8"
                  strokeWidth={2}
                  name="reach"
                  dot={false}
                  activeDot={{ r: 4, fill: "#00D4C8", stroke: "#0A0A0F", strokeWidth: 2 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="impressions"
                  stroke="#A1A1B5"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  name="impressions"
                  activeDot={{ r: 3, fill: "#A1A1B5", stroke: "#0A0A0F", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ───── 4. Performance by Type ───── */}
        <div style={{ padding: "24px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "2px",
                height: "14px",
                backgroundColor: "#6C63FF",
                borderRadius: "1px",
              }}
            />
            <h3
              style={{
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#52526A",
                fontWeight: 600,
              }}
            >
              Engajamento por Tipo
            </h3>
          </div>

          {isLoading ? (
            <Skeleton
              className="w-full rounded-lg"
              style={{ height: 260, backgroundColor: "rgba(255,255,255,0.04)" }}
            />
          ) : perfByType.length === 0 ? (
            <p
              style={{ color: "#52526A", fontSize: "0.85rem", textAlign: "center", padding: "64px 0" }}
            >
              Sem posts no período selecionado.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={perfByType} barSize={56}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 11, fill: "#52526A" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#52526A", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtNum}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar
                  dataKey="avgEngagement"
                  fill="#6C63FF"
                  radius={[4, 4, 0, 0]}
                  label={{
                    position: "top",
                    fill: "#A1A1B5",
                    fontSize: 11,
                    fontFamily: "monospace",
                    formatter: (v: number) => fmtNum(v),
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ───── 5. Top Posts Table ───── */}
        <div style={{ padding: "24px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "2px",
                height: "14px",
                backgroundColor: "#6C63FF",
                borderRadius: "1px",
              }}
            />
            <h3
              style={{
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#52526A",
                fontWeight: 600,
              }}
            >
              Top Posts
            </h3>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-full rounded"
                  style={{ height: 48, backgroundColor: "rgba(255,255,255,0.04)" }}
                />
              ))}
            </div>
          ) : sortedPosts.length === 0 ? (
            <p
              style={{ color: "#52526A", fontSize: "0.85rem", textAlign: "center", padding: "48px 0" }}
            >
              Nenhum post encontrado no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 8px",
                        fontSize: "0.65rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#52526A",
                        fontWeight: 500,
                        width: "40px",
                        position: "sticky",
                        top: 0,
                        backgroundColor: "#0A0A0F",
                      }}
                    >
                      {/* thumbnail */}
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 8px",
                        fontSize: "0.65rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#52526A",
                        fontWeight: 500,
                        minWidth: "200px",
                        position: "sticky",
                        top: 0,
                        backgroundColor: "#0A0A0F",
                      }}
                    >
                      Legenda
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 8px",
                        fontSize: "0.65rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#52526A",
                        fontWeight: 500,
                        position: "sticky",
                        top: 0,
                        backgroundColor: "#0A0A0F",
                      }}
                    >
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
                        style={{
                          textAlign: "right",
                          padding: "8px 8px",
                          fontSize: "0.65rem",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                          userSelect: "none",
                          color: sortKey === key ? "#6C63FF" : "#52526A",
                          position: "sticky",
                          top: 0,
                          backgroundColor: "#0A0A0F",
                        }}
                      >
                        {label}
                        {sortKey === key && (
                          <span style={{ marginLeft: "2px" }}>{sortAsc ? "▲" : "▼"}</span>
                        )}
                      </th>
                    ))}
                    <th
                      style={{
                        padding: "8px 8px",
                        width: "32px",
                        position: "sticky",
                        top: 0,
                        backgroundColor: "#0A0A0F",
                      }}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedPosts.map((post) => (
                    <tr
                      key={post.igMediaId}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                      className="group"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      {/* Thumbnail */}
                      <td style={{ padding: "8px 8px" }}>
                        {post.thumbnailUrl ? (
                          <img
                            src={post.thumbnailUrl}
                            alt=""
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "6px",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "6px",
                              backgroundColor: "rgba(255,255,255,0.06)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Instagram
                              style={{ width: 14, height: 14, color: "rgba(255,255,255,0.15)" }}
                            />
                          </div>
                        )}
                      </td>
                      {/* Caption */}
                      <td
                        style={{
                          padding: "8px 8px",
                          color: "#FFFFFF",
                          fontSize: "0.85rem",
                        }}
                      >
                        <span className="line-clamp-1">
                          {post.caption
                            ? post.caption.length > 60
                              ? post.caption.slice(0, 60) + "..."
                              : post.caption
                            : <span style={{ color: "#52526A" }}>—</span>}
                        </span>
                      </td>
                      {/* Type badge */}
                      <td style={{ padding: "8px 8px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "0.6rem",
                            fontWeight: 500,
                            padding: "2px 8px",
                            borderRadius: "4px",
                            border:
                              post.mediaType === "CAROUSEL_ALBUM"
                                ? "1px solid rgba(108,99,255,0.4)"
                                : post.mediaType === "VIDEO"
                                  ? "1px solid rgba(0,212,200,0.4)"
                                  : "1px solid rgba(255,255,255,0.1)",
                            color:
                              post.mediaType === "CAROUSEL_ALBUM"
                                ? "#6C63FF"
                                : post.mediaType === "VIDEO"
                                  ? "#00D4C8"
                                  : "#A1A1B5",
                            backgroundColor: "transparent",
                            letterSpacing: "0.03em",
                            textTransform: "uppercase",
                          }}
                        >
                          {MEDIA_LABELS[post.mediaType] || post.mediaType}
                        </span>
                      </td>
                      {/* Numeric columns */}
                      <td
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                          color: "#FFFFFF",
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {renderNumCell(post.likes)}
                      </td>
                      <td
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                          color: "#FFFFFF",
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {renderNumCell(post.comments)}
                      </td>
                      <td
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                          color: "#FFFFFF",
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {renderNumCell(post.saves)}
                      </td>
                      <td
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                          color: "#FFFFFF",
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {renderNumCell(post.shares)}
                      </td>
                      <td
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                          color: "#FFFFFF",
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {renderNumCell(post.reach)}
                      </td>
                      <td
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                          color: "#FFFFFF",
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {renderNumCell(post.impressions)}
                      </td>
                      <td
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "#FFFFFF",
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {renderNumCell(post.totalInteractions)}
                      </td>
                      {/* Link — only visible on hover */}
                      <td style={{ padding: "8px 8px" }}>
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#52526A",
                            opacity: 0,
                          }}
                          className="group-hover:!opacity-100"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#6C63FF";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "#52526A";
                          }}
                        >
                          <ExternalLink style={{ width: 14, height: 14 }} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
