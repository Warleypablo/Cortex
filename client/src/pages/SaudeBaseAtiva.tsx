import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HeartPulse,
  DollarSign,
  FileText,
  TrendingUp,
  Clock,
  Search,
  ArrowUpDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface ContratoAtivo {
  id_subtask: string;
  servico: string;
  status: string;
  mrr: number;
  valorp: number;
  data_inicio: string;
  squad: string;
  produto: string;
  plano: string;
  vendedor: string;
  responsavel: string;
  cs_responsavel: string;
  nome_cliente: string;
  cnpj: string;
  cluster: string;
  lt_meses: number;
}

interface BreakdownItem {
  name: string;
  lt_medio: number;
  contratos: number;
  mrr: number;
}

interface SaudeBaseResponse {
  contratos: ContratoAtivo[];
  evolucao: { mes: string; lt_medio: number; total_contratos: number; ticket_medio: number }[];
  kpis: { ltMedio: number; ticketMedio: number; ltvEstimado: number; totalContratos: number; mrrTotal: number };
  distribuicaoLT: { faixa: string; count: number; mrr: number }[];
  breakdowns: {
    squad: BreakdownItem[];
    produto: BreakdownItem[];
    plano: BreakdownItem[];
    cluster: BreakdownItem[];
  };
  filtros: {
    squads: string[];
    produtos: string[];
    planos: string[];
    clusters: string[];
  };
}

function formatMesLabel(mesAno: string) {
  const [ano, mes] = mesAno.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[parseInt(mes) - 1]}/${ano.slice(2)}`;
}

export default function SaudeBaseAtiva() {
  usePageTitle("Saúde da Base Ativa");
  useSetPageInfo("Saúde da Base Ativa", "Lifetime, ticket médio e LTV da base ativa");

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const chartColors = {
    grid: isDark ? "#27272a" : "#e5e7eb",
    axisLine: isDark ? "#3f3f46" : "#d1d5db",
    axisTick: isDark ? "#71717a" : "#6b7280",
    tooltipBg: isDark ? "#18181b" : "#ffffff",
    tooltipBorder: isDark ? "#3f3f46" : "#e5e7eb",
    tooltipText: isDark ? "#f4f4f5" : "#18181b",
  };

  const [filterSquad, setFilterSquad] = useState("todos");
  const [filterProduto, setFilterProduto] = useState("todos");
  const [filterPlano, setFilterPlano] = useState("todos");
  const [filterCluster, setFilterCluster] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<keyof ContratoAtivo>("lt_meses");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery<SaudeBaseResponse>({
    queryKey: ["/api/saude-base-ativa"],
    queryFn: async () => {
      const response = await fetch("/api/saude-base-ativa");
      if (!response.ok) throw new Error("Falha ao buscar dados");
      return response.json();
    },
  });

  // Filter contracts client-side
  const filteredContratos = useMemo(() => {
    if (!data?.contratos) return [];
    return data.contratos.filter(c => {
      if (filterSquad !== "todos" && c.squad !== filterSquad) return false;
      if (filterProduto !== "todos" && c.produto !== filterProduto) return false;
      if (filterPlano !== "todos" && c.plano !== filterPlano) return false;
      if (filterCluster !== "todos" && c.cluster !== filterCluster) return false;
      if (searchTerm && !c.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [data?.contratos, filterSquad, filterProduto, filterPlano, filterCluster, searchTerm]);

  // Recalculate KPIs based on filtered data
  const kpis = useMemo(() => {
    const total = filteredContratos.length;
    if (total === 0) return { ltMedio: 0, ticketMedio: 0, ltvEstimado: 0, totalContratos: 0, mrrTotal: 0 };
    const mrrTotal = filteredContratos.reduce((s, c) => s + c.mrr, 0);
    const ltMedio = filteredContratos.reduce((s, c) => s + c.lt_meses, 0) / total;
    const ticketMedio = mrrTotal / total;
    const ltvEstimado = ticketMedio * ltMedio;
    return { ltMedio, ticketMedio, ltvEstimado, totalContratos: total, mrrTotal };
  }, [filteredContratos]);

  // Recalculate distributions based on filtered data
  const distribuicaoLT = useMemo(() => {
    const faixas = [
      { label: '0-3m', min: 0, max: 3 },
      { label: '3-6m', min: 3, max: 6 },
      { label: '6-12m', min: 6, max: 12 },
      { label: '12-24m', min: 12, max: 24 },
      { label: '24m+', min: 24, max: Infinity },
    ];
    return faixas.map(f => ({
      faixa: f.label,
      count: filteredContratos.filter(c => c.lt_meses >= f.min && c.lt_meses < f.max).length,
      mrr: filteredContratos.filter(c => c.lt_meses >= f.min && c.lt_meses < f.max).reduce((s, c) => s + c.mrr, 0),
    }));
  }, [filteredContratos]);

  // Recalculate breakdowns based on filtered data
  const breakdowns = useMemo(() => {
    const groupBy = (key: 'squad' | 'produto' | 'plano' | 'cluster') => {
      const map = new Map<string, { count: number; totalLT: number; mrr: number }>();
      for (const c of filteredContratos) {
        const val = c[key];
        const existing = map.get(val) || { count: 0, totalLT: 0, mrr: 0 };
        existing.count++;
        existing.totalLT += c.lt_meses;
        existing.mrr += c.mrr;
        map.set(val, existing);
      }
      return Array.from(map.entries())
        .map(([name, d]) => ({ name, lt_medio: d.count > 0 ? d.totalLT / d.count : 0, contratos: d.count, mrr: d.mrr }))
        .sort((a, b) => b.lt_medio - a.lt_medio);
    };
    return {
      squad: groupBy('squad'),
      produto: groupBy('produto'),
      plano: groupBy('plano'),
      cluster: groupBy('cluster'),
    };
  }, [filteredContratos]);

  // Sorted table data
  const sortedContratos = useMemo(() => {
    return [...filteredContratos].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal || "");
      const bStr = String(bVal || "");
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filteredContratos, sortKey, sortDir]);

  const handleSort = (key: keyof ContratoAtivo) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const evolucaoChartData = useMemo(() => {
    if (!data?.evolucao) return [];
    return data.evolucao.map(e => ({
      mes: formatMesLabel(e.mes),
      lt_medio: parseFloat(e.lt_medio.toFixed(1)),
    }));
  }, [data?.evolucao]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, color: chartColors.tooltipText }}>
        <p className="text-xs font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="opacity-70">{p.name}:</span>
            <span className="font-semibold">
              {p.dataKey === "mrr" || p.dataKey === "ltvEstimado"
                ? formatCurrencyNoDecimals(p.value)
                : typeof p.value === "number" ? p.value.toFixed(1) : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-40" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const kpiCards = [
    { title: "LT Médio", value: `${kpis.ltMedio.toFixed(1)} meses`, icon: Clock, color: "text-violet-600 dark:text-violet-400", bgGlow: "from-violet-500/10 to-transparent" },
    { title: "Ticket Médio", value: formatCurrencyNoDecimals(kpis.ticketMedio), icon: DollarSign, color: "text-cyan-600 dark:text-cyan-400", bgGlow: "from-cyan-500/10 to-transparent" },
    { title: "LTV Estimado", value: formatCurrencyNoDecimals(kpis.ltvEstimado), icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bgGlow: "from-emerald-500/10 to-transparent" },
    { title: "Total Contratos", value: kpis.totalContratos.toLocaleString("pt-BR"), icon: FileText, color: "text-blue-600 dark:text-blue-400", bgGlow: "from-blue-500/10 to-transparent" },
    { title: "MRR Total", value: formatCurrencyNoDecimals(kpis.mrrTotal), icon: HeartPulse, color: "text-rose-600 dark:text-rose-400", bgGlow: "from-rose-500/10 to-transparent" },
  ];

  const BREAKDOWN_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#f43f5e", "#22c55e", "#6366f1", "#14b8a6"];

  const renderBreakdownChart = (title: string, items: BreakdownItem[]) => {
    const chartData = items.slice(0, 10);
    return (
      <Card className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-gray-200 dark:border-zinc-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-800 dark:text-zinc-200">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 32)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: chartColors.axisTick, fontSize: 11 }} axisLine={{ stroke: chartColors.axisLine }} tickFormatter={(v) => `${v.toFixed(0)}m`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: chartColors.axisTick, fontSize: 11 }} axisLine={{ stroke: chartColors.axisLine }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="lt_medio" name="LT Médio" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const SortHeader = ({ label, field }: { label: string; field: keyof ContratoAtivo }) => (
    <TableHead className="cursor-pointer select-none hover:text-gray-900 dark:hover:text-white" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("w-3 h-3", sortKey === field ? "text-blue-500" : "opacity-40")} />
      </div>
    </TableHead>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <Input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 w-[200px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700"
          />
        </div>
        <Select value={filterSquad} onValueChange={setFilterSquad}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Squad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Squads</SelectItem>
            {data?.filtros.squads.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProduto} onValueChange={setFilterProduto}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Produtos</SelectItem>
            {data?.filtros.produtos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPlano} onValueChange={setFilterPlano}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Planos</SelectItem>
            {data?.filtros.planos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCluster} onValueChange={setFilterCluster}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Clusters</SelectItem>
            {data?.filtros.clusters.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map(card => (
          <Card key={card.title} className="relative overflow-hidden bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-gray-200 dark:border-zinc-700/50">
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", card.bgGlow)} />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-zinc-400">{card.title}</CardTitle>
              <card.icon className={cn("w-4 h-4", card.color)} />
            </CardHeader>
            <CardContent className="relative">
              <p className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution by LT Range */}
        <Card className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-gray-200 dark:border-zinc-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Distribuição por Faixas de LT</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={distribuicaoLT} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="faixa" tick={{ fill: chartColors.axisTick, fontSize: 12 }} axisLine={{ stroke: chartColors.axisLine }} />
                <YAxis tick={{ fill: chartColors.axisTick, fontSize: 11 }} axisLine={{ stroke: chartColors.axisLine }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Contratos" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* LT Evolution */}
        <Card className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-gray-200 dark:border-zinc-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Evolução do LT Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={evolucaoChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ltGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="mes" tick={{ fill: chartColors.axisTick, fontSize: 12 }} axisLine={{ stroke: chartColors.axisLine }} />
                <YAxis tick={{ fill: chartColors.axisTick, fontSize: 11 }} axisLine={{ stroke: chartColors.axisLine }} tickFormatter={v => `${v}m`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="lt_medio" name="LT Médio (meses)" stroke="#3b82f6" strokeWidth={2} fill="url(#ltGradient)" dot={{ r: 3, fill: "#3b82f6" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderBreakdownChart("LT Médio por Squad", breakdowns.squad)}
        {renderBreakdownChart("LT Médio por Produto", breakdowns.produto)}
        {renderBreakdownChart("LT Médio por Plano", breakdowns.plano)}
        {renderBreakdownChart("LT Médio por Cluster", breakdowns.cluster)}
      </div>

      {/* Detailed Table */}
      <Card className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-gray-200 dark:border-zinc-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
            Contratos Ativos ({sortedContratos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white dark:bg-zinc-900 z-10">
                <TableRow className="border-gray-200 dark:border-zinc-700">
                  <SortHeader label="Cliente" field="nome_cliente" />
                  <SortHeader label="Serviço" field="servico" />
                  <SortHeader label="Squad" field="squad" />
                  <SortHeader label="Produto" field="produto" />
                  <SortHeader label="Plano" field="plano" />
                  <SortHeader label="Cluster" field="cluster" />
                  <SortHeader label="MRR" field="mrr" />
                  <SortHeader label="LT (meses)" field="lt_meses" />
                  <TableHead>LTV</TableHead>
                  <SortHeader label="Data Início" field="data_inicio" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContratos.slice(0, 200).map((c) => (
                  <TableRow key={c.id_subtask} className="border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                    <TableCell className="font-medium text-gray-900 dark:text-white text-xs max-w-[180px] truncate">{c.nome_cliente}</TableCell>
                    <TableCell className="text-xs text-gray-600 dark:text-zinc-400 max-w-[150px] truncate">{c.servico}</TableCell>
                    <TableCell className="text-xs text-gray-600 dark:text-zinc-400">{c.squad}</TableCell>
                    <TableCell className="text-xs text-gray-600 dark:text-zinc-400">{c.produto}</TableCell>
                    <TableCell className="text-xs text-gray-600 dark:text-zinc-400">{c.plano}</TableCell>
                    <TableCell className="text-xs text-gray-600 dark:text-zinc-400">{c.cluster}</TableCell>
                    <TableCell className="text-xs font-medium text-gray-900 dark:text-white">{formatCurrencyNoDecimals(c.mrr)}</TableCell>
                    <TableCell className="text-xs font-medium text-gray-900 dark:text-white">{c.lt_meses.toFixed(1)}</TableCell>
                    <TableCell className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{formatCurrencyNoDecimals(c.mrr * c.lt_meses)}</TableCell>
                    <TableCell className="text-xs text-gray-600 dark:text-zinc-400">{c.data_inicio ? new Date(c.data_inicio).toLocaleDateString("pt-BR") : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
