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
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
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
import { format, subDays, parseISO, getDay, getHours, getISOWeek } from "date-fns";
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
  | "impressions"
  | "engagementRate";

// --- Day labels ---
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_LABELS_HEATMAP = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// --- Media type filter ---
type MediaFilter = "ALL" | "CAROUSEL_ALBUM" | "VIDEO";

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
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: entry.color || entry.fill,
              display: "inline-block",
            }}
          />
          <span style={{ color: "#A1A1B5" }}>{entry.name}:</span>
          <span style={{ color: "#FFFFFF", fontWeight: 600, fontFamily: "monospace" }}>
            {fmtNum(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// --- Section title helper ---
function SectionTitle({ children }: { children: string }) {
  return (
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
        {children}
      </h3>
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

  // Media type filter for posts table
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("ALL");

  // Heatmap tooltip state
  const [heatmapTooltip, setHeatmapTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    day: string;
    hour: number;
    avgEng: number;
    count: number;
  } | null>(null);

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

  // --- Computed hero metrics (IMPROVED: fixed engagement calc, added reach/views trends) ---
  const heroData = useMemo(() => {
    if (!metrics || metrics.length === 0)
      return {
        followers: 0,
        followersDelta: 0,
        reach: 0,
        reachPrevious: 0,
        impressions: 0,
        impressionsPrevious: 0,
        engagementRate: 0,
      };

    const sorted = [...metrics].sort(
      (a, b) => new Date(a.metricDate).getTime() - new Date(b.metricDate).getTime(),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const followers = last.followers;
    const followersDelta = last.followers - first.followers;
    const reach = sorted.reduce((s, m) => s + m.reachDay, 0);
    const impressions = sorted.reduce((s, m) => s + m.impressionsDay, 0);

    // Split period in half for previous period comparison
    const midIdx = Math.floor(sorted.length / 2);
    const reachPrevious = sorted.slice(0, midIdx).reduce((s, m) => s + m.reachDay, 0);
    const reachCurrent = sorted.slice(midIdx).reduce((s, m) => s + m.reachDay, 0);
    const impressionsPrevious = sorted.slice(0, midIdx).reduce((s, m) => s + m.impressionsDay, 0);
    const impressionsCurrent = sorted.slice(midIdx).reduce((s, m) => s + m.impressionsDay, 0);

    // Engagement rate: (likes+comments+saves+shares) / totalReach * 100
    let engagementRate = 0;
    if (posts && posts.length > 0) {
      const totalInteractions = posts.reduce(
        (s, p) => s + p.likes + p.comments + p.saves + p.shares,
        0,
      );
      const totalReach = posts.reduce((s, p) => s + p.reach, 0);
      if (totalReach > 0) engagementRate = totalInteractions / totalReach;
    }

    return {
      followers,
      followersDelta,
      reach,
      reachDelta: reachCurrent - reachPrevious,
      impressions,
      impressionsDelta: impressionsCurrent - impressionsPrevious,
      engagementRate,
    };
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

  // --- Performance by type (IMPROVED: grouped bars for likes, comments, saves, shares) ---
  const perfByType = useMemo(() => {
    if (!posts || posts.length === 0) return [];
    const grouped: Record<
      string,
      { likes: number; comments: number; saves: number; shares: number; count: number }
    > = {};
    for (const p of posts) {
      const key = p.mediaType || "OTHER";
      if (!grouped[key])
        grouped[key] = { likes: 0, comments: 0, saves: 0, shares: 0, count: 0 };
      grouped[key].likes += p.likes;
      grouped[key].comments += p.comments;
      grouped[key].saves += p.saves;
      grouped[key].shares += p.shares;
      grouped[key].count += 1;
    }
    return Object.entries(grouped).map(([type, d]) => ({
      type: MEDIA_LABELS[type] || type,
      "Avg Likes": Math.round(d.likes / d.count),
      "Avg Coment.": Math.round(d.comments / d.count),
      "Avg Saves": Math.round(d.saves / d.count),
      "Avg Shares": Math.round(d.shares / d.count),
    }));
  }, [posts]);

  // --- Sorted posts (IMPROVED: with engagement rate and media filter) ---
  const sortedPosts = useMemo(() => {
    if (!posts) return [];
    let filtered = [...posts];
    if (mediaFilter !== "ALL") {
      filtered = filtered.filter((p) => p.mediaType === mediaFilter);
    }
    return filtered
      .map((p) => {
        const eng = p.likes + p.comments + p.saves + p.shares;
        const er = p.reach > 0 ? (eng / p.reach) * 100 : 0;
        return { ...p, engagementRate: er };
      })
      .sort((a, b) => {
        const valA = sortKey === "engagementRate" ? a.engagementRate : (a[sortKey] as number);
        const valB = sortKey === "engagementRate" ? b.engagementRate : (b[sortKey] as number);
        const diff = valA - valB;
        return sortAsc ? diff : -diff;
      });
  }, [posts, sortKey, sortAsc, mediaFilter]);

  // --- Heatmap data: best times to post ---
  const heatmapData = useMemo(() => {
    if (!posts || posts.length === 0) return null;
    // grid[dayOfWeek 0-6][hour 0-23] = { totalEng, count }
    const grid: Record<number, Record<number, { totalEng: number; count: number }>> = {};
    for (let d = 0; d < 7; d++) {
      grid[d] = {};
      for (let h = 0; h < 24; h++) {
        grid[d][h] = { totalEng: 0, count: 0 };
      }
    }

    let maxAvg = 0;
    for (const p of posts) {
      if (!p.postedAt) continue;
      const dt = parseISO(p.postedAt);
      const day = getDay(dt); // 0=Sun, 1=Mon...6=Sat
      const hour = getHours(dt);
      const eng = p.likes + p.comments + p.saves + p.shares;
      grid[day][hour].totalEng += eng;
      grid[day][hour].count += 1;
    }

    // Compute avg and find max
    const cells: {
      dayIdx: number;
      day: string;
      hour: number;
      avgEng: number;
      count: number;
    }[] = [];
    // Reorder: Mon=1, Tue=2, ..., Sun=0 → mapped to rows 0-6
    const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
    for (let rowIdx = 0; rowIdx < 7; rowIdx++) {
      const dIdx = dayOrder[rowIdx];
      for (let h = 0; h < 24; h++) {
        const cell = grid[dIdx][h];
        const avg = cell.count > 0 ? cell.totalEng / cell.count : 0;
        if (avg > maxAvg) maxAvg = avg;
        cells.push({
          dayIdx: rowIdx,
          day: DAY_LABELS_HEATMAP[rowIdx],
          hour: h,
          avgEng: avg,
          count: cell.count,
        });
      }
    }

    return { cells, maxAvg };
  }, [posts]);

  // --- Frequency data: posts per week + avg engagement per week ---
  const frequencyData = useMemo(() => {
    if (!posts || posts.length === 0) return [];
    const postsWithDate = posts
      .filter((p) => p.postedAt)
      .map((p) => ({
        ...p,
        dt: parseISO(p.postedAt!),
      }))
      .sort((a, b) => a.dt.getTime() - b.dt.getTime());

    if (postsWithDate.length === 0) return [];

    const weekMap: Record<string, { count: number; totalEng: number }> = {};
    for (const p of postsWithDate) {
      const weekNum = getISOWeek(p.dt);
      const year = p.dt.getFullYear();
      const key = `${year}-W${weekNum}`;
      if (!weekMap[key]) weekMap[key] = { count: 0, totalEng: 0 };
      weekMap[key].count += 1;
      weekMap[key].totalEng += p.likes + p.comments + p.saves + p.shares;
    }

    const sortedKeys = Object.keys(weekMap).sort();
    return sortedKeys.map((key, i) => ({
      week: `Sem ${i + 1}`,
      posts: weekMap[key].count,
      avgEngagement:
        weekMap[key].count > 0
          ? Math.round(weekMap[key].totalEng / weekMap[key].count)
          : 0,
    }));
  }, [posts]);

  // --- Engagement rate over time ---
  const engagementOverTime = useMemo(() => {
    if (!posts || posts.length === 0) return [];
    const postsWithDate = posts
      .filter((p) => p.postedAt)
      .map((p) => {
        const eng = p.likes + p.comments + p.saves + p.shares;
        const er = p.reach > 0 ? (eng / p.reach) * 100 : (p.likes + p.comments > 0 ? ((p.likes + p.comments) / 1) * 0.01 : 0);
        return {
          dt: parseISO(p.postedAt!),
          date: format(parseISO(p.postedAt!), "dd/MM", { locale: ptBR }),
          engagementRate: parseFloat(er.toFixed(2)),
          caption: p.caption ? (p.caption.length > 30 ? p.caption.slice(0, 30) + "..." : p.caption) : "Post",
        };
      })
      .sort((a, b) => a.dt.getTime() - b.dt.getTime());

    // Compute 7-post moving average
    return postsWithDate.map((item, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const windowSlice = postsWithDate.slice(windowStart, idx + 1);
      const ma = windowSlice.reduce((s, x) => s + x.engagementRate, 0) / windowSlice.length;
      return {
        ...item,
        movingAvg: parseFloat(ma.toFixed(2)),
      };
    });
  }, [posts]);

  // --- Follower growth (daily delta) ---
  const followerGrowth = useMemo(() => {
    if (!metrics || metrics.length < 2) return [];
    const sorted = [...metrics].sort(
      (a, b) => new Date(a.metricDate).getTime() - new Date(b.metricDate).getTime(),
    );
    return sorted.slice(1).map((m, i) => {
      const delta = m.followers - sorted[i].followers;
      return {
        date: format(parseISO(m.metricDate), "dd/MM", { locale: ptBR }),
        delta,
        fill: delta >= 0 ? "#10B981" : "#F43F5E",
      };
    });
  }, [metrics]);

  // --- Benchmarks ---
  const benchmarks = useMemo(() => {
    if (!posts || posts.length === 0 || !metrics || metrics.length === 0)
      return null;

    // Engagement Rate
    const totalInteractions = posts.reduce(
      (s, p) => s + p.likes + p.comments + p.saves + p.shares,
      0,
    );
    const totalReach = posts.reduce((s, p) => s + p.reach, 0);
    const engRate = totalReach > 0 ? (totalInteractions / totalReach) * 100 : 0;

    // Reach Rate (avg daily reach / followers)
    const sortedMetrics = [...metrics].sort(
      (a, b) => new Date(a.metricDate).getTime() - new Date(b.metricDate).getTime(),
    );
    const lastFollowers = sortedMetrics[sortedMetrics.length - 1].followers;
    const avgDailyReach =
      sortedMetrics.reduce((s, m) => s + m.reachDay, 0) / sortedMetrics.length;
    const reachRate = lastFollowers > 0 ? (avgDailyReach / lastFollowers) * 100 : 0;

    // Comments/Likes Ratio
    const totalComments = posts.reduce((s, p) => s + p.comments, 0);
    const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
    const commentsLikesRatio = totalLikes > 0 ? (totalComments / totalLikes) * 100 : 0;

    return {
      engRate: parseFloat(engRate.toFixed(2)),
      engBenchMin: 1.5,
      engBenchMax: 3,
      reachRate: parseFloat(reachRate.toFixed(2)),
      reachBenchMin: 10,
      reachBenchMax: 20,
      commentsLikesRatio: parseFloat(commentsLikesRatio.toFixed(2)),
      clBenchMin: 2,
      clBenchMax: 5,
    };
  }, [posts, metrics]);

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

  function renderDeltaBadge(delta: number) {
    if (delta === 0 || isNaN(delta)) return null;
    return (
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
          backgroundColor:
            delta >= 0 ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)",
          color: delta >= 0 ? "#10B981" : "#F43F5E",
        }}
      >
        {delta >= 0 ? "↑" : "↓"} {delta >= 0 ? "+" : ""}
        {fmtNum(delta)}
      </span>
    );
  }

  function getBenchmarkColor(value: number, min: number, max: number): string {
    if (value >= max) return "#10B981";
    if (value >= min) return "#F59E0B";
    return "#F43F5E";
  }

  function getBenchmarkLabel(value: number, min: number, max: number): string {
    if (value >= max) return "Acima da média";
    if (value >= min) return "Na média";
    return "Abaixo da média";
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
                    {heroData.followersDelta !== 0 && renderDeltaBadge(heroData.followersDelta)}
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
                    {heroData.reachDelta !== undefined && heroData.reachDelta !== 0 && renderDeltaBadge(heroData.reachDelta)}
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
                    {heroData.impressionsDelta !== undefined && heroData.impressionsDelta !== 0 && renderDeltaBadge(heroData.impressionsDelta)}
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
          <SectionTitle>Evolução no Período</SectionTitle>

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

        {/* ───── 4. Performance by Type (IMPROVED: grouped bars) ───── */}
        <div style={{ padding: "24px 0" }}>
          <SectionTitle>Engajamento por Tipo</SectionTitle>

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
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={perfByType} barCategoryGap="20%">
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
                <Legend
                  wrapperStyle={{ fontSize: "0.7rem", color: "#A1A1B5" }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="Avg Likes" fill="#6C63FF" radius={[3, 3, 0, 0]} name="Avg Likes" />
                <Bar dataKey="Avg Coment." fill="#00D4C8" radius={[3, 3, 0, 0]} name="Avg Coment." />
                <Bar dataKey="Avg Saves" fill="#F59E0B" radius={[3, 3, 0, 0]} name="Avg Saves" />
                <Bar dataKey="Avg Shares" fill="#A1A1B5" radius={[3, 3, 0, 0]} name="Avg Shares" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>


        {/* ───── 6. Melhores Horários para Postar (Heatmap) ───── */}
        <div style={{ padding: "24px 0" }}>
          <SectionTitle>Melhores Horários para Postar</SectionTitle>

          {isLoading ? (
            <Skeleton
              className="w-full rounded-lg"
              style={{ height: 280, backgroundColor: "rgba(255,255,255,0.04)" }}
            />
          ) : !heatmapData || heatmapData.cells.every((c) => c.count === 0) ? (
            <p
              style={{ color: "#52526A", fontSize: "0.85rem", textAlign: "center", padding: "64px 0" }}
            >
              Sem dados de horários de publicação.
            </p>
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: "0px" }}>
                {/* Day labels column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginRight: "8px", paddingTop: "22px" }}>
                  {DAY_LABELS_HEATMAP.map((day) => (
                    <div
                      key={day}
                      style={{
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        fontSize: "0.65rem",
                        color: "#52526A",
                        fontWeight: 500,
                        minWidth: "28px",
                      }}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div>
                  {/* Hour labels row */}
                  <div style={{ display: "flex", gap: "2px", marginBottom: "2px" }}>
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div
                        key={h}
                        style={{
                          width: "28px",
                          textAlign: "center",
                          fontSize: "0.55rem",
                          color: "#52526A",
                          fontFamily: "monospace",
                        }}
                      >
                        {h}h
                      </div>
                    ))}
                  </div>

                  {/* Heatmap cells */}
                  {Array.from({ length: 7 }).map((_, rowIdx) => (
                    <div key={rowIdx} style={{ display: "flex", gap: "2px", marginBottom: "2px" }}>
                      {Array.from({ length: 24 }).map((_, h) => {
                        const cell = heatmapData.cells.find(
                          (c) => c.dayIdx === rowIdx && c.hour === h,
                        );
                        const avg = cell?.avgEng ?? 0;
                        const count = cell?.count ?? 0;
                        const intensity =
                          heatmapData.maxAvg > 0 ? avg / heatmapData.maxAvg : 0;
                        const opacity = count === 0 ? 0 : Math.max(0.15, intensity * 0.8);

                        return (
                          <div
                            key={h}
                            style={{
                              width: "28px",
                              height: "32px",
                              borderRadius: "4px",
                              backgroundColor:
                                count === 0
                                  ? "rgba(255,255,255,0.02)"
                                  : `rgba(108,99,255,${opacity})`,
                              cursor: count > 0 ? "pointer" : "default",
                              border: "1px solid rgba(255,255,255,0.02)",
                            }}
                            onMouseEnter={(e) => {
                              if (count > 0) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHeatmapTooltip({
                                  visible: true,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top - 8,
                                  day: DAY_LABELS_HEATMAP[rowIdx],
                                  hour: h,
                                  avgEng: avg,
                                  count,
                                });
                              }
                            }}
                            onMouseLeave={() => setHeatmapTooltip(null)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Heatmap tooltip */}
              {heatmapTooltip && heatmapTooltip.visible && (
                <div
                  style={{
                    position: "fixed",
                    left: heatmapTooltip.x,
                    top: heatmapTooltip.y,
                    transform: "translate(-50%, -100%)",
                    backgroundColor: "#1C1C2E",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "0.7rem",
                    zIndex: 50,
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <p style={{ color: "#A1A1B5", marginBottom: 4, fontWeight: 500 }}>
                    {heatmapTooltip.day}, {heatmapTooltip.hour}h
                  </p>
                  <p style={{ color: "#FFFFFF", fontFamily: "monospace", fontWeight: 600 }}>
                    Eng. médio: {fmtNum(Math.round(heatmapTooltip.avgEng))}
                  </p>
                  <p style={{ color: "#52526A", fontSize: "0.6rem" }}>
                    {heatmapTooltip.count} post{heatmapTooltip.count !== 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {/* Legend */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <span style={{ fontSize: "0.6rem", color: "#52526A" }}>Menos</span>
                {[0.15, 0.3, 0.5, 0.65, 0.8].map((op) => (
                  <div
                    key={op}
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "3px",
                      backgroundColor: `rgba(108,99,255,${op})`,
                    }}
                  />
                ))}
                <span style={{ fontSize: "0.6rem", color: "#52526A" }}>Mais</span>
              </div>
            </div>
          )}
        </div>

        {/* ───── 7. Frequência de Publicação ───── */}
        <div style={{ padding: "24px 0" }}>
          <SectionTitle>Frequência de Publicação</SectionTitle>

          {isLoading ? (
            <Skeleton
              className="w-full rounded-lg"
              style={{ height: 300, backgroundColor: "rgba(255,255,255,0.04)" }}
            />
          ) : frequencyData.length === 0 ? (
            <p
              style={{ color: "#52526A", fontSize: "0.85rem", textAlign: "center", padding: "64px 0" }}
            >
              Sem dados de frequência no período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={frequencyData}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "#52526A" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#52526A", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Posts",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: "#52526A" },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#52526A", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtNum}
                  label={{
                    value: "Eng. médio",
                    angle: 90,
                    position: "insideRight",
                    style: { fontSize: 10, fill: "#52526A" },
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }: any) => {
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
                              {entry.name === "posts" ? "Posts" : "Eng. médio"}:
                            </span>
                            <span style={{ color: "#FFFFFF", fontWeight: 600, fontFamily: "monospace" }}>
                              {fmtNum(entry.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="posts"
                  fill="#6C63FF"
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                  name="posts"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgEngagement"
                  stroke="#00D4C8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#00D4C8", stroke: "#0A0A0F", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: "#00D4C8", stroke: "#0A0A0F", strokeWidth: 2 }}
                  name="avgEngagement"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ───── 8. Taxa de Engajamento ao Longo do Tempo ───── */}
        <div style={{ padding: "24px 0" }}>
          <SectionTitle>Taxa de Engajamento ao Longo do Tempo</SectionTitle>

          {isLoading ? (
            <Skeleton
              className="w-full rounded-lg"
              style={{ height: 300, backgroundColor: "rgba(255,255,255,0.04)" }}
            />
          ) : engagementOverTime.length === 0 ? (
            <p
              style={{ color: "#52526A", fontSize: "0.85rem", textAlign: "center", padding: "64px 0" }}
            >
              Sem dados de engajamento no período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={engagementOverTime}>
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
                  tick={{ fontSize: 11, fill: "#52526A", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0]?.payload;
                    return (
                      <div
                        style={{
                          backgroundColor: "#1C1C2E",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          fontSize: "0.75rem",
                          maxWidth: "220px",
                        }}
                      >
                        <p style={{ color: "#A1A1B5", marginBottom: 4, fontWeight: 500 }}>
                          {item?.caption || label}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#6C63FF", display: "inline-block" }} />
                          <span style={{ color: "#A1A1B5" }}>Taxa:</span>
                          <span style={{ color: "#FFFFFF", fontWeight: 600, fontFamily: "monospace" }}>
                            {payload[0]?.value?.toFixed(2)}%
                          </span>
                        </div>
                        {payload[1] && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#00D4C8", display: "inline-block" }} />
                            <span style={{ color: "#A1A1B5" }}>MA(7):</span>
                            <span style={{ color: "#FFFFFF", fontWeight: 600, fontFamily: "monospace" }}>
                              {payload[1]?.value?.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="engagementRate"
                  stroke="#6C63FF"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#6C63FF", stroke: "#0A0A0F", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: "#6C63FF", stroke: "#0A0A0F", strokeWidth: 2 }}
                  name="engagementRate"
                />
                <Line
                  type="monotone"
                  dataKey="movingAvg"
                  stroke="#00D4C8"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name="movingAvg"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ───── 9. Crescimento de Seguidores ───── */}
        <div style={{ padding: "24px 0" }}>
          <SectionTitle>Crescimento de Seguidores</SectionTitle>

          {isLoading ? (
            <Skeleton
              className="w-full rounded-lg"
              style={{ height: 260, backgroundColor: "rgba(255,255,255,0.04)" }}
            />
          ) : followerGrowth.length === 0 ? (
            <p
              style={{ color: "#52526A", fontSize: "0.85rem", textAlign: "center", padding: "64px 0" }}
            >
              Sem dados de crescimento no período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={followerGrowth}>
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
                  tick={{ fontSize: 11, fill: "#52526A", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const val = payload[0].value;
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
                        <p
                          style={{
                            color: val >= 0 ? "#10B981" : "#F43F5E",
                            fontWeight: 600,
                            fontFamily: "monospace",
                          }}
                        >
                          {val >= 0 ? "+" : ""}{val}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="delta" radius={[3, 3, 0, 0]}>
                  {followerGrowth.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ───── 10. Benchmarks do Setor ───── */}
        <div style={{ padding: "24px 0" }}>
          <SectionTitle>Benchmarks do Setor</SectionTitle>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: "16px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="rounded-lg"
                  style={{ height: 140, backgroundColor: "rgba(255,255,255,0.04)" }}
                />
              ))}
            </div>
          ) : !benchmarks ? (
            <p
              style={{ color: "#52526A", fontSize: "0.85rem", textAlign: "center", padding: "64px 0" }}
            >
              Sem dados suficientes para benchmarks.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: "16px" }}>
              {/* Engagement Rate Benchmark */}
              <div
                style={{
                  backgroundColor: "#111118",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  padding: "20px",
                }}
              >
                <p
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#52526A",
                    fontWeight: 500,
                    marginBottom: "12px",
                  }}
                >
                  TAXA DE ENGAJAMENTO
                </p>
                <p
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    fontFamily: "monospace",
                    lineHeight: 1.1,
                    marginBottom: "8px",
                  }}
                >
                  {benchmarks.engRate}%
                </p>
                <div
                  style={{
                    width: "100%",
                    height: "4px",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderRadius: "2px",
                    marginBottom: "8px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (benchmarks.engRate / benchmarks.engBenchMax) * 100)}%`,
                      height: "100%",
                      backgroundColor: getBenchmarkColor(benchmarks.engRate, benchmarks.engBenchMin, benchmarks.engBenchMax),
                      borderRadius: "2px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.6rem", color: "#52526A" }}>
                    Benchmark: {benchmarks.engBenchMin}% - {benchmarks.engBenchMax}%
                  </span>
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: "3px",
                      backgroundColor: `${getBenchmarkColor(benchmarks.engRate, benchmarks.engBenchMin, benchmarks.engBenchMax)}20`,
                      color: getBenchmarkColor(benchmarks.engRate, benchmarks.engBenchMin, benchmarks.engBenchMax),
                    }}
                  >
                    {getBenchmarkLabel(benchmarks.engRate, benchmarks.engBenchMin, benchmarks.engBenchMax)}
                  </span>
                </div>
              </div>

              {/* Reach Rate Benchmark */}
              <div
                style={{
                  backgroundColor: "#111118",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  padding: "20px",
                }}
              >
                <p
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#52526A",
                    fontWeight: 500,
                    marginBottom: "12px",
                  }}
                >
                  TAXA DE ALCANCE
                </p>
                <p
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    fontFamily: "monospace",
                    lineHeight: 1.1,
                    marginBottom: "8px",
                  }}
                >
                  {benchmarks.reachRate}%
                </p>
                <div
                  style={{
                    width: "100%",
                    height: "4px",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderRadius: "2px",
                    marginBottom: "8px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (benchmarks.reachRate / benchmarks.reachBenchMax) * 100)}%`,
                      height: "100%",
                      backgroundColor: getBenchmarkColor(benchmarks.reachRate, benchmarks.reachBenchMin, benchmarks.reachBenchMax),
                      borderRadius: "2px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.6rem", color: "#52526A" }}>
                    Benchmark: {benchmarks.reachBenchMin}% - {benchmarks.reachBenchMax}%
                  </span>
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: "3px",
                      backgroundColor: `${getBenchmarkColor(benchmarks.reachRate, benchmarks.reachBenchMin, benchmarks.reachBenchMax)}20`,
                      color: getBenchmarkColor(benchmarks.reachRate, benchmarks.reachBenchMin, benchmarks.reachBenchMax),
                    }}
                  >
                    {getBenchmarkLabel(benchmarks.reachRate, benchmarks.reachBenchMin, benchmarks.reachBenchMax)}
                  </span>
                </div>
              </div>

              {/* Comments/Likes Ratio Benchmark */}
              <div
                style={{
                  backgroundColor: "#111118",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  padding: "20px",
                }}
              >
                <p
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#52526A",
                    fontWeight: 500,
                    marginBottom: "12px",
                  }}
                >
                  COMENTÁRIOS / LIKES
                </p>
                <p
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    fontFamily: "monospace",
                    lineHeight: 1.1,
                    marginBottom: "8px",
                  }}
                >
                  {benchmarks.commentsLikesRatio}%
                </p>
                <div
                  style={{
                    width: "100%",
                    height: "4px",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderRadius: "2px",
                    marginBottom: "8px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (benchmarks.commentsLikesRatio / benchmarks.clBenchMax) * 100)}%`,
                      height: "100%",
                      backgroundColor: getBenchmarkColor(benchmarks.commentsLikesRatio, benchmarks.clBenchMin, benchmarks.clBenchMax),
                      borderRadius: "2px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.6rem", color: "#52526A" }}>
                    Benchmark: {benchmarks.clBenchMin}% - {benchmarks.clBenchMax}%
                  </span>
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: "3px",
                      backgroundColor: `${getBenchmarkColor(benchmarks.commentsLikesRatio, benchmarks.clBenchMin, benchmarks.clBenchMax)}20`,
                      color: getBenchmarkColor(benchmarks.commentsLikesRatio, benchmarks.clBenchMin, benchmarks.clBenchMax),
                    }}
                  >
                    {getBenchmarkLabel(benchmarks.commentsLikesRatio, benchmarks.clBenchMin, benchmarks.clBenchMax)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
        {/* ───── 5. Top Posts Table (IMPROVED: engagement rate col + media filter) ───── */}
        <div style={{ padding: "24px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "20px",
              flexWrap: "wrap",
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

            {/* Media type filter buttons */}
            <div
              style={{
                marginLeft: "16px",
                backgroundColor: "rgba(255,255,255,0.04)",
                borderRadius: "6px",
                padding: "2px",
                display: "inline-flex",
                gap: "2px",
              }}
            >
              {(
                [
                  ["ALL", "Todos"],
                  ["CAROUSEL_ALBUM", "Carrossel"],
                  ["VIDEO", "Vídeo"],
                ] as [MediaFilter, string][]
              ).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setMediaFilter(val)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "4px",
                    fontSize: "0.65rem",
                    fontWeight: 500,
                    letterSpacing: "0.03em",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor:
                      mediaFilter === val ? "rgba(108,99,255,0.15)" : "transparent",
                    color: mediaFilter === val ? "#6C63FF" : "#52526A",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
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
                        ["engagementRate", "Eng.%"],
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
                      {/* Engagement Rate column */}
                      <td
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                          color: post.engagementRate > 3 ? "#10B981" : post.engagementRate > 1.5 ? "#F59E0B" : "#F43F5E",
                          fontFeatureSettings: '"tnum"',
                          fontWeight: 600,
                        }}
                      >
                        {post.engagementRate > 0 ? `${post.engagementRate.toFixed(1)}%` : <span style={{ color: "#52526A" }}>—</span>}
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
  );
}
