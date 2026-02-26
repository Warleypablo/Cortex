import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/components/ThemeProvider";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Users,
  MousePointerClick,
  ShoppingCart,
  Megaphone,
  BarChart3,
  Activity,
  Clock,
  Loader2,
  CalendarDays,
  CheckCircle2,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

interface ArMetrica {
  id: number;
  clienteNome: string;
  categoria: string;
  freq: string;
  periodoInicio: string;
  periodoFim: string;
  faturamento: string | null;
  faturamentoMes: string | null;
  investimento: string | null;
  investimentoMes: string | null;
  roas: string | null;
  vendas: number | null;
  cpa: string | null;
  taxaConv: string | null;
  ticketMedio: string | null;
  custoPorSessao: string | null;
  metaFaturamento: string | null;
  metaInvestimento: string | null;
  pctMetaFat: string | null;
  pctMetaInv: string | null;
  leads: number | null;
  leadsMes: number | null;
  cpl: string | null;
  custoPorSessaoLead: string | null;
  leadsPorSessao: string | null;
  metaLeads: number | null;
  pctMetaLeads: string | null;
  invGoogle: string | null;
  fatGoogle: string | null;
  vendasGoogle: number | null;
  roasGoogle: string | null;
  cpaGoogle: string | null;
  impGoogle: number | null;
  leadsGoogle: number | null;
  cplGoogle: string | null;
  lpiGoogle: string | null;
  invMeta: string | null;
  fatMeta: string | null;
  vendasMeta: number | null;
  roasMeta: string | null;
  cpaMeta: string | null;
  impMeta: number | null;
  leadsMeta: number | null;
  cplMeta: string | null;
  lpiMeta: string | null;
  sessoes: number | null;
  sessoesEngajadas: number | null;
  taxaEngajamento: string | null;
  tempoMedioEngajamento: string | null;
  usuarios: number | null;
  novosUsuarios: number | null;
  variacoes: Record<string, string> | null;
  [key: string]: unknown;
}

interface ArCampanha {
  id: number;
  nomeCampanha: string | null;
  plataforma: string;
  rank: number;
  conversoes: string | null;
  faturamento: string | null;
  investimento: string | null;
  cpa: string | null;
  roas: string | null;
  impressoes: number | null;
  leads: number | null;
  cpl: string | null;
  lpi: string | null;
}

interface ArCanal {
  id: number;
  nomeCanal: string | null;
  rank: number;
  sessoes: number | null;
  sessoesEngajadas: number | null;
  taxaEngajamento: string | null;
  tempoMedio: string | null;
  receita: string | null;
  usuarios: number | null;
  novosUsuarios: number | null;
}

interface PeriodoOption {
  periodoInicio: string;
  periodoFim: string;
}

interface PerformanceData {
  cliente: string | null;
  categoria: string | null;
  metricas: ArMetrica | null;
  campanhas_meta: ArCampanha[];
  campanhas_google: ArCampanha[];
  canais: ArCanal[];
  historico: ArMetrica[];
  periodos: PeriodoOption[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function n(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "string" ? parseFloat(v) || 0 : v;
}

function fmtBRL(v: string | number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n(v));
}

function fmtNum(v: string | number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR").format(n(v));
}

function fmtPct(v: string | number | null | undefined): string {
  const val = n(v);
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function fmtRoas(v: string | number | null | undefined): string {
  return n(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "x";
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

function fmtDateShort(d: string | null | undefined): string {
  if (!d) return "";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : d;
}

function fmtSeconds(v: string | number | null | undefined): string {
  const s = n(v);
  const min = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return min > 0 ? `${min}m${sec.toString().padStart(2, "0")}s` : `${sec}s`;
}

function parseVar(variacoes: Record<string, string> | null | undefined, key: string): { up: boolean; text: string } | null {
  if (!variacoes || !variacoes[key]) return null;
  const raw = variacoes[key];
  const up = raw.startsWith("^") || raw.includes("+");
  const text = raw.replace(/^[v^]\s*/, "").trim();
  return { up, text };
}

// Color maps for KPI gradients
const COLOR_MAP: Record<string, { gradient: string; gradientDark: string; iconBg: string; iconBgDark: string; iconColor: string; iconColorDark: string }> = {
  emerald: {
    gradient: "from-emerald-50 to-white", gradientDark: "from-emerald-500/10 to-zinc-900",
    iconBg: "bg-emerald-100", iconBgDark: "bg-emerald-500/20",
    iconColor: "text-emerald-600", iconColorDark: "text-emerald-400",
  },
  blue: {
    gradient: "from-blue-50 to-white", gradientDark: "from-blue-500/10 to-zinc-900",
    iconBg: "bg-blue-100", iconBgDark: "bg-blue-500/20",
    iconColor: "text-blue-600", iconColorDark: "text-blue-400",
  },
  amber: {
    gradient: "from-amber-50 to-white", gradientDark: "from-amber-500/10 to-zinc-900",
    iconBg: "bg-amber-100", iconBgDark: "bg-amber-500/20",
    iconColor: "text-amber-600", iconColorDark: "text-amber-400",
  },
  purple: {
    gradient: "from-purple-50 to-white", gradientDark: "from-purple-500/10 to-zinc-900",
    iconBg: "bg-purple-100", iconBgDark: "bg-purple-500/20",
    iconColor: "text-purple-600", iconColorDark: "text-purple-400",
  },
  rose: {
    gradient: "from-rose-50 to-white", gradientDark: "from-rose-500/10 to-zinc-900",
    iconBg: "bg-rose-100", iconBgDark: "bg-rose-500/20",
    iconColor: "text-rose-600", iconColorDark: "text-rose-400",
  },
  cyan: {
    gradient: "from-cyan-50 to-white", gradientDark: "from-cyan-500/10 to-zinc-900",
    iconBg: "bg-cyan-100", iconBgDark: "bg-cyan-500/20",
    iconColor: "text-cyan-600", iconColorDark: "text-cyan-400",
  },
  indigo: {
    gradient: "from-indigo-50 to-white", gradientDark: "from-indigo-500/10 to-zinc-900",
    iconBg: "bg-indigo-100", iconBgDark: "bg-indigo-500/20",
    iconColor: "text-indigo-600", iconColorDark: "text-indigo-400",
  },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function PortalPerformance() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const chartColors = {
    grid: isDark ? "#27272a" : "#e5e7eb",
    axisLine: isDark ? "#3f3f46" : "#d1d5db",
    axisTick: isDark ? "#71717a" : "#6b7280",
    tooltipBg: isDark ? "#18181b" : "#ffffff",
    tooltipBorder: isDark ? "#3f3f46" : "#e5e7eb",
  };

  const META_COLOR = "#3b82f6";
  const GOOGLE_COLOR = "#22c55e";
  const ROAS_COLOR = "#f59e0b";
  const DONUT_COLORS = [META_COLOR, GOOGLE_COLOR];

  const [freq, setFreq] = useState<"SEMANAL" | "MENSAL">("SEMANAL");
  const [periodo, setPeriodo] = useState<string>("");

  const queryUrl = `/api/portal-cliente/performance?freq=${freq}${periodo ? `&periodo=${periodo}` : ""}`;

  const { data, isLoading } = useQuery<PerformanceData>({
    queryKey: [queryUrl],
    queryFn: () => fetch(queryUrl, { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const isEcommerce = data?.categoria === "E-commerce";
  const isLeadComSite = data?.categoria === "Lead Com Site";
  const isLeadSemSite = data?.categoria === "Lead Sem Site";
  const isLead = isLeadComSite || isLeadSemSite;
  const hasGA4 = isEcommerce || isLeadComSite;
  const m = data?.metricas;
  const v = m?.variacoes;

  const handleFreqChange = (newFreq: "SEMANAL" | "MENSAL") => {
    setFreq(newFreq);
    setPeriodo("");
  };

  // ── KPI definitions per category ────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!m) return [];
    if (isEcommerce) return [
      { label: "Faturamento", value: fmtBRL(m.faturamento), varKey: "var_fat_sem", icon: DollarSign, color: "emerald", hero: true },
      { label: "Investimento", value: fmtBRL(m.investimento), varKey: "var_inv_sem", icon: Megaphone, color: "blue" },
      { label: "ROAS", value: fmtRoas(m.roas), varKey: "var_roas_sem", icon: TrendingUp, color: "amber" },
      { label: "Vendas", value: fmtNum(m.vendas), varKey: "var_vendas_sem", icon: ShoppingCart, color: "purple" },
      { label: "CPA", value: fmtBRL(m.cpa), varKey: "var_cpa_sem", icon: Target, color: "rose", invertColor: true },
      { label: "Ticket Médio", value: fmtBRL(m.ticketMedio), varKey: "var_ticket_sem", icon: DollarSign, color: "cyan" },
      { label: "Taxa Conversão", value: fmtPct(m.taxaConv), varKey: "var_taxa_conv_sem", icon: MousePointerClick, color: "indigo" },
    ];
    return [
      { label: "Leads", value: fmtNum(m.leads), varKey: "var_leads_sem", icon: Users, color: "emerald", hero: true },
      { label: "Investimento", value: fmtBRL(m.investimento), varKey: "var_inv_sem", icon: Megaphone, color: "blue" },
      { label: "CPL", value: fmtBRL(m.cpl), varKey: "var_cpl_sem", icon: Target, color: "amber", invertColor: true },
      { label: "Leads/Sessão", value: fmtPct(n(m.leadsPorSessao) * 100), varKey: "var_lps_sem", icon: MousePointerClick, color: "purple" },
      { label: "Sessões", value: fmtNum(m.sessoes), varKey: "var_sessoes_sem", icon: Activity, color: "cyan" },
    ];
  }, [m, isEcommerce]);

  // ── Evolução chart data ────────────────────────────────────────────────────
  const historicoData = useMemo(() => {
    if (!data?.historico) return [];
    return data.historico.map((h) => ({
      periodo: fmtDateShort(h.periodoInicio),
      investimento: n(h.investimento),
      roas: n(h.roas),
      faturamento: n(h.faturamento),
      vendas: h.vendas ?? 0,
      leads: h.leads ?? 0,
    }));
  }, [data?.historico]);

  // Donut data for investment split
  const donutData = useMemo(() => {
    if (!m) return [];
    const meta = n(m.invMeta);
    const google = n(m.invGoogle);
    if (meta === 0 && google === 0) return [];
    return [
      { name: "Meta Ads", value: meta },
      { name: "Google Ads", value: google },
    ];
  }, [m]);

  const [campTab, setCampTab] = useState<"meta" | "google">("meta");

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className={`h-9 w-48 rounded-lg animate-pulse ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
          <div className={`h-9 w-48 rounded-lg animate-pulse ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
        </div>
        <div className={`h-32 rounded-2xl animate-pulse ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-28 rounded-2xl animate-pulse ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
          ))}
        </div>
        <div className={`h-64 rounded-2xl animate-pulse ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
      </div>
    );
  }

  if (!data?.metricas) {
    return (
      <div className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
        <div className="flex flex-col items-center justify-center py-24 gap-5 px-6 text-center">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${isDark ? "bg-zinc-800 border-white/[0.07]" : "bg-slate-100 border-slate-200"}`}>
            <BarChart3 className={`w-6 h-6 ${isDark ? "text-white/15" : "text-slate-300"}`} />
          </div>
          <div className="space-y-1.5">
            <p className={`font-semibold ${isDark ? "text-white/50" : "text-slate-600"}`}>Performance</p>
            <p className={`text-sm max-w-xs leading-relaxed ${isDark ? "text-white/20" : "text-slate-400"}`}>
              Ainda não há dados de performance disponíveis para a sua conta. Os relatórios serão exibidos aqui assim que forem gerados.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const heroKpi = kpis.find((k) => (k as any).hero);
  const otherKpis = kpis.filter((k) => !(k as any).hero);

  return (
    <div className="space-y-5">

      {/* ── Filtros: Frequência + Período ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex gap-0.5 p-0.5 border rounded-lg transition-colors duration-300 ${isDark ? "bg-zinc-900/60 border-white/[0.07]" : "bg-slate-100 border-slate-200"}`}>
          {(["SEMANAL", "MENSAL"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFreqChange(f)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                freq === f
                  ? isDark ? "bg-white/[0.09] text-white shadow-sm" : "bg-white text-slate-900 shadow-sm"
                  : isDark ? "text-white/30 hover:text-white/55" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {f === "SEMANAL" ? "Semanal" : "Mensal"}
            </button>
          ))}
        </div>

        {data.periodos && data.periodos.length > 0 && (
          <div className="relative">
            <CalendarDays className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${isDark ? "text-white/30" : "text-slate-400"}`} />
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className={`pl-8 pr-3 py-1.5 rounded-lg text-xs font-medium border appearance-none cursor-pointer transition-colors ${
                isDark
                  ? "bg-zinc-900/60 border-white/[0.07] text-white/70 focus:border-white/20"
                  : "bg-white border-slate-200 text-slate-600 focus:border-slate-300"
              }`}
            >
              <option value="">Mais recente</option>
              {data.periodos.map((p) => (
                <option key={p.periodoInicio} value={p.periodoInicio}>
                  {fmtDate(p.periodoInicio)} — {fmtDate(p.periodoFim)}
                </option>
              ))}
            </select>
          </div>
        )}

        {m && (
          <span className={`text-xs ${isDark ? "text-white/25" : "text-slate-400"}`}>
            {fmtDate(m.periodoInicio)} a {fmtDate(m.periodoFim)}
          </span>
        )}
      </div>

      {/* ── 1. Hero KPI Card ──────────────────────────────────────────────── */}
      {heroKpi && (() => {
        const variation = parseVar(v, heroKpi.varKey);
        const isPositive = variation ? (heroKpi.invertColor ? !variation.up : variation.up) : null;
        const colors = COLOR_MAP[heroKpi.color] || COLOR_MAP.emerald;
        return (
          <div
            className={`relative overflow-hidden border rounded-2xl p-6 bg-gradient-to-br transition-colors duration-300 ${
              isDark
                ? `${colors.gradientDark} border-white/[0.07]`
                : `${colors.gradient} border-slate-200 shadow-sm`
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? colors.iconBgDark : colors.iconBg}`}>
                    <heroKpi.icon className={`w-5 h-5 ${isDark ? colors.iconColorDark : colors.iconColor}`} />
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-slate-500"}`}>
                    {heroKpi.label}
                  </span>
                </div>
                <p className={`text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {heroKpi.value}
                </p>
                {variation && (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    isPositive
                      ? isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                      : isDark ? "bg-red-500/15 text-red-400" : "bg-red-100 text-red-700"
                  }`}>
                    {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {variation.text} vs anterior
                  </div>
                )}
              </div>
              <div className={`hidden sm:flex w-20 h-20 rounded-2xl items-center justify-center ${isDark ? colors.iconBgDark : colors.iconBg} opacity-50`}>
                <heroKpi.icon className={`w-10 h-10 ${isDark ? colors.iconColorDark : colors.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 2. KPI Cards with Gradients ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {otherKpis.map((kpi) => {
          const variation = parseVar(v, kpi.varKey);
          const isPositive = variation ? (kpi.invertColor ? !variation.up : variation.up) : null;
          const colors = COLOR_MAP[kpi.color] || COLOR_MAP.emerald;
          return (
            <div
              key={kpi.label}
              className={`relative overflow-hidden border rounded-2xl p-4 bg-gradient-to-br transition-colors duration-300 ${
                isDark
                  ? `${colors.gradientDark} border-white/[0.07]`
                  : `${colors.gradient} border-slate-200 shadow-sm`
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className={`text-[11px] font-medium uppercase tracking-wide ${isDark ? "text-white/35" : "text-slate-500"}`}>
                  {kpi.label}
                </span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? colors.iconBgDark : colors.iconBg}`}>
                  <kpi.icon className={`w-3.5 h-3.5 ${isDark ? colors.iconColorDark : colors.iconColor}`} />
                </div>
              </div>
              <p className={`text-xl font-bold tracking-tight ${isDark ? "text-white/90" : "text-slate-800"}`}>
                {kpi.value}
              </p>
              {variation && (
                <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  isPositive
                    ? isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                    : isDark ? "bg-red-500/15 text-red-400" : "bg-red-100 text-red-700"
                }`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {variation.text}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 3. Atingimento de Metas ──────────────────────────────────────── */}
      {m && (
        <div className={`border rounded-2xl p-5 transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
          <div className="flex items-center gap-2 mb-5">
            <Target className={`w-4 h-4 ${isDark ? "text-white/40" : "text-slate-500"}`} />
            <p className={`text-sm font-semibold ${isDark ? "text-white/70" : "text-slate-700"}`}>
              Atingimento de Metas
            </p>
          </div>
          <div className="space-y-5">
            {isEcommerce ? (
              <>
                <MetaBar label="Faturamento" pct={n(m.pctMetaFat)} atual={fmtBRL(m.faturamento)} meta={fmtBRL(m.metaFaturamento)} isDark={isDark} />
                <MetaBar label="Investimento" pct={n(m.pctMetaInv)} atual={fmtBRL(m.investimento)} meta={fmtBRL(m.metaInvestimento)} isDark={isDark} />
              </>
            ) : (
              <>
                <MetaBar label="Leads" pct={n(m.pctMetaLeads)} atual={fmtNum(m.leads)} meta={fmtNum(m.metaLeads)} isDark={isDark} />
                {n(m.metaInvestimento) > 0 && (
                  <MetaBar label="Investimento" pct={n(m.pctMetaInv)} atual={fmtBRL(m.investimento)} meta={fmtBRL(m.metaInvestimento)} isDark={isDark} />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 4. Comparativo Meta vs Google ────────────────────────────────── */}
      {m && (n(m.invMeta) > 0 || n(m.invGoogle) > 0) && (
        <div className={`border rounded-2xl p-5 transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
          <p className={`text-sm font-semibold mb-4 ${isDark ? "text-white/70" : "text-slate-700"}`}>
            Comparativo: Meta Ads vs Google Ads
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <PlatformCard
                label="Meta Ads"
                color={META_COLOR}
                investimento={fmtBRL(m.invMeta)}
                resultado={isEcommerce ? fmtBRL(m.fatMeta) : fmtNum(m.leadsMeta)}
                resultadoLabel={isEcommerce ? "Faturamento" : "Leads"}
                eficiencia={isEcommerce ? fmtRoas(m.roasMeta) : fmtBRL(m.cplMeta)}
                eficienciaLabel={isEcommerce ? "ROAS" : "CPL"}
                isDark={isDark}
              />
              <PlatformCard
                label="Google Ads"
                color={GOOGLE_COLOR}
                investimento={fmtBRL(m.invGoogle)}
                resultado={isEcommerce ? fmtBRL(m.fatGoogle) : fmtNum(m.leadsGoogle)}
                resultadoLabel={isEcommerce ? "Faturamento" : "Leads"}
                eficiencia={isEcommerce ? fmtRoas(m.roasGoogle) : fmtBRL(m.cplGoogle)}
                eficienciaLabel={isEcommerce ? "ROAS" : "CPL"}
                isDark={isDark}
              />
            </div>
            {donutData.length > 0 && (
              <div className="flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={78}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => fmtBRL(value)}
                      contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                    />
                    {/* Center label */}
                    <text
                      x="50%"
                      y="48%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`text-[10px] font-medium ${isDark ? "fill-white/30" : "fill-slate-400"}`}
                    >
                      Investimento
                    </text>
                    <text
                      x="50%"
                      y="56%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`text-xs font-bold ${isDark ? "fill-white/70" : "fill-slate-700"}`}
                    >
                      {fmtBRL(n(m.invMeta) + n(m.invGoogle))}
                    </text>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: META_COLOR }} /> Meta</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: GOOGLE_COLOR }} /> Google</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 5. Top 5 Campanhas ───────────────────────────────────────────── */}
      {(data.campanhas_meta.length > 0 || data.campanhas_google.length > 0) && (
        <div className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
          <div className={`flex items-center gap-1 px-4 pt-4 pb-2`}>
            <p className={`text-sm font-semibold mr-3 ${isDark ? "text-white/70" : "text-slate-700"}`}>Top 5 Campanhas</p>
            <div className={`flex gap-0.5 p-0.5 border rounded-lg ${isDark ? "bg-zinc-800/60 border-white/[0.07]" : "bg-slate-100 border-slate-200"}`}>
              {(["meta", "google"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCampTab(t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    campTab === t
                      ? isDark ? "bg-white/[0.09] text-white" : "bg-white text-slate-900 shadow-sm"
                      : isDark ? "text-white/30 hover:text-white/55" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {t === "meta" ? "Meta Ads" : "Google Ads"}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-b ${isDark ? "border-white/[0.07]" : "border-slate-100"}`}>
                  <th className={`text-left py-2.5 pr-3 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>#</th>
                  <th className={`text-left py-2.5 pr-3 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Campanha</th>
                  {isEcommerce ? (
                    <>
                      <th className={`text-right py-2.5 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Conv.</th>
                      <th className={`text-right py-2.5 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Faturamento</th>
                      <th className={`text-right py-2.5 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Investimento</th>
                      <th className={`text-right py-2.5 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>CPA</th>
                      <th className={`text-right py-2.5 pl-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>ROAS</th>
                    </>
                  ) : (
                    <>
                      <th className={`text-right py-2.5 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Leads</th>
                      <th className={`text-right py-2.5 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>CPL</th>
                      <th className={`text-right py-2.5 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Investimento</th>
                      <th className={`text-right py-2.5 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>LPI</th>
                      <th className={`text-right py-2.5 pl-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Impressões</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(campTab === "meta" ? data.campanhas_meta : data.campanhas_google).map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-b last:border-0 transition-colors ${
                      isDark
                        ? `border-white/[0.04] ${i % 2 === 1 ? "bg-white/[0.02]" : ""} hover:bg-white/[0.04]`
                        : `border-slate-50 ${i % 2 === 1 ? "bg-slate-50/50" : ""} hover:bg-slate-50`
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold ${
                        i === 0
                          ? isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"
                          : i === 1
                            ? isDark ? "bg-slate-500/20 text-slate-400" : "bg-slate-200 text-slate-600"
                            : i === 2
                              ? isDark ? "bg-orange-500/15 text-orange-400" : "bg-orange-100 text-orange-600"
                              : isDark ? "bg-zinc-800 text-white/30" : "bg-slate-100 text-slate-400"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className={`py-3 pr-3 max-w-[200px] truncate font-medium ${isDark ? "text-white/70" : "text-slate-700"}`}>{c.nomeCampanha ?? "—"}</td>
                    {isEcommerce ? (
                      <>
                        <td className={`py-3 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtNum(c.conversoes)}</td>
                        <td className={`py-3 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtBRL(c.faturamento)}</td>
                        <td className={`py-3 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtBRL(c.investimento)}</td>
                        <td className={`py-3 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtBRL(c.cpa)}</td>
                        <td className={`py-3 pl-2 text-right font-semibold ${isDark ? "text-white/70" : "text-slate-700"}`}>{fmtRoas(c.roas)}</td>
                      </>
                    ) : (
                      <>
                        <td className={`py-3 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtNum(c.leads)}</td>
                        <td className={`py-3 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtBRL(c.cpl)}</td>
                        <td className={`py-3 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtBRL(c.investimento)}</td>
                        <td className={`py-3 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{n(c.lpi).toFixed(4)}</td>
                        <td className={`py-3 pl-2 text-right font-semibold ${isDark ? "text-white/70" : "text-slate-700"}`}>{fmtNum(c.impressoes)}</td>
                      </>
                    )}
                  </tr>
                ))}
                {(campTab === "meta" ? data.campanhas_meta : data.campanhas_google).length === 0 && (
                  <tr>
                    <td colSpan={7} className={`py-8 text-center text-xs ${isDark ? "text-white/20" : "text-slate-400"}`}>
                      Nenhuma campanha encontrada para este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 6. Canais GA4 ────────────────────────────────────────────────── */}
      {hasGA4 && data.canais.length > 0 && (
        <div className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
          <div className="px-5 pt-4 pb-2">
            <p className={`text-sm font-semibold ${isDark ? "text-white/70" : "text-slate-700"}`}>Canais GA4</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="overflow-x-auto px-4 pb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className={`border-b ${isDark ? "border-white/[0.07]" : "border-slate-100"}`}>
                    <th className={`text-left py-2 pr-3 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Canal</th>
                    {isEcommerce ? (
                      <>
                        <th className={`text-right py-2 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Sessões</th>
                        <th className={`text-right py-2 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Receita</th>
                      </>
                    ) : (
                      <>
                        <th className={`text-right py-2 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Usuários</th>
                        <th className={`text-right py-2 px-2 font-medium ${isDark ? "text-white/40" : "text-slate-500"}`}>Novos</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.canais.map((c) => (
                    <tr key={c.id} className={`border-b last:border-0 ${isDark ? "border-white/[0.04]" : "border-slate-50"}`}>
                      <td className={`py-2.5 pr-3 ${isDark ? "text-white/70" : "text-slate-700"}`}>{c.nomeCanal ?? "—"}</td>
                      {isEcommerce ? (
                        <>
                          <td className={`py-2.5 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtNum(c.sessoes)}</td>
                          <td className={`py-2.5 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtBRL(c.receita)}</td>
                        </>
                      ) : (
                        <>
                          <td className={`py-2.5 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtNum(c.usuarios)}</td>
                          <td className={`py-2.5 px-2 text-right ${isDark ? "text-white/60" : "text-slate-600"}`}>{fmtNum(c.novosUsuarios)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4 flex items-center">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart layout="vertical" data={data.canais.map((c) => ({ nome: c.nomeCanal ?? "—", valor: isEcommerce ? n(c.sessoes) : n(c.usuarios) }))} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: chartColors.axisTick, fontSize: 10 }} axisLine={{ stroke: chartColors.axisLine }} />
                  <YAxis type="category" dataKey="nome" width={90} tick={{ fill: chartColors.axisTick, fontSize: 10 }} axisLine={{ stroke: chartColors.axisLine }} />
                  <Tooltip contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="valor" fill={META_COLOR} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Evolução Temporal (Area Charts) ────────────────────────────── */}
      {historicoData.length > 1 && (
        <div className={`border rounded-2xl p-5 transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
          <p className={`text-sm font-semibold mb-4 ${isDark ? "text-white/70" : "text-slate-700"}`}>
            Evolução Temporal
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Investimento + ROAS */}
            <div>
              <p className={`text-[11px] font-medium mb-2 uppercase tracking-wide ${isDark ? "text-white/30" : "text-slate-400"}`}>Investimento & ROAS</p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={historicoData}>
                  <defs>
                    <linearGradient id="gradInvestimento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={META_COLOR} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={META_COLOR} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="periodo" tick={{ fill: chartColors.axisTick, fontSize: 10 }} axisLine={{ stroke: chartColors.axisLine }} />
                  <YAxis yAxisId="left" tick={{ fill: chartColors.axisTick, fontSize: 10 }} axisLine={{ stroke: chartColors.axisLine }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: chartColors.axisTick, fontSize: 10 }} axisLine={{ stroke: chartColors.axisLine }} />
                  <Tooltip contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="investimento" name="Investimento" fill="url(#gradInvestimento)" stroke={META_COLOR} radius={[4, 4, 0, 0]} barSize={24} />
                  <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke={ROAS_COLOR} strokeWidth={2.5} dot={{ r: 4, fill: ROAS_COLOR, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* Vendas/Leads + Faturamento */}
            <div>
              <p className={`text-[11px] font-medium mb-2 uppercase tracking-wide ${isDark ? "text-white/30" : "text-slate-400"}`}>
                {isEcommerce ? "Vendas & Faturamento" : "Leads & Investimento"}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={historicoData}>
                  <defs>
                    <linearGradient id="gradLine1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOOGLE_COLOR} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={GOOGLE_COLOR} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradLine2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={META_COLOR} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={META_COLOR} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="periodo" tick={{ fill: chartColors.axisTick, fontSize: 10 }} axisLine={{ stroke: chartColors.axisLine }} />
                  <YAxis tick={{ fill: chartColors.axisTick, fontSize: 10 }} axisLine={{ stroke: chartColors.axisLine }} />
                  <Tooltip contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {isEcommerce ? (
                    <>
                      <Area type="monotone" dataKey="vendas" name="Vendas" stroke={GOOGLE_COLOR} strokeWidth={2.5} fill="url(#gradLine1)" dot={{ r: 4, fill: GOOGLE_COLOR, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      <Area type="monotone" dataKey="faturamento" name="Faturamento" stroke={META_COLOR} strokeWidth={2.5} fill="url(#gradLine2)" dot={{ r: 4, fill: META_COLOR, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    </>
                  ) : (
                    <>
                      <Area type="monotone" dataKey="leads" name="Leads" stroke={GOOGLE_COLOR} strokeWidth={2.5} fill="url(#gradLine1)" dot={{ r: 4, fill: GOOGLE_COLOR, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      <Area type="monotone" dataKey="investimento" name="Investimento" stroke={META_COLOR} strokeWidth={2.5} fill="url(#gradLine2)" dot={{ r: 4, fill: META_COLOR, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. GA4 Detalhado ─────────────────────────────────────────────── */}
      {hasGA4 && m && (
        <div className={`border rounded-2xl p-5 transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
          <p className={`text-sm font-semibold mb-4 ${isDark ? "text-white/70" : "text-slate-700"}`}>
            GA4 — Detalhamento
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <GA4Card label="Sessões" value={fmtNum(m.sessoes)} isDark={isDark} icon={Activity} color="blue" />
            <GA4Card label="Sessões Engajadas" value={fmtNum(m.sessoesEngajadas)} isDark={isDark} icon={MousePointerClick} color="purple" />
            <GA4Card label="Taxa Engajamento" value={fmtPct(n(m.taxaEngajamento) * 100)} isDark={isDark} icon={Target} color="emerald" />
            <GA4Card label="Tempo Médio" value={fmtSeconds(m.tempoMedioEngajamento)} isDark={isDark} icon={Clock} color="amber" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MetaBar({ label, pct, atual, meta, isDark }: { label: string; pct: number; atual: string; meta: string; isDark: boolean }) {
  const clamped = Math.min(pct * 100, 100);
  const isAchieved = clamped >= 100;
  const color = isAchieved ? "bg-emerald-500" : clamped >= 70 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${isDark ? "text-white/50" : "text-slate-600"}`}>{label}</span>
          {isAchieved && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
              isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-700"
            }`}>
              <CheckCircle2 className="w-3 h-3" />
              Meta atingida
            </span>
          )}
        </div>
        <span className={`text-[11px] tabular-nums ${isDark ? "text-white/30" : "text-slate-400"}`}>
          {atual} / {meta} ({(pct * 100).toFixed(0)}%)
        </span>
      </div>
      <div className={`h-3 rounded-full overflow-hidden ${isDark ? "bg-zinc-800" : "bg-slate-100"}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color} ${isAchieved ? "shadow-[0_0_8px_rgba(34,197,94,0.4)]" : ""}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function PlatformCard({ label, color, investimento, resultado, resultadoLabel, eficiencia, eficienciaLabel, isDark }: {
  label: string; color: string; investimento: string; resultado: string; resultadoLabel: string; eficiencia: string; eficienciaLabel: string; isDark: boolean;
}) {
  return (
    <div
      className={`border rounded-xl p-4 transition-colors duration-300 border-l-[3px] ${isDark ? "bg-zinc-800/50 border-white/[0.07]" : "bg-slate-50 border-slate-200"}`}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className={`text-xs font-semibold ${isDark ? "text-white/60" : "text-slate-600"}`}>{label}</span>
      </div>
      <div className="space-y-2.5">
        <div>
          <span className={`text-[10px] uppercase tracking-wide ${isDark ? "text-white/25" : "text-slate-400"}`}>Investimento</span>
          <p className={`text-sm font-bold ${isDark ? "text-white/80" : "text-slate-800"}`}>{investimento}</p>
        </div>
        <div>
          <span className={`text-[10px] uppercase tracking-wide ${isDark ? "text-white/25" : "text-slate-400"}`}>{resultadoLabel}</span>
          <p className={`text-sm font-bold ${isDark ? "text-white/80" : "text-slate-800"}`}>{resultado}</p>
        </div>
        <div>
          <span className={`text-[10px] uppercase tracking-wide ${isDark ? "text-white/25" : "text-slate-400"}`}>{eficienciaLabel}</span>
          <p className={`text-sm font-bold ${isDark ? "text-white/80" : "text-slate-800"}`}>{eficiencia}</p>
        </div>
      </div>
    </div>
  );
}

function GA4Card({ label, value, isDark, icon: Icon, color = "blue" }: { label: string; value: string; isDark: boolean; icon: React.ElementType; color?: string }) {
  const colors = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className={`border rounded-xl p-4 transition-colors duration-300 ${isDark ? "bg-zinc-800/50 border-white/[0.07]" : "bg-slate-50 border-slate-200"}`}>
      <div className="flex flex-col items-center text-center gap-2.5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? colors.iconBgDark : colors.iconBg}`}>
          <Icon className={`w-5 h-5 ${isDark ? colors.iconColorDark : colors.iconColor}`} />
        </div>
        <div>
          <span className={`text-[10px] font-medium uppercase tracking-wide ${isDark ? "text-white/30" : "text-slate-400"}`}>{label}</span>
          <p className={`text-lg font-bold ${isDark ? "text-white/80" : "text-slate-800"}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
